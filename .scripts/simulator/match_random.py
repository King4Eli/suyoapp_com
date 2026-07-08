"""Create matches between random pairs of active users, ignoring preferences.

Run via: python main.py (see main.py for options).
"""
import random

from _db import MATCH_STATUSES, insert_match, load_existing_pairs, print_summary

USERS_LIMIT = 90000


def simulate(conn, limit: int, status: str | None, dry_run: bool):
    cursor = conn.cursor()
    cursor.execute(
        "SELECT user_id FROM users WHERE user_active = '1' ORDER BY RAND() LIMIT %s",
        (USERS_LIMIT,),
    )
    user_ids = [str(row[0]) for row in cursor.fetchall()]
    print(f"Found {len(user_ids)} active users")
    if len(user_ids) < 2:
        print('Need at least 2 users to create matches')
        cursor.close()
        return

    existing_pairs = load_existing_pairs(cursor)
    created = skipped = 0

    # Already shuffled by RAND(); pair neighbours off two at a time.
    for user1, user2 in zip(user_ids[0::2], user_ids[1::2]):
        if created >= limit:
            break
        pair = frozenset((user1, user2))
        if pair in existing_pairs:
            print(f"⏭️  Skipping - match already exists between {user1} and {user2}")
            skipped += 1
            continue

        # Random direction so neither side is always the initiator.
        if random.random() < 0.5:
            user1, user2 = user2, user1

        match_status = status or random.choice(MATCH_STATUSES)
        label = f"{user1} ↔ {user2} -> {match_status}"
        if dry_run:
            print(f"[DRY RUN] Would create match: {label}")
        else:
            match_id = insert_match(cursor, user1, user2, match_status)
            conn.commit()
            print(f"✅ {match_id}: {label}")

        created += 1
        existing_pairs.add(pair)

    cursor.close()
    print_summary('Random Match', created, skipped)

