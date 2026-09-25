"""Give users with an empty geo_hash a random location (geo_latd/geo_long/geo_hash/geo_meta).

The api encodes geo_hash from lat/long (ngeohash, precision 12) and getPeopleToMatch searches
by geohash prefix, so all four columns are written together to stay consistent. Points are
jittered around real US cities so geo_meta's city/state/postcode match the coordinates without
hitting the rate-limited reverse-geocode api pushLocation uses.

Run via: python main.py (see main.py for options).
"""
import json
import math
import random
import time

from _db import print_summary

GEOHASH_PRECISION = 12  # same as ngeohash.encode(lat, long, 12) in the api
BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz'
DEFAULT_RADIUS_KM = 15
# (city, state, postcode, latd, long)
CITIES = [
    ('New York', 'New York', '10001', 40.7128, -74.0060),
    ('Los Angeles', 'California', '90012', 34.0522, -118.2437),
    ('Chicago', 'Illinois', '60602', 41.8781, -87.6298),
    ('Houston', 'Texas', '77002', 29.7604, -95.3698),
    ('Phoenix', 'Arizona', '85003', 33.4484, -112.0740),
    ('Philadelphia', 'Pennsylvania', '19107', 39.9526, -75.1652),
    ('San Antonio', 'Texas', '78205', 29.4241, -98.4936),
    ('San Diego', 'California', '92101', 32.7157, -117.1611),
    ('Dallas', 'Texas', '75201', 32.7767, -96.7970),
    ('San Jose', 'California', '95113', 37.3382, -121.8863),
    ('Austin', 'Texas', '78701', 30.2672, -97.7431),
    ('Jacksonville', 'Florida', '32202', 30.3322, -81.6557),
    ('Columbus', 'Ohio', '43215', 39.9612, -82.9988),
    ('Charlotte', 'North Carolina', '28202', 35.2271, -80.8431),
    ('Indianapolis', 'Indiana', '46204', 39.7684, -86.1581),
    ('San Francisco', 'California', '94103', 37.7749, -122.4194),
    ('Seattle', 'Washington', '98104', 47.6062, -122.3321),
    ('Denver', 'Colorado', '80202', 39.7392, -104.9903),
    ('Nashville', 'Tennessee', '37203', 36.1627, -86.7816),
    ('Oklahoma City', 'Oklahoma', '73102', 35.4676, -97.5164),
    ('Washington', 'District of Columbia', '20001', 38.9072, -77.0369),
    ('Boston', 'Massachusetts', '02108', 42.3601, -71.0589),
    ('Las Vegas', 'Nevada', '89101', 36.1699, -115.1398),
    ('Portland', 'Oregon', '97204', 45.5152, -122.6784),
    ('Detroit', 'Michigan', '48226', 42.3314, -83.0458),
    ('Memphis', 'Tennessee', '38103', 35.1495, -90.0490),
    ('Louisville', 'Kentucky', '40202', 38.2527, -85.7585),
    ('Baltimore', 'Maryland', '21202', 39.2904, -76.6122),
    ('Milwaukee', 'Wisconsin', '53202', 43.0389, -87.9065),
    ('Albuquerque', 'New Mexico', '87102', 35.0844, -106.6504),
    ('Kansas City', 'Missouri', '64106', 39.0997, -94.5786),
    ('Atlanta', 'Georgia', '30303', 33.7490, -84.3880),
    ('Miami', 'Florida', '33130', 25.7617, -80.1918),
    ('Minneapolis', 'Minnesota', '55401', 44.9778, -93.2650),
    ('New Orleans', 'Louisiana', '70112', 29.9511, -90.0715),
    ('Salt Lake City', 'Utah', '84101', 40.7608, -111.8910),
    ('St. Louis', 'Missouri', '63101', 38.6270, -90.1994),
    ('Pittsburgh', 'Pennsylvania', '15222', 40.4406, -79.9959),
    ('Tampa', 'Florida', '33602', 27.9506, -82.4572),
    ('Orlando', 'Florida', '32801', 28.5383, -81.3792),
    ('Sacramento', 'California', '95814', 38.5816, -121.4944),
    ('Raleigh', 'North Carolina', '27601', 35.7796, -78.6382),
    ('Omaha', 'Nebraska', '68102', 41.2565, -95.9345),
    ('Little Rock', 'Arkansas', '72201', 34.7465, -92.2896),
    ('Birmingham', 'Alabama', '35203', 33.5186, -86.8104),
    ('Boise', 'Idaho', '83702', 43.6150, -116.2023),
    ('Des Moines', 'Iowa', '50309', 41.5868, -93.6250),
    ('Richmond', 'Virginia', '23219', 37.5407, -77.4360),
]


