-- Users Table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    is_enrolled BOOLEAN DEFAULT FALSE,
    failed_typing_attempts INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Enrollment Raw Samples (Used during initial 5 baseline steps)
CREATE TABLE enrollment_samples (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    hold_times JSONB NOT NULL,       -- Array of key hold durations (ms)
    flight_times JSONB NOT NULL,     -- Array of latency between keys (ms)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Aggregated Keystroke Profile (Calculated mean & standard deviation after 5 samples)
CREATE TABLE typing_profiles (
    user_id INT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    mean_hold_times JSONB NOT NULL,
    std_hold_times JSONB NOT NULL,
    mean_flight_times JSONB NOT NULL,
    std_flight_times JSONB NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);