const db = require('../db');

/**
 * Deletes raw enrollment sample timing vectors after user profile creation
 * to minimize exposure of unaggregated biometric data.
 */
async function purgeRawEnrollmentSamples(userId) {
    try {
        const result = await db.query(
            'DELETE FROM enrollment_samples WHERE user_id = $1',
            [userId]
        );
        console.log(`[DATA CLEANUP] Purged ${result.rowCount} raw enrollment samples for User ID: ${userId}`);
        return result.rowCount;
    } catch (err) {
        console.error(`[DATA CLEANUP ERROR] Failed to purge samples for User ID ${userId}:`, err);
        throw err;
    }
}

module.exports = { purgeRawEnrollmentSamples };