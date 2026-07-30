const express = require('express');
const bcrypt = require('bcrypt');
const router = express.Router();

// Mock database functions — replace with your actual DB client (e.g., pg, Prisma)
const db = require('../db'); 
const { calculateSimilarityScore } = require('../utils/keystrokeMatcher');

const ENROLLMENT_REQUIRED_COUNT = 5;
const MAX_TYPING_FAILURES = 3;
const MATCH_THRESHOLD = 0.85; // 85% confidence required

/**
 * POST /api/auth/login
 * Body: { username, password, typingData: { holdTimes: [...], flightTimes: [...] } }
 */
router.post('/login', async (req, res) => {
    const { username, password, typingData } = req.body;

    try {
        // Step A: Password Validation First
        const user = await db.findUserByUsername(username);
        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const isPasswordValid = await bcrypt.compare(password, user.password_hash);
        if (!isPasswordValid) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Step B: Check Enrollment Status
        if (!user.is_enrolled) {
            // Store raw sample for training baseline
            await db.saveEnrollmentSample(user.id, typingData);
            const sampleCount = await db.getEnrollmentSampleCount(user.id);

            if (sampleCount >= ENROLLMENT_REQUIRED_COUNT) {
                // Generate mean & std metrics from collected 5 samples
                await db.buildAndSaveTypingProfile(user.id);
                await db.updateUser(user.id, { is_enrolled: true });
                
                return res.status(200).json({ 
                    status: 'ENROLLMENT_COMPLETE', 
                    message: 'Typing profile created successfully. Please log in again.' 
                });
            }

            return res.status(200).json({ 
                status: 'ENROLLMENT_IN_PROGRESS', 
                samplesRemaining: ENROLLMENT_REQUIRED_COUNT - sampleCount 
            });
        }

        // Step C: Verify Keystroke Dynamics for Enrolled User
        const profile = await db.getTypingProfile(user.id);
        const matchScore = calculateSimilarityScore(typingData, profile);

        if (matchScore < MATCH_THRESHOLD) {
            const newFailureCount = user.failed_typing_attempts + 1;

            if (newFailureCount >= MAX_TYPING_FAILURES) {
                // Reset baseline upon reaching 3 consecutive failures
                await db.resetUserTypingProfile(user.id);
                return res.status(403).json({
                    error: 'Typing pattern verification failed repeatedly. Baseline reset. Re-enrollment required.',
                    requiresReenrollment: true
                });
            } else {
                await db.updateUser(user.id, { failed_typing_attempts: newFailureCount });
                return res.status(403).json({
                    error: 'Typing profile mismatch. Access denied.',
                    attemptsRemaining: MAX_TYPING_FAILURES - newFailureCount
                });
            }
        }

        // Step D: Successful Authentication
        await db.updateUser(user.id, { failed_typing_attempts: 0 });

        // Issue JWT or create session here
        return res.status(200).json({ 
            status: 'SUCCESS', 
            message: 'Authenticated successfully!',
            score: matchScore 
        });

    } catch (err) {
        console.error('Auth Error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;