from __future__ import annotations

import json
import os
import sqlite3
import time
from collections import defaultdict, deque
from dataclasses import dataclass
from functools import wraps
from pathlib import Path
from typing import Any

from flask import Flask, abort, g, jsonify, render_template, request, session
from werkzeug.security import check_password_hash, generate_password_hash


BASE_DIR = Path(__file__).resolve().parent
INSTANCE_DIR = BASE_DIR / 'instance'
DATABASE_PATH = INSTANCE_DIR / 'keystroke.sqlite'
DEFAULT_PHRASE = 'secure access'
DEFAULT_THRESHOLD = 72.0
REQUEST_WINDOW_SECONDS = 60
REQUEST_LIMIT = 30

app = Flask(__name__)
app.config.update(
    SECRET_KEY=os.environ.get('SECRET_KEY', 'dev-keystroke-secret'),
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE='Lax',
    SESSION_COOKIE_SECURE=os.environ.get('SESSION_COOKIE_SECURE', 'false').lower() == 'true',
)

REQUEST_LOG: dict[str, deque[float]] = defaultdict(deque)


@dataclass(frozen=True)
class TypingFeatures:
    hold_times: list[float]
    flight_times: list[float]


def ensure_instance_folder() -> None:
    INSTANCE_DIR.mkdir(parents=True, exist_ok=True)


def get_db() -> sqlite3.Connection:
    if 'db' not in g:
        ensure_instance_folder()
        connection = sqlite3.connect(DATABASE_PATH)
        connection.row_factory = sqlite3.Row
        connection.execute('PRAGMA foreign_keys = ON')
        g.db = connection
    return g.db


@app.teardown_appcontext
def close_db(_exception: BaseException | None) -> None:
    connection = g.pop('db', None)
    if connection is not None:
        connection.close()


def init_db() -> None:
    ensure_instance_folder()
    database = sqlite3.connect(DATABASE_PATH)
    database.executescript(
        '''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS typing_profiles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL UNIQUE,
            phrase TEXT NOT NULL,
            sample_count INTEGER NOT NULL DEFAULT 0,
            avg_hold_json TEXT NOT NULL,
            avg_flight_json TEXT NOT NULL,
            threshold REAL NOT NULL DEFAULT 72,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS typing_samples (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            phrase TEXT NOT NULL,
            hold_json TEXT NOT NULL,
            flight_json TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
        '''
    )
    database.commit()
    database.close()


def clamp_number(value: Any) -> float | None:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None

    if not (number == number and number != float('inf') and number != float('-inf')):
        return None

    return round(number, 2)


def normalize_vector(values: list[float], target_length: int = 8) -> list[float]:
    vector = [round(value, 2) for value in values if isinstance(value, (int, float))]

    if not vector:
        return [0.0] * target_length

    if len(vector) > target_length:
        return vector[:target_length]

    padded = list(vector)
    while len(padded) < target_length:
        padded.append(padded[-1])

    return padded


def build_features(hold_times: list[float], flight_times: list[float]) -> TypingFeatures:
    return TypingFeatures(
        hold_times=normalize_vector(hold_times),
        flight_times=normalize_vector(flight_times),
    )


def mean(values: list[float]) -> float:
    return round(sum(values) / len(values), 2) if values else 0.0


def euclidean_distance(left: list[float], right: list[float]) -> float:
    length = max(len(left), len(right))
    total = 0.0

    for index in range(length):
        left_value = left[index] if index < len(left) else left[-1] if left else 0.0
        right_value = right[index] if index < len(right) else right[-1] if right else 0.0
        delta = left_value - right_value
        total += delta * delta

    return round((total / max(1, length)) ** 0.5, 2)


def compare_typing_samples(expected_profile: dict[str, Any], attempt_sample: TypingFeatures) -> dict[str, Any]:
    hold_distance = euclidean_distance(expected_profile['hold_times'], attempt_sample.hold_times)
    flight_distance = euclidean_distance(expected_profile['flight_times'], attempt_sample.flight_times)
    combined_distance = round((hold_distance * 0.6) + (flight_distance * 0.4), 2)
    confidence = round(max(0.0, 100.0 - combined_distance * 1.4), 2)

    return {
        'accepted': confidence >= float(expected_profile['threshold']),
        'confidence': confidence,
        'holdDistance': hold_distance,
        'flightDistance': flight_distance,
        'combinedDistance': combined_distance,
    }


def request_payload() -> dict[str, Any]:
    payload = request.get_json(silent=True)
    return payload if isinstance(payload, dict) else {}


