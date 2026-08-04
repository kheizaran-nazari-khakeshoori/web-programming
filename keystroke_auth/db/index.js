const { Pool } = require('pg');

const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'keystroke_db',
    password: process.env.DB_PASSWORD || 'password',
    port: process.env.DB_PORT || 5432,
});

module.exports = {
    query: (text, params) => pool.query(text, params),

    // User operations
    async findUserByUsername(username) {
        const { rows } = await pool.query(
            'SELECT * FROM users WHERE username = $1',
            [username]
        );
        return rows[0] || null;
    },

    async createUser(username, passwordHash) {
        const { rows } = await pool.query(
            'INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING id, username, is_enrolled',
            [username, passwordHash]
        );
        return rows[0];
    },

    async updateUser(userId, updates) {
        const fields = [];
        const values = [];
        let idx = 1;

        for (const [key, val] of Object.entries(updates)) {
            fields.push(`${key} = $${idx}`);
            values.push(val);
            idx++;
        }

        values.push(userId);
        const sql = `UPDATE users SET ${fields.join(', ')}, updated_at = NOW() WHERE id = $${idx} RETURNING *`;
        const { rows } = await pool.query(sql, values);
        return rows[0];
    },

    // Sample and Profile operations
    async saveEnrollmentSample(userId, sampleIndex, timingData) {
        const { holdTimes, flightTimes } = timingData;
        const { rows } = await pool.query(
            `INSERT INTO enrollment_samples (user_id, sample_index, hold_times, flight_times) 
             VALUES ($1, $2, $3, $4) RETURNING *`,
            [userId, sampleIndex, JSON.stringify(holdTimes), JSON.stringify(flightTimes)]
        );
        return rows[0];
    },

    async getEnrollmentSampleCount(userId) {
        const { rows } = await pool.query(
            'SELECT COUNT(*)::int AS count FROM enrollment_samples WHERE user_id = $1',
            [userId]
        );
        return rows[0].count;
    },

    async getTypingProfile(userId) {
        const { rows } = await pool.query(
            'SELECT * FROM typing_profiles WHERE user_id = $1',
            [userId]
        );
        return rows[0] || null;
    },

    async saveTypingProfile(userId, phrase, profileData) {
        const { meanHoldTimes, stdHoldTimes, meanFlightTimes, stdFlightTimes } = profileData;
        const { rows } = await pool.query(
            `INSERT INTO typing_profiles 
             (user_id, target_phrase, mean_hold_times, std_hold_times, mean_flight_times, std_flight_times)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (user_id) 
             DO UPDATE SET 
                mean_hold_times = EXCLUDED.mean_hold_times,
                std_hold_times = EXCLUDED.std_hold_times,
                mean_flight_times = EXCLUDED.mean_flight_times,
                std_flight_times = EXCLUDED.std_flight_times,
                updated_at = NOW()
             RETURNING *`,
            [
                userId,
                phrase,
                JSON.stringify(meanHoldTimes),
                JSON.stringify(stdHoldTimes),
                JSON.stringify(meanFlightTimes),
                JSON.stringify(stdFlightTimes)
            ]
        );
        return rows[0];
    },

    async resetUserTypingProfile(userId) {
        await pool.query('DELETE FROM enrollment_samples WHERE user_id = $1', [userId]);
        await pool.query('DELETE FROM typing_profiles WHERE user_id = $1', [userId]);
        await pool.query(
            'UPDATE users SET is_enrolled = FALSE, failed_typing_attempts = 0 WHERE id = $1',
            [userId]
        );
    }

    
};
// Add this helper function to db/index.js
async function getEnrollmentSamples(userId) {
    const { rows } = await pool.query(
        'SELECT hold_times AS "holdTimes", flight_times AS "flightTimes" FROM enrollment_samples WHERE user_id = $1 ORDER BY sample_index ASC',
        [userId]
    );
    return rows;
}