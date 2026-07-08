"""Add random chat messages to existing mutual matches (match_status = '1').

Each picked match gets a short burst of messages. A new chat starts with a random
speaker; an existing chat continues with whoever did not send the last message,
then the speakers alternate. Messages use the api payload shape {"t": "text", "str": ...}.

Run via: python main.py (see main.py for options).
"""
import json
import random
import time

from _db import generate_id, print_summary

MATCHES_LIMIT = 50000

OPENERS = [
    "Hey {other}! How's your week going?",
    "Hi {other} 👋 your profile made me smile",
    "Hey! I see you're from {hometown}, what's it like there?",
    "Hi {other}, what does a {job} actually do all day?",
    "Okay I have to ask, what's the best thing you've eaten recently?",
    "Hey {other}, coffee person or tea person?",
    "Hi! What are you up to this weekend?",
]

REPLIES = [
    "Haha that's fair",
    "Honestly pretty good, a bit busy with work though",
    "No way, same here!",
    "That sounds fun, I've always wanted to try that",
    "Coffee, always. You?",
    "Not much planned yet, maybe a hike if the weather holds",
    "What about you?",
    "Lol I like that answer",
    "I'm more of a homebody but I can be convinced 😄",
    "That's a good question, let me think",
    "Tell me more!",
    "Have you been there before?",
    "I just got back from the gym, so tired",
    "Any good show recommendations?",
    "I've been rewatching old movies lately",
    "We should grab a drink sometime",
    "Sounds like a plan 🙂",
    "How long have you lived in {hometown}?",
    "Being a {job} sounds interesting, do you enjoy it?",
    "Good morning! Hope your day is going well",
]


def first_name(fullname) -> str:
    return (str(fullname or '').split() or ['there'])[0]


def render(template: str, other: dict) -> str:
    # Fall back to a generic line when the template needs a profile field the user left empty.
    if ('{hometown}' in template and not other['hometown']) or ('{job}' in template and not other['job']):
        return random.choice([r for r in REPLIES if '{' not in r])
    return template.format(other=first_name(other['name']), hometown=other['hometown'], job=other['job'])


def load_matches(cursor) -> list:
    cursor.execute(
        """SELECT m.match_id,
                  f.user_fullname AS from_name, f.user_bio_hometown AS from_hometown, f.user_bio_jobrole AS from_job,
                  t.user_fullname AS to_name, t.user_bio_hometown AS to_hometown, t.user_bio_jobrole AS to_job,
                  (SELECT c.convo_by_initiator FROM conversations c
                    WHERE c.convo_match_id = m.match_id
                    ORDER BY c.convo_date_added DESC LIMIT 1) AS last_speaker
           FROM matches m
           INNER JOIN users f ON f.user_id = m.match_user_id_from
           INNER JOIN users t ON t.user_id = m.match_user_id_to
           WHERE m.match_status = '1'
           ORDER BY RAND()
           LIMIT %s""",
        (MATCHES_LIMIT,),
    )
    return cursor.fetchall()


def simulate(conn, limit: int, min_messages: int, max_messages: int, dry_run: bool):
    cursor = conn.cursor(dictionary=True)
    matches = load_matches(cursor)
    print(f"Found {len(matches)} mutual matches")
    if not matches:
        print('No mutual matches found. Run match_by_preference.py or match_random.py with --status 1 first.')
        cursor.close()
        return

    created = 0
    for match in matches[:limit]:
        profiles = {
            '1': {'name': match['from_name'], 'hometown': match['from_hometown'], 'job': match['from_job']},
            '0': {'name': match['to_name'], 'hometown': match['to_hometown'], 'job': match['to_job']},
        }
        is_new_chat = match['last_speaker'] is None
        # convo_by_initiator: '1' = sent by match_user_id_from, '0' = sent by match_user_id_to.
        speaker = random.choice('01') if is_new_chat else ('0' if match['last_speaker'] == '1' else '1')

        last_convo_id = None
        count = random.randint(min_messages, max_messages)
        # One second apart and ending now, so the chat orders correctly by convo_date_added.
        first_ts = int(time.time()) - count + 1
        for n in range(count):
            other = profiles['0' if speaker == '1' else '1']
            template = random.choice(OPENERS) if is_new_chat and n == 0 else random.choice(REPLIES)
            text = render(template, other)

            if dry_run:
                print(f"[DRY RUN] {match['match_id']} [{speaker}] {text}")
            else:
                last_convo_id = generate_id()
                cursor.execute(
                    """INSERT INTO conversations
                       (convo_id, convo_match_id, convo_message, convo_by_initiator, convo_status,
                        convo_date_added, convo_date_updated)
                       VALUES (%s, %s, %s, %s, '0', %s, %s)""",
                    (last_convo_id, match['match_id'], json.dumps({'t': 'text', 'str': text}), speaker,
                     first_ts + n, first_ts + n),
                )
            created += 1
            speaker = '0' if speaker == '1' else '1'

        if last_convo_id:
            cursor.execute(
                "UPDATE matches SET last_message_id = %s, match_dateUpdated = UNIX_TIMESTAMP() WHERE match_id = %s",
                (last_convo_id, match['match_id']),
            )
            conn.commit()
            print(f"✅ {match['match_id']} {'started' if is_new_chat else 'continued'}")

    cursor.close()
    print_summary('Conversation', created, 0)