def valid_feature_payload(payload: dict[str, Any]) -> tuple[str, list[float], list[float]] | None:
    phrase = payload.get('phrase', '')
    phrase = phrase.strip() if isinstance(phrase, str) else ''

    raw_hold_times = payload.get('holdTimes', [])
    raw_flight_times = payload.get('flightTimes', [])

    if not phrase or not isinstance(raw_hold_times, list) or not isinstance(raw_flight_times, list):
        return None

    hold_times = [value for value in (clamp_number(item) for item in raw_hold_times) if value is not None]
    flight_times = [value for value in (clamp_number(item) for item in raw_flight_times) if value is not None]

    if not hold_times or not flight_times:
        return None

    return phrase, hold_times, flight_times


def get_user_by_username(username: str) -> sqlite3.Row | None:
    return get_db().execute('SELECT * FROM users WHERE username = ?', (username,)).fetchone()


def get_user_by_id(user_id: int) -> sqlite3.Row | None:
    return get_db().execute('SELECT * FROM users WHERE id = ?', (user_id,)).fetchone()


def get_typing_profile_by_user_id(user_id: int) -> sqlite3.Row | None:
    return get_db().execute('SELECT * FROM typing_profiles WHERE user_id = ?', (user_id,)).fetchone()


def create_user(username: str, password_hash: str) -> sqlite3.Row:
    database = get_db()
    cursor = database.execute(
        'INSERT INTO users (username, password_hash) VALUES (?, ?)',
        (username, password_hash),
    )
    database.commit()
    return get_user_by_id(cursor.lastrowid)


def add_typing_sample(user_id: int, phrase: str, hold_times: list[float], flight_times: list[float]) -> None:
    database = get_db()
    database.execute(
        'INSERT INTO typing_samples (user_id, phrase, hold_json, flight_json) VALUES (?, ?, ?, ?)',
        (user_id, phrase, json.dumps(hold_times), json.dumps(flight_times)),
    )
    database.commit()


def save_typing_profile(
    user_id: int,
    phrase: str,
    hold_times: list[float],
    flight_times: list[float],
    threshold: float = DEFAULT_THRESHOLD,
) -> sqlite3.Row:
    database = get_db()
    existing = get_typing_profile_by_user_id(user_id)

    if existing:
        previous_hold_times = json.loads(existing['avg_hold_json'])
        previous_flight_times = json.loads(existing['avg_flight_json'])
        sample_count = int(existing['sample_count'])

        new_hold_times = [
            round(((previous_hold_times[index] * sample_count) + value) / (sample_count + 1), 2)
            for index, value in enumerate(hold_times)
        ]
        new_flight_times = [
            round(((previous_flight_times[index] * sample_count) + value) / (sample_count + 1), 2)
            for index, value in enumerate(flight_times)
        ]

        database.execute(
            '''
            UPDATE typing_profiles
            SET phrase = ?, sample_count = sample_count + 1, avg_hold_json = ?, avg_flight_json = ?, threshold = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE user_id = ?
            ''',
            (phrase, json.dumps(new_hold_times), json.dumps(new_flight_times), threshold, user_id),
        )
    else:
        database.execute(
            '''
            INSERT INTO typing_profiles (user_id, phrase, sample_count, avg_hold_json, avg_flight_json, threshold)
            VALUES (?, ?, 1, ?, ?, ?)
            ''',
            (user_id, phrase, json.dumps(hold_times), json.dumps(flight_times), threshold),
        )

    database.commit()
    return get_typing_profile_by_user_id(user_id)


def rate_limited(view_func):
    @wraps(view_func)
    def wrapper(*args, **kwargs):
        client_ip = request.headers.get('X-Forwarded-For', request.remote_addr or 'unknown')
        current_time = time.time()
        bucket = REQUEST_LOG[client_ip]

        while bucket and current_time - bucket[0] > REQUEST_WINDOW_SECONDS:
            bucket.popleft()

        if len(bucket) >= REQUEST_LIMIT:
            abort(429, description='Too many requests. Please try again shortly.')

        bucket.append(current_time)
        return view_func(*args, **kwargs)

    return wrapper


@app.after_request
def add_security_headers(response):
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['X-Frame-Options'] = 'DENY'
    response.headers['Referrer-Policy'] = 'no-referrer'
    return response


@app.route('/')
def index():
    return render_template('index.html', default_phrase=DEFAULT_PHRASE)


@app.route('/api/health')
def health():
    return jsonify({'ok': True})


