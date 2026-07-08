import datetime
import json
import logging
import os
import sys
import time
import traceback

import jwt
import markdown
import redis
import requests
from croniter import croniter

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("worker")

OLLAMA_URL = os.environ["OLLAMA_URL"].rstrip("/")
GHOST_URL = os.environ["GHOST_URL"].rstrip("/")
REDIS_URL = os.environ["REDIS_URL"]
SCHEDULE = os.environ.get("SCHEDULE", "* * * * *")
INTERVAL_SECONDS = int(os.environ.get("INTERVAL_SECONDS", "0"))
OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "mistral:7b")
GHOST_ADMIN_API_KEY = os.environ.get("GHOST_ADMIN_API_KEY", "")
PEXELS_API_KEY = os.environ.get("PEXELS_API_KEY", "")
TOPICS_FILE = os.environ.get("TOPICS_FILE", "/app/topics.txt")
RUN_ON_STARTUP = os.environ.get("RUN_ON_STARTUP", "true").lower() == "true"


def wait_for_ollama():
    while True:
        try:
            r = requests.get(f"{OLLAMA_URL}/api/tags", timeout=5)
            if r.ok:
                return
        except requests.RequestException:
            pass
        log.info("Waiting for Ollama at %s ...", OLLAMA_URL)
        time.sleep(5)


def model_present() -> bool:
    r = requests.get(f"{OLLAMA_URL}/api/tags", timeout=10)
    r.raise_for_status()
    names = {m["name"] for m in r.json().get("models", [])}
    model = OLLAMA_MODEL if ":" in OLLAMA_MODEL else f"{OLLAMA_MODEL}:latest"
    return model in names


def pull_model():
    log.info("Pulling model %s (this can take a while the first time) ...", OLLAMA_MODEL)
    with requests.post(
        f"{OLLAMA_URL}/api/pull",
        json={"name": OLLAMA_MODEL, "stream": True},
        stream=True,
        timeout=None,
    ) as resp:
        resp.raise_for_status()
        for line in resp.iter_lines():
            if not line:
                continue
            obj = json.loads(line)
            if "error" in obj:
                raise RuntimeError(f"Ollama pull error: {obj['error']}")
            log.info("pull: %s", obj.get("status"))


def ensure_model(max_attempts: int = 5):
    if model_present():
        log.info("Model %s already present", OLLAMA_MODEL)
        return

    for attempt in range(1, max_attempts + 1):
        try:
            pull_model()
        except (requests.RequestException, RuntimeError) as e:
            log.warning("Pull attempt %d/%d failed: %s", attempt, max_attempts, e)
            time.sleep(min(5 * attempt, 30))
            continue

        if model_present():
            log.info("Model %s ready", OLLAMA_MODEL)
            return
        log.warning("Pull attempt %d/%d finished but model still missing", attempt, max_attempts)

    raise RuntimeError(f"Failed to pull model {OLLAMA_MODEL} after {max_attempts} attempts")


def load_topics():
    with open(TOPICS_FILE) as f:
        lines = [line.strip() for line in f]
    return [line for line in lines if line and not line.startswith("#")]


def next_topic(r: redis.Redis, topics: list[str]) -> str:
    idx = r.incr("worker:topic_cursor") - 1
    return topics[idx % len(topics)]


def generate_post(topic: str) -> tuple[str, str]:
    prompt = (
        "Write an engaging blog post for a general audience on the topic below.\n"
        f"Topic: {topic}\n\n"
        "Respond in exactly this format, with nothing before or after:\n"
        "TITLE: <a catchy, specific post title>\n"
        "---\n"
        "<the full post body in markdown, 500-800 words, with a few subheadings>"
    )
    r = requests.post(
        f"{OLLAMA_URL}/api/generate",
        json={"model": OLLAMA_MODEL, "prompt": prompt, "stream": False},
        timeout=600,
    )
    r.raise_for_status()
    text = r.json()["response"].strip()

    if text.upper().startswith("TITLE:") and "\n---\n" in text:
        title_line, body = text.split("\n---\n", 1)
        title = title_line[len("TITLE:"):].strip()
        return title, body.strip()

    log.warning("Model output didn't match expected format, falling back to raw output")
    return topic, text


