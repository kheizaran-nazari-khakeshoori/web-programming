import Database from 'better-sqlite3';

const database = new Database('data.sqlite');

database.pragma('journal_mode = WAL');

database.exec(`
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
    threshold REAL NOT NULL DEFAULT 0,
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
`);

export function getUserByUsername(username) {
  return database.prepare('SELECT * FROM users WHERE username = ?').get(username);
}

export function createUser(username, passwordHash) {
  const result = database
    .prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)')
    .run(username, passwordHash);

  return getUserById(result.lastInsertRowid);
}

export function getUserById(id) {
  return database.prepare('SELECT * FROM users WHERE id = ?').get(id);
}

export function upsertTypingProfile({ userId, phrase, holdTimes, flightTimes, threshold }) {
  const existing = database.prepare('SELECT * FROM typing_profiles WHERE user_id = ?').get(userId);

  if (existing) {
    database
      .prepare(
        `UPDATE typing_profiles
         SET phrase = ?, sample_count = sample_count + 1, avg_hold_json = ?, avg_flight_json = ?, threshold = ?, updated_at = CURRENT_TIMESTAMP
         WHERE user_id = ?`
      )
      .run(phrase, JSON.stringify(holdTimes), JSON.stringify(flightTimes), threshold, userId);
  } else {
    database
      .prepare(
        `INSERT INTO typing_profiles (user_id, phrase, sample_count, avg_hold_json, avg_flight_json, threshold)
         VALUES (?, ?, 1, ?, ?, ?)`
      )
      .run(userId, phrase, JSON.stringify(holdTimes), JSON.stringify(flightTimes), threshold);
  }

  return getTypingProfileByUserId(userId);
}

export function addTypingSample({ userId, phrase, holdTimes, flightTimes }) {
  database
    .prepare(
      `INSERT INTO typing_samples (user_id, phrase, hold_json, flight_json)
       VALUES (?, ?, ?, ?)`
    )
    .run(userId, phrase, JSON.stringify(holdTimes), JSON.stringify(flightTimes));
}

export function getTypingProfileByUserId(userId) {
  return database.prepare('SELECT * FROM typing_profiles WHERE user_id = ?').get(userId);
}

export function listTypingSamples(userId) {
  return database.prepare('SELECT * FROM typing_samples WHERE user_id = ? ORDER BY created_at DESC').all(userId);
}