def encode_geohash(latd: float, long: float, precision: int = GEOHASH_PRECISION) -> str:
    lat_range, long_range = [-90.0, 90.0], [-180.0, 180.0]
    chars, bits, bit_count, even = [], 0, 0, True
    while len(chars) < precision:
        rng, value = (long_range, long) if even else (lat_range, latd)
        mid = (rng[0] + rng[1]) / 2
        if value >= mid:
            bits = (bits << 1) | 1
            rng[0] = mid
        else:
            bits <<= 1
            rng[1] = mid
        even = not even
        bit_count += 1
        if bit_count == 5:
            chars.append(BASE32[bits])
            bits = bit_count = 0
    return ''.join(chars)


def random_point_near(latd: float, long: float, radius_km: float) -> tuple:
    """Uniform random point within radius_km of (latd, long)."""
    distance = radius_km * math.sqrt(random.random())
    bearing = random.uniform(0, 2 * math.pi)
    dlat = distance * math.cos(bearing) / 111.32
    dlong = distance * math.sin(bearing) / (111.32 * math.cos(math.radians(latd)))
    return round(latd + dlat, 7), round(long + dlong, 7)


def build_geo_meta(latd: float, long: float, geo_hash: str, city: str, state: str, postcode: str) -> dict:
    """Same shape pushLocation.js stores (device coords + reverse-geocoded address)."""
    return {
        'latd': latd,
        'long': long,
        'accuracy': 5,
        'altitude': 0,
        'altitudeAccuracy': 0.5,
        'heading': 0,
        'speed': 0,
        'timestamp': int(time.time() * 1000),
        'geo_hash': geo_hash,
        'display_name': f"{city}, {state}, {postcode}, United States",
        'neighbourhood': 'unknown',
        'city': city,
        'country': 'United States',
        'state': state,
        'postcode': postcode,
        'road': 'unknown',
        'street': 'unknown',
    }


def simulate(conn, limit: int, radius_km: float, dry_run: bool):
    cursor = conn.cursor()
    cursor.execute(
        "SELECT user_id FROM users WHERE geo_hash IS NULL OR geo_hash = '' LIMIT %s",
        (limit,),
    )
    user_ids = [str(row[0]) for row in cursor.fetchall()]
    print(f"Found {len(user_ids)} users without a geo_hash")

    updated = 0
    for user_id in user_ids:
        city, state, postcode, city_latd, city_long = random.choice(CITIES)
        latd, long = random_point_near(city_latd, city_long, radius_km)
        geo_hash = encode_geohash(latd, long)
        geo_meta = build_geo_meta(latd, long, geo_hash, city, state, postcode)
        label = f"{user_id} -> {geo_hash} ({latd}, {long}) {city}, {state}"
        if dry_run:
            print(f"[DRY RUN] Would set: {label}")
        else:
            cursor.execute(
                """UPDATE users SET geo_hash = %s, geo_latd = %s, geo_long = %s, geo_meta = %s
                   WHERE user_id = %s""",
                (geo_hash, latd, long, json.dumps(geo_meta), user_id),
            )
            print(f"✅ {label}")
        updated += 1

    if not dry_run:
        conn.commit()
    cursor.close()
    print_summary('Random Geo', updated, 0)
