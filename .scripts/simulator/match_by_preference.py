"""Create matches between users whose preferences accept each other (both directions).

Mirrors the filters in api/routers/core/getPeopleToMatch.js: age range, gender,
smoking, pet, ethnicity, children, relationship goal, drinking, religion,
political view, education and distance. A preference of -99 means "any".

Run via: python main.py (see main.py for options).
"""
import math
import random
from datetime import date

from _db import ANY, MATCH_STATUSES, insert_match, load_existing_pairs, print_summary

USERS_LIMIT = 90000

# (bio column, preference column) pairs compared as "preference is any, or equals bio".
EXACT_FIELDS = [
    ('user_bio_gender', 'user_preference_gender'),
    ('user_bio_smoking', 'user_preference_smoking'),
    ('user_bio_haspet', 'user_preference_pet'),
    ('user_bio_ethnicity', 'user_preference_ethnicity'),
    ('user_bio_children', 'user_preference_children'),
    ('user_bio_relationshipgoal', 'user_preference_relationshipgoal'),
    ('user_bio_drinking', 'user_preference_drinking'),
    ('user_bio_religion', 'user_preference_religion'),
    ('user_bio_politicalview', 'user_preference_politicalview'),
    ('user_bio_highesteducation', 'user_preference_highesteducation'),
]


def to_int(value, default=ANY):
    try:
        parsed = float(str(value))
        return int(parsed) if math.isfinite(parsed) else default
    except (TypeError, ValueError):
        return default


def age_from_dob(dob) -> int | None:
    """user_bio_dob is stored as YYYYMMDD; same floor(days / 365) as the api query."""
    try:
        born = date(int(dob[0:4]), int(dob[4:6]), int(dob[6:8]))
    except (TypeError, ValueError):
        return None
    return (date.today() - born).days // 365


def distance_miles(a: dict, b: dict) -> float:
    lat1, lon1, lat2, lon2 = map(math.radians, (a['geo_latd'], a['geo_long'], b['geo_latd'], b['geo_long']))
    cos_angle = math.sin(lat1) * math.sin(lat2) + math.cos(lat1) * math.cos(lat2) * math.cos(lon2 - lon1)
    return 3959 * math.acos(max(-1.0, min(1.0, cos_angle)))


def accepts(viewer: dict, candidate: dict) -> bool:
    """True when `candidate` passes every one of `viewer`'s preferences."""
    for bio_col, pref_col in EXACT_FIELDS:
        preference = to_int(viewer[pref_col])
        if preference != ANY and preference != to_int(candidate[bio_col], default=None):
            return False

    age = candidate['age']
    if age is None or not (to_int(viewer['user_preference_minimum_age']) <= age <= to_int(viewer['user_preference_maximum_age'])):
        return False

    max_distance = to_int(viewer['user_preference_distance'])
    if max_distance != ANY and max_distance <= 100 and distance_miles(viewer, candidate) > max_distance:
        return False

    return True


def load_users(cursor) -> list:
    bio_and_pref_cols = ', '.join(col for pair in EXACT_FIELDS for col in pair)
    cursor.execute(
        f"""SELECT user_id, user_bio_dob, geo_latd, geo_long,
                   user_preference_minimum_age, user_preference_maximum_age, user_preference_distance,
                   {bio_and_pref_cols}
            FROM users
            WHERE user_active = '1'
            ORDER BY RAND()
            LIMIT %s""",
        (USERS_LIMIT,),
    )
    users = cursor.fetchall()
    for user in users:
        user['user_id'] = str(user['user_id'])
        user['age'] = age_from_dob(user['user_bio_dob'])
    return users


def simulate(conn, limit: int, status: str | None, attempts: int, dry_run: bool):
    cursor = conn.cursor(dictionary=True)
    users = load_users(cursor)
    print(f"Found {len(users)} active users")
    if len(users) < 2:
        print('Need at least 2 users to create matches')
        cursor.close()
        return

    existing_pairs = load_existing_pairs(conn.cursor())
    paired: set = set()
    created = skipped = 0

    for user1 in users:
        if created >= limit:
            break
        if user1['user_id'] in paired:
            continue

        # Sample random candidates instead of scanning everyone: O(n * attempts), not O(n^2).
        user2 = None
        for candidate in random.sample(users, min(attempts, len(users))):
            if (
                candidate['user_id'] == user1['user_id']
                or candidate['user_id'] in paired
                or frozenset((user1['user_id'], candidate['user_id'])) in existing_pairs
            ):
                continue
            if accepts(user1, candidate) and accepts(candidate, user1):
                user2 = candidate
                break

        if not user2:
            skipped += 1
            continue

        match_status = status or random.choice(MATCH_STATUSES)
        label = f"{user1['user_id']} ↔ {user2['user_id']} -> {match_status}"
        if dry_run:
            print(f"[DRY RUN] Would create match: {label}")
        else:
            match_id = insert_match(cursor, user1['user_id'], user2['user_id'], match_status)
            conn.commit()
            print(f"✅ {match_id}: {label}")

        created += 1
        paired.update((user1['user_id'], user2['user_id']))
        existing_pairs.add(frozenset((user1['user_id'], user2['user_id'])))

    cursor.close()
    print_summary('Preference Match', created, skipped)

