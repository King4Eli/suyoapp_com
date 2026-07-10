import json
import math
import os
import random
import re
import sys
import time
import uuid

import mysql.connector
import requests
from dotenv import load_dotenv

load_dotenv('../../../.env/db.env')

DB_MATCHES_LIMIT = 51000
LOOP_LIMIT = 5111
WHOLE_LOOP = 101
OLLAMA_URL = 'http://localhost:11434/api/chat'
OLLAMA_MODEL = 'llama3.2'
HISTORY_LIMIT = 16
markovify_file = "/home/king/tr/.read-me.txt"
conversation_logic = 1  # 1 = markovify, 2 = ollama ai

_markov_model = None

if conversation_logic == 1:
    import markovify
    if markovify_file:
        _markov_model = markovify.Text(open(markovify_file).read(), state_size=1, well_formed=False)
    else:
        raise ValueError("markovify_file must be set when conversation_logic = 1")


def parse_text_message(value: str) -> str:
    try:
        parsed = json.loads(value)
        if isinstance(parsed, str):
            return parsed.strip()
        return str(parsed.get('str') or parsed.get('text') or parsed.get('message') or '').strip()
    except Exception:
        return str(value or '').strip()


def clean_generated_message(value: str) -> str:
    value = re.sub(r'^["\'`]+|["\'`]+$', '', value)
    value = re.sub(r'^(initiator|match|from|to|user|assistant)\s*:\s*', '', value, flags=re.IGNORECASE)
    return value.strip()


def describe_user(label: str, name=None, about=None, job=None, hometown=None) -> str:
    parts = [f"{label}: {name or 'Unknown'}"]
    if about:
        parts.append(f"About: {about}")
    if job:
        parts.append(f"Job: {job}")
    if hometown:
        parts.append(f"Hometown: {hometown}")
    return '\n'.join(parts)


def build_system_prompt(match: dict, next_speaker: str, has_history: bool) -> str:
    if next_speaker == '1':
        next_name, other_name = match.get('from_name'), match.get('to_name')
    else:
        next_name, other_name = match.get('to_name'), match.get('from_name')

    continuation = (
        f"Continue the existing conversation as {next_name or 'the next speaker'} replying to {other_name or 'their match'}."
        if has_history else
        f"Start a new conversation as {next_name or 'the first speaker'} messaging {other_name or 'their match'}."
    )
    return '\n'.join([
        'You generate one realistic dating app chat message.',
        'Return only the message text. Do not include labels, JSON, quotes, markdown, or explanations.',
        'Keep it natural, friendly, and human. One or two short sentences max.',
        'Do not be explicit, manipulative, hateful, or ask for off-app contact details.',
        continuation,
        '',
        describe_user('Initiator user', match.get('from_name'), match.get('from_about'), match.get('from_job'), match.get('from_hometown')),
        '',
        describe_user('Matched user', match.get('to_name'), match.get('to_about'), match.get('to_job'), match.get('to_hometown')),
    ])


def build_user_prompt(match: dict, next_speaker: str, has_history: bool) -> str:
    next_name = match.get('from_name') if next_speaker == '1' else match.get('to_name')
    if not has_history:
        return f"{next_name or 'The first speaker'} should send an opening message that references the other profile when possible."
    return f"{next_name or 'The next speaker'} should send the next message in the chat."


def build_ollama_messages(match: dict, conversations: list, next_speaker: str) -> list:
    recent_history = conversations[-HISTORY_LIMIT:]
    messages = [{'role': 'system', 'content': build_system_prompt(match, next_speaker, len(conversations) > 0)}]

    for convo in recent_history:
        text = parse_text_message(convo['convo_message'])
        if not text:
            continue
        is_next_speaker = convo['convo_by_initiator'] == next_speaker
        messages.append({'role': 'assistant' if is_next_speaker else 'user', 'content': text})

    messages.append({'role': 'user', 'content': build_user_prompt(match, next_speaker, len(conversations) > 0)})
    return messages


def generate_markovify_message() -> str:
    for _ in range(10):
        sentence = _markov_model.make_sentence()
        if sentence:
            return clean_generated_message(sentence)
    raise Exception('markovify could not generate a sentence after 10 attempts')


