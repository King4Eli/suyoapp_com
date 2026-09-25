"""Simulator entry point.

Usage:
    python main.py match --rand        [--limit 2000] [--loops 1] [--status 1] [--dry-run]
    python main.py match --preference  [--limit 2000] [--loops 1] [--status 1] [--attempts 300] [--dry-run]
    python main.py conversation --rand [--limit 2000] [--loops 1] [--min-messages 1] [--max-messages 6] [--dry-run]
    python main.py geo --rand          [--limit 2000] [--radius-km 15] [--dry-run]

source ~/.venv/bin/activate  && python main.py match --rand --limit 8000 --loops 116 --status 1
source ~/.venv/bin/activate  && python main.py match --preference --limit 7000 --loops 221 --status 1 --attempts 300
source ~/.venv/bin/activate  && python main.py conversation --rand --limit 6000 --loops 131 --min-messages 2 --max-messages 10
"""
import argparse

import conversation_random
import geo_random
import match_by_preference
import match_random
from _db import MATCH_STATUSES, connect


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    commands = parser.add_subparsers(dest='command', required=True)

    common = argparse.ArgumentParser(add_help=False)
    common.add_argument('--limit', type=int, default=2000, help='max matches created/messaged per loop')
    common.add_argument('--loops', type=int, default=1, help='how many times to repeat the whole run')
    common.add_argument('--dry-run', action='store_true')

    match = commands.add_parser('match', parents=[common], help='create matches between users')
    mode = match.add_mutually_exclusive_group(required=True)
    mode.add_argument('--rand', action='store_true', help='random pairs, ignoring preferences')
    mode.add_argument('--preference', action='store_true', help='pairs whose preferences accept each other')
    match.add_argument('--status', choices=MATCH_STATUSES, help='fixed match_status (default: random)')
    match.add_argument('--attempts', type=int, default=300, help='--preference only: random candidates tried per user')

    conversation = commands.add_parser('conversation', parents=[common], help='add chat messages to mutual matches')
    conversation.add_argument('--rand', action='store_true', required=True, help='random messages from the built-in phrase bank')
    conversation.add_argument('--min-messages', type=int, default=1, help='min messages added per match')
    conversation.add_argument('--max-messages', type=int, default=6, help='max messages added per match')

    geo = commands.add_parser('geo', parents=[common], help='fill empty users.geo_hash with random locations')
    geo.add_argument('--rand', action='store_true', required=True, help='random point near a random US city')
    geo.add_argument('--radius-km', type=float, default=geo_random.DEFAULT_RADIUS_KM, help='max distance from the city center')

    return parser


def main():
    parser = build_parser()
    args = parser.parse_args()

    if args.command == 'match' and args.rand:
        run = lambda conn: match_random.simulate(conn, args.limit, args.status, args.dry_run)
    elif args.command == 'match':
        run = lambda conn: match_by_preference.simulate(conn, args.limit, args.status, args.attempts, args.dry_run)
    elif args.command == 'geo':
        run = lambda conn: geo_random.simulate(conn, args.limit, args.radius_km, args.dry_run)
    else:
        if args.min_messages < 1 or args.max_messages < args.min_messages:
            parser.error('need 1 <= --min-messages <= --max-messages')
        run = lambda conn: conversation_random.simulate(conn, args.limit, args.min_messages, args.max_messages, args.dry_run)

    for i in range(args.loops):
        try:
            conn = connect()
            run(conn)
            conn.close()
        except Exception as err:
            print(f"❌ Simulation failed: {err}")
        print(f"✨ ============================================ loop {i + 1}/{args.loops}")


if __name__ == '__main__':
    main()