@app.post('/api/register')
@rate_limited
def register():
    payload = request_payload()
    username = payload.get('username', '')
    password = payload.get('password', '')

    username = username.strip().lower() if isinstance(username, str) else ''

    if not username or not isinstance(password, str) or len(password) < 8:
        return jsonify({'message': 'Username and password are required.'}), 400

    if get_user_by_username(username):
        return jsonify({'message': 'Username already exists.'}), 409

    user = create_user(username, generate_password_hash(password))
    session['user_id'] = user['id']

    return jsonify(
        {
            'message': 'Account created. Enroll a typing profile next.',
            'user': {'id': user['id'], 'username': user['username']},
        }
    ), 201


@app.post('/api/enroll')
@rate_limited
def enroll():
    payload = request_payload()
    parsed = valid_feature_payload(payload)

    if parsed is None:
        return jsonify({'message': 'Valid username, phrase, and typing data are required.'}), 400

    username = payload.get('username', '')
    username = username.strip().lower() if isinstance(username, str) else ''

    if not username:
        return jsonify({'message': 'Username is required.'}), 400

    user = get_user_by_username(username)

    if not user:
        return jsonify({'message': 'Account not found.'}), 404

    phrase, hold_times, flight_times = parsed
    features = build_features(hold_times, flight_times)
    add_typing_sample(user['id'], phrase, features.hold_times, features.flight_times)
    profile = save_typing_profile(user['id'], phrase, features.hold_times, features.flight_times)

    return jsonify(
        {
            'message': 'Typing profile saved.',
            'profile': {
                'phrase': profile['phrase'],
                'sampleCount': profile['sample_count'],
                'threshold': profile['threshold'],
                'holdTimes': json.loads(profile['avg_hold_json']),
                'flightTimes': json.loads(profile['avg_flight_json']),
            },
        }
    )


@app.post('/api/login')
@rate_limited
def login():
    payload = request_payload()
    parsed = valid_feature_payload(payload)

    username = payload.get('username', '')
    password = payload.get('password', '')
    username = username.strip().lower() if isinstance(username, str) else ''

    if not username or not isinstance(password, str) or parsed is None:
        return jsonify({'message': 'Username, password, phrase, and typing data are required.'}), 400

    user = get_user_by_username(username)

    if not user or not check_password_hash(user['password_hash'], password):
        return jsonify({'message': 'Invalid login.'}), 401

    profile = get_typing_profile_by_user_id(user['id'])

    if not profile:
        return jsonify({'message': 'Typing profile has not been enrolled yet.'}), 409

    phrase, hold_times, flight_times = parsed

    if profile['phrase'] != phrase:
        return jsonify({'message': 'Phrase does not match the enrolled profile.'}), 401

    attempt_features = build_features(hold_times, flight_times)
    comparison = compare_typing_samples(
        {
            'hold_times': json.loads(profile['avg_hold_json']),
            'flight_times': json.loads(profile['avg_flight_json']),
            'threshold': profile['threshold'],
        },
        attempt_features,
    )

    session['user_id'] = user['id']

    return jsonify(
        {
            'message': 'Authentication successful.' if comparison['accepted'] else 'Typing pattern rejected.',
            'authenticated': comparison['accepted'],
            'confidence': comparison['confidence'],
            'holdDistance': comparison['holdDistance'],
            'flightDistance': comparison['flightDistance'],
            'combinedDistance': comparison['combinedDistance'],
        }
    )


@app.get('/api/profile/<username>')
def profile(username: str):
    normalized_username = username.strip().lower()
    user = get_user_by_username(normalized_username)

    if not user:
        return jsonify({'message': 'Account not found.'}), 404

    profile_row = get_typing_profile_by_user_id(user['id'])

    if not profile_row:
        return jsonify({'message': 'Typing profile not found.'}), 404

    return jsonify(
        {
            'username': user['username'],
            'profile': {
                'phrase': profile_row['phrase'],
                'sampleCount': profile_row['sample_count'],
                'threshold': profile_row['threshold'],
                'holdTimes': json.loads(profile_row['avg_hold_json']),
                'flightTimes': json.loads(profile_row['avg_flight_json']),
            },
        }
    )


@app.errorhandler(429)
def too_many_requests(error):
    return jsonify({'message': getattr(error, 'description', 'Too many requests.')}), 429


@app.errorhandler(404)
def not_found(error):
    if request.path.startswith('/api/'):
        return jsonify({'message': 'Not found.'}), 404
    return render_template('index.html', default_phrase=DEFAULT_PHRASE), 404


init_db()


if __name__ == '__main__':
    app.run(debug=True, port=int(os.environ.get('PORT', '3000')))
