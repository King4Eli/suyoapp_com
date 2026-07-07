import math
import os
import random
import sys
import time
import uuid

import mysql.connector
from dotenv import load_dotenv

load_dotenv('../../../.env/dev/db.env')

DB_USERS_LIMIT = 90000
LOOP_LIMIT = 90
WHOLE_LOOP = 10
ANY_GENDER = -99
has_logged_table_structures = False


def normalize_gender(value) -> int:
    try:
        parsed = float(str(value))
        return int(parsed) if math.isfinite(parsed) else ANY_GENDER
    except (ValueError, TypeError):
        return ANY_GENDER


def accepts_gender(preference_gender, target_gender) -> bool:
    preference = normalize_gender(preference_gender)
    gender = normalize_gender(target_gender)
    return preference == ANY_GENDER or preference == gender


def can_match_by_gender(user1: dict, user2: dict) -> bool:
    return (
        accepts_gender(user1['user_preference_gender'], user2['user_bio_gender'])
        and accepts_gender(user2['user_preference_gender'], user1['user_bio_gender'])
    )


def log_table_structures(cursor):
    cursor.execute("""
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = DATABASE()
        ORDER BY table_name
    """)
    tables = cursor.fetchall()

    for table in tables:
        table_name = table.get('TABLE_NAME') or table.get('table_name')
        cursor.execute(
            """SELECT column_name, column_type, is_nullable, column_default, column_key
               FROM information_schema.columns
               WHERE table_schema = DATABASE()
                 AND table_name = %s
               ORDER BY ordinal_position""",
            (table_name,)
        )
        columns = cursor.fetchall()
        print(f"\n🧱 {table_name}")
        for col in columns:
            col_name = col.get('COLUMN_NAME') or col.get('column_name')
            col_type = col.get('COLUMN_TYPE') or col.get('column_type')
            key = col.get('COLUMN_KEY') or col.get('column_key') or ''
            nullable = col.get('IS_NULLABLE') or col.get('is_nullable') or ''
            default_val = col.get('COLUMN_DEFAULT') if col.get('COLUMN_DEFAULT') is not None else col.get('column_default')
            suffix_parts = []
            if key:
                suffix_parts.append(f"key={key}")
            suffix_parts.append(f"null={nullable}")
            if default_val is not None:
                suffix_parts.append(f"default={default_val}")
            suffix = ', '.join(suffix_parts)
            print(f"   {col_name} {col_type}{(' (' + suffix + ')') if suffix else ''}")


def simulate_matches(conn, limit=None, dry_run=False):
    global has_logged_table_structures
    cursor = conn.cursor(dictionary=True)

    if not has_logged_table_structures:
        log_table_structures(cursor)
        has_logged_table_structures = True

    cursor.execute(
        """SELECT user_id, user_bio_gender, user_preference_gender
           FROM users
           WHERE user_active = '1'
             AND user_bio_gender IS NOT NULL
           ORDER BY RAND()
           LIMIT %s""",
        (DB_USERS_LIMIT,)
    )
    users = cursor.fetchall()

    print(f"Found {len(users)} users")

    if len(users) < 2:
        print('Need at least 2 users to create matches')
        cursor.close()
        return {'created': 0, 'skipped': 0}

    created = 0
    skipped = 0
    selected_user_ids: set = set()

    available_users = [
        {
            'user_id': str(u['user_id']),
            'user_bio_gender': normalize_gender(u['user_bio_gender']),
            'user_preference_gender': normalize_gender(u['user_preference_gender']),
        }
        for u in users
    ]

    effective_limit = limit if limit is not None else math.floor(len(available_users) / 2)

    for i, user1 in enumerate(available_users[:-1]):
        if created >= effective_limit:
            break
        if user1['user_id'] in selected_user_ids:
            continue

        user2 = None
        for candidate in available_users[i + 1:]:
            if (
                candidate['user_id'] in selected_user_ids
                or candidate['user_id'] == user1['user_id']
                or not can_match_by_gender(user1, candidate)
            ):
                continue

            cursor.execute(
                """SELECT match_id FROM matches
                   WHERE (match_user_id_from = %s AND match_user_id_to = %s)
                      OR (match_user_id_from = %s AND match_user_id_to = %s)""",
                (user1['user_id'], candidate['user_id'], candidate['user_id'], user1['user_id'])
            )
            if cursor.fetchall():
                print(f"⏭️  Skipping - match already exists between {user1['user_id']} and {candidate['user_id']}")
                skipped += 1
                continue

            user2 = candidate
            break

        if not user2:
            skipped += 1
            continue

        mstatus = str(random.randint(0, 5))

        if not dry_run:
            match_id = f"{int(time.time() * 1000)}_{uuid.uuid4().hex[:9]}"
            cursor.execute(
                """INSERT INTO matches (match_id, match_user_id_from, match_user_id_to, match_status)
                   VALUES (%s, %s, %s, %s)""",
                (match_id, user1['user_id'], user2['user_id'], mstatus)
            )
            conn.commit()
            print(f"✅ {match_id}: {user1['user_id']} ({user1['user_bio_gender']}->{user1['user_preference_gender']}) ↔ {user2['user_id']} ({user2['user_bio_gender']}->{user2['user_preference_gender']}) -> {mstatus}")
            created += 1
        else:
            print(f"[DRY RUN] Would create match: {user1['user_id']} ({user1['user_bio_gender']}->{user1['user_preference_gender']}) ↔ {user2['user_id']} ({user2['user_bio_gender']}->{user2['user_preference_gender']}) -> {mstatus}")
            created += 1

        selected_user_ids.add(user1['user_id'])
        selected_user_ids.add(user2['user_id'])

    cursor.close()

    print(f"\n📊 Match Simulation Summary:")
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
            simulate_matches(conn, limit=LOOP_LIMIT)

            conn.close()
            print(f"✨ ============================================ {i}")
        except Exception as err:
            print(f"❌ Simulation failed: {err}")

        print(f"LOOPING {i}")

    sys.exit(0)