def generate_ollama_message(match: dict, conversations: list, next_speaker: str) -> str:
    response = requests.post(OLLAMA_URL, json={
        'model': OLLAMA_MODEL,
        'stream': False,
        'messages': build_ollama_messages(match, conversations, next_speaker),
        'options': {'temperature': 0.85, 'num_predict': 60}
    })

    if not response.ok:
        raise Exception(f"Ollama request failed: {response.status_code} {response.reason}")

    data = response.json()
    content = clean_generated_message(str(data.get('message', {}).get('content') or ''))

    if not content:
        raise Exception('Ollama returned an empty message')

    return content


def generate_conversation_message(match: dict, conversations: list, next_speaker: str) -> str:
    if conversation_logic == 1:
        return generate_markovify_message()
    return generate_ollama_message(match, conversations, next_speaker)


def simulate_conversations(conn, limit=None, dry_run=False):
    cursor = conn.cursor(dictionary=True)

    cursor.execute(
        """SELECT
            m.match_id,
            m.match_user_id_from,
            m.match_user_id_to,
            from_user.user_fullname AS from_name,
            from_user.user_bio_about AS from_about,
            from_user.user_bio_jobrole AS from_job,
            from_user.user_bio_hometown AS from_hometown,
            to_user.user_fullname AS to_name,
            to_user.user_bio_about AS to_about,
            to_user.user_bio_jobrole AS to_job,
            to_user.user_bio_hometown AS to_hometown
         FROM matches m
         INNER JOIN users from_user ON from_user.user_id = m.match_user_id_from
         INNER JOIN users to_user ON to_user.user_id = m.match_user_id_to
         WHERE match_status = '1' ORDER BY RAND() LIMIT %s""",
        (DB_MATCHES_LIMIT,)
    )
    matches = cursor.fetchall()

    print(f"Found {len(matches)} active matches")

    if not matches:
        print('No active matches found. Run match simulator first.')
        cursor.close()
        return {'created': 0, 'skipped': 0}

    created = 0
    skipped = 0
    effective_limit = limit if limit is not None else len(matches)

    for match in matches[:effective_limit]:
        match_id = match['match_id']

        if not dry_run:
            cursor.execute(
                """SELECT convo_message, convo_by_initiator, convo_date_added
                   FROM conversations
                   WHERE convo_match_id = %s
                   ORDER BY convo_date_added DESC, convo_id DESC
                   LIMIT %s""",
                (match_id, HISTORY_LIMIT)
            )
            conversation_rows = list(reversed(cursor.fetchall()))

            last_speaker = conversation_rows[-1]['convo_by_initiator'] if conversation_rows else None
            initiator = ('0' if random.random() > 0.5 else '1') if not conversation_rows else ('0' if last_speaker == '1' else '1')

            generated_text = generate_conversation_message(match, conversation_rows, initiator)
            message = json.dumps({'t': 'text', 'str': generated_text})
            convo_id = f"{int(time.time() * 1000)}_{uuid.uuid4().hex[:9]}"

            cursor.execute(
                """INSERT INTO conversations
                   (convo_id, convo_match_id, convo_message, convo_by_initiator, convo_status)
                   VALUES (%s, %s, %s, %s, '0')""",
                (convo_id, match_id, message, initiator)
            )
            cursor.execute(
                "UPDATE matches SET last_message_id = %s WHERE match_id = %s",
                (convo_id, match_id)
            )
            conn.commit()

            status = 'started' if not conversation_rows else 'continued'
            print(f"✅ {match_id} {status}")
            created += 1
        else:
            print(f"[DRY RUN] Would create/continue conversation for match {match_id}")
            created += 1

    cursor.close()

    print(f"\n📊 Simulation Summary:")
    print(f"   Created: {created}")
    print(f"   Skipped: {skipped}")
    print(f"   Total:   {created + skipped}")

    return {'created': created, 'skipped': skipped}


if __name__ == '__main__':
    for i in range(WHOLE_LOOP + 1):
        try:
            conn = mysql.connector.connect(
                host='localhost',
                port=int(os.environ.get('DB_PORT', 3306)),
                user=os.environ.get('DB_USER'),
                password=os.environ.get('DB_PASSWORD'),
                database=os.environ.get('DB_NAME'),
            )

            print(f"📡 Connecting to {os.environ.get('DB_HOST')}/{os.environ.get('DB_NAME')}...")
            simulate_conversations(conn, limit=LOOP_LIMIT)

            conn.close()
            print(f"✨ ============================================ {i}")
        except Exception as err:
            print(f"❌ Simulation failed: {err}")

    sys.exit(1)