def find_feature_image(topic: str) -> str | None:
    if not PEXELS_API_KEY:
        return None
    try:
        r = requests.get(
            "https://api.pexels.com/v1/search",
            headers={"Authorization": PEXELS_API_KEY},
            params={"query": topic, "per_page": 1, "orientation": "landscape"},
            timeout=10,
        )
        r.raise_for_status()
        photos = r.json().get("photos") or []
        if not photos:
            log.warning("No Pexels image found for topic: %s", topic)
            return None
        return photos[0]["src"]["large2x"]
    except requests.RequestException as e:
        log.warning("Pexels lookup failed: %s", e)
        return None


def ghost_jwt() -> str:
    key_id, secret = GHOST_ADMIN_API_KEY.split(":")
    now = int(time.time())
    payload = {"iat": now, "exp": now + 300, "aud": "/admin/"}
    return jwt.encode(
        payload,
        bytes.fromhex(secret),
        algorithm="HS256",
        headers={"kid": key_id},
    )


def publish_post(title: str, body_md: str, feature_image: str | None):
    html = markdown.markdown(body_md)
    token = ghost_jwt()
    post = {"title": title, "html": html, "status": "published"}
    if feature_image:
        post["feature_image"] = feature_image
    r = requests.post(
        f"{GHOST_URL}/ghost/api/admin/posts/?source=html",
        headers={"Authorization": f"Ghost {token}"},
        json={"posts": [post]},
        timeout=30,
    )
    if not r.ok:
        log.error("Ghost publish failed (%s): %s", r.status_code, r.text)
        r.raise_for_status()
    post = r.json()["posts"][0]
    log.info("Published post %r -> %s", title, post.get("url"))


def run_once(r: redis.Redis, topics: list[str]):
    topic = next_topic(r, topics)
    log.info("Generating post for topic: %s", topic)
    title, body_md = generate_post(topic)
    feature_image = find_feature_image(topic)
    publish_post(title, body_md, feature_image)


def main():
    if not GHOST_ADMIN_API_KEY or ":" not in GHOST_ADMIN_API_KEY:
        log.error(
            "GHOST_ADMIN_API_KEY is not set (or malformed). Log into Ghost admin, "
            "create a Custom Integration under Settings > Integrations, and set "
            "its Admin API Key as GHOST_ADMIN_API_KEY."
        )
        sys.exit(1)

    topics = load_topics()
    if not topics:
        log.error("No topics found in %s", TOPICS_FILE)
        sys.exit(1)

    wait_for_ollama()
    ensure_model()

    r = redis.Redis.from_url(REDIS_URL, decode_responses=True)
    while True:
        try:
            r.ping()
            break
        except redis.RedisError:
            log.info("Waiting for Redis ...")
            time.sleep(5)

    if RUN_ON_STARTUP:
        try:
            run_once(r, topics)
        except Exception:
            log.error("Startup run failed:\n%s", traceback.format_exc())

    if INTERVAL_SECONDS > 0:
        while True:
            log.info("Next post scheduled in %d seconds", INTERVAL_SECONDS)
            time.sleep(INTERVAL_SECONDS)
            try:
                run_once(r, topics)
            except Exception:
                log.error("Scheduled run failed:\n%s", traceback.format_exc())

    cron = croniter(SCHEDULE, datetime.datetime.now())
    while True:
        next_run = cron.get_next(datetime.datetime)
        sleep_seconds = (next_run - datetime.datetime.now()).total_seconds()
        log.info("Next post scheduled at %s", next_run)
        if sleep_seconds > 0:
            time.sleep(sleep_seconds)
        try:
            run_once(r, topics)
        except Exception:
            log.error("Scheduled run failed:\n%s", traceback.format_exc())


if __name__ == "__main__":
    main()
