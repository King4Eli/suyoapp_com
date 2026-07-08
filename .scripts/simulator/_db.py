"""Shared helpers for the simulator scripts (DB connection, ids, match lookups)."""
import os
import random
import string
from pathlib import Path

import mysql.connector
from dotenv import load_dotenv

REPO_ROOT = Path(__file__).resolve().parents[2]
load_dotenv(REPO_ROOT / '.env' / 'db.env')

ANY = -99
CONNECT_TIMEOUT = 15  # seconds
MATCH_STATUSES = ['0', '1', '2', '3', '4', '5']  # 0=waiting,1=match,2=notinterested,3=block,4=reported,5=superlike


def connect():
    # DB_SIM_HOST overrides DB_HOST when the simulator needs a different route to the db.
    host = os.environ.get('DB_HOST') or 'localhost'
    print(f"📡 Connecting to {host}/{os.environ.get('DB_NAME')}...")
    return mysql.connector.connect(
        host=host,
        port=int(os.environ.get('DB_PORT') or 3306),
        user=os.environ.get('DB_USER'),
        password=os.environ.get('DB_PASSWORD'),
        database=os.environ.get('DB_NAME'),
        connection_timeout=CONNECT_TIMEOUT,
    )


def generate_id(min_len=19, max_len=30) -> str:
    """Same shape as tools.generateAlphanumeric(19, 30) in the api."""
    alphabet = string.ascii_letters + string.digits
    return ''.join(random.choices(alphabet, k=random.randint(min_len, max_len)))


def load_existing_pairs(cursor) -> set:
    """Every existing match as an unordered pair, so either direction counts as taken."""
    cursor.execute("SELECT match_user_id_from, match_user_id_to FROM matches")
    return {frozenset((row[0], row[1])) for row in cursor.fetchall()}


def insert_match(cursor, user_from: str, user_to: str, status: str) -> str:
    match_id = generate_id()
    cursor.execute(
        """INSERT INTO matches (match_id, match_user_id_from, match_user_id_to, match_status)
           VALUES (%s, %s, %s, %s)""",
        (match_id, user_from, user_to, status),
    )
    return match_id


def print_summary(title: str, created: int, skipped: int):
    print(f"\n📊 {title} Summary:")
    print(f"   Created: {created}")
    print(f"   Skipped: {skipped}")
    print(f"   Total:   {created + skipped}")
