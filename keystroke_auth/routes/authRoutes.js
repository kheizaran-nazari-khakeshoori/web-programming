const express = require('express');
const bcrypt = require('bcrypt');
const router = express.Router();

const db = require('../db');
const { buildProfileFromSamples, calculateSimilarityScore } = require('../utils/keystrokeMatcher');

const TARGET_PHRASE = "security-by-typing";
const ENROLLMENT_REQUIRED_COUNT = 5;
const MAX_TYPING_FAILURES = 3;
const MATCH_THRESHOLD = 0.85;

/**
 * POST /api/auth/register
 * Body: { username, password }
 */
router.post('/register', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required.' });
    }

    try {
        const existingUser = await db.findUserByUsername(username);
        if (existingUser) {
            return res.status(409).json({ error: 'Username already taken.' });
        }

        const passwordHash = await bcrypt.hash(password, 10);
        const newUser = await db.createUser(username, passwordHash);

        return res.status(201).json({
            message: 'User created successfully! Please proceed to complete 5 enrollment logins.',
            userId: newUser.id
        });
    } catch (err) {
        console.error('Registration Error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * POST /api/auth/login
 * Body: { username, password, typingData: { holdTimes: [...], flightTimes: [...] } }
 */
router.post('/login', async (req, res) => {
    const { username, password, typingData } = req.body;

    if (!username || !password || !typingData) {
        return res.status(400).json({ error: 'Missing required credentials or typing data.' });
    }

    try {
        // Step A: Password Validation
        const user = await db.findUserByUsername(username);
        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials.' });
        }

        const isPasswordValid = await bcrypt.compare(password, user.password_hash);
        if (!isPasswordValid) {
            return res.status(401).json({ error: 'Invalid credentials.' });
        }

        // Step B: Profile Enrollment Flow (If user is not enrolled)
        if (!user.is_enrolled) {
            const currentSampleCount = await db.getEnrollmentSampleCount(user.id);
            const nextSampleIndex = currentSampleCount + 1;

            // Save raw sample N
            await db.saveEnrollmentSample(user.id, nextSampleIndex, typingData);

            if (nextSampleIndex < ENROLLMENT_REQUIRED_COUNT) {
                const remaining = ENROLLMENT_REQUIRED_COUNT - nextSampleIndex;
                return res.status(200).json({
                    status: 'ENROLLMENT_IN_PROGRESS',
                    message: `Enrollment sample ${nextSampleIndex}/${ENROLLMENT_REQUIRED_COUNT} saved. Please type the phrase ${remaining} more time(s).`,
                    samplesRemaining: remaining
                });
            }

            // Exactly 5 samples collected: Aggregate baseline profile statistics
            const samples = await db.getEnrollmentSamples(user.id);
            const aggregatedProfile = buildProfileFromSamples(samples);

            // Store summary statistics (means and std deviations)
            await db.saveTypingProfile(user.id, TARGET_PHRASE, aggregatedProfile);
            await db.updateUser(user.id, { is_enrolled: true });

            return res.status(200).json({
                status: 'ENROLLMENT_COMPLETE',
                message: 'Typing profile baseline successfully created! You can now log in using your behavioral biometric profile.'
            });
        }

        // Step C: Verify Keystroke Dynamics for Enrolled User
        const profile = await db.getTypingProfile(user.id);
        const matchScore = calculateSimilarityScore(typingData, profile);

        if (matchScore < MATCH_THRESHOLD) {
            const newFailureCount = user.failed_typing_attempts + 1;

            if (newFailureCount >= MAX_TYPING_FAILURES) {
                await db.resetUserTypingProfile(user.id);
                return res.status(403).json({
                    error: 'Typing pattern mismatch limit reached. Profile baseline reset. Re-enrollment required.',
                    requiresReenrollment: true
                });
            } else {
                await db.updateUser(user.id, { failed_typing_attempts: newFailureCount });
                return res.status(403).json({
                    error: `Typing pattern mismatch (${Math.round(matchScore * 100)}% match). Access denied.`,
                    attemptsRemaining: MAX_TYPING_FAILURES - newFailureCount
                });
            }
        }

        // Step D: Successful Authentication
        await db.updateUser(user.id, { failed_typing_attempts: 0 });

        return res.status(200).json({
            status: 'SUCCESS',
            message: 'Authenticated successfully!',
            confidenceScore: `${Math.round(matchScore * 100)}%`
        });

    } catch (err) {
        console.error('Auth Error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;