-- Users Table
-- Create database schema for Keystroke Dynamics Authentication System

-- 1. Primary Users Table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    is_enrolled BOOLEAN DEFAULT FALSE NOT NULL,
    failed_typing_attempts INT DEFAULT 0 NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Enrolled Raw Typing Samples Table
-- Stores the individual samples collected during the 5 baseline logins.
CREATE TABLE enrollment_samples (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    sample_index INT NOT NULL,                  -- Sample 1 through 5
    hold_times JSONB NOT NULL,                 -- Array of hold durations (ms): [112, 98, 105, ...]
    flight_times JSONB NOT NULL,               -- Array of latencies between key presses (ms): [45, 60, 52, ...]
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Aggregated Keystroke Dynamics Profile Table
-- Holds computed vector statistics (average and standard deviation) used for similarity scoring.
CREATE TABLE typing_profiles (
    id SERIAL PRIMARY KEY,
    user_id INT UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    target_phrase VARCHAR(255) NOT NULL,       -- The baseline phrase typed during enrollment
    mean_hold_times JSONB NOT NULL,            -- Array of mean hold times per key position
    std_hold_times JSONB NOT NULL,             -- Array of standard deviation hold times per key position
    mean_flight_times JSONB NOT NULL,          -- Array of mean flight times per key pair
    std_flight_times JSONB NOT NULL,           -- Array of standard deviation flight times per key pair
    sample_count INT DEFAULT 5 NOT NULL,       -- Number of samples used to create profile
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for optimal lookup performance
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_enrollment_samples_user ON enrollment_samples(user_id);
CREATE INDEX idx_typing_profiles_user ON typing_profiles(user_id);db            