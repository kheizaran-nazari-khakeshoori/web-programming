const express = require('express');
const bcrypt = require('bcrypt');
const router = express.Router();

const db = require('../db');
const { validateTimingData } = require('../middleware/validateTiming');
const { logAuthDecision } = require('../middleware/auditLogger');
const { evaluateKeystrokeAttempt } = require('../services/scoringService');
const { buildProfileFromSamples } = require('../utils/keystrokeMatcher');
const { TARGET_PHRASE, ENROLLMENT_REQUIRED_COUNT, MAX_TYPING_FAILURES } = require('../config/constants');

/**
 * POST /api/auth/register
 * Register a new user account
 */
router.post('/register', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required.' });
    }

    try {
        const existingUser = await db.findUserByUsername(username);
        if (existingUser) {
            logAuthDecision('USER_REGISTRATION_FAILED', { username, reason: 'Username conflict' });
            return res.status(409).json({ error: 'Username already taken.' });
        }

        const passwordHash = await bcrypt.hash(password, 10);
        const newUser = await db.createUser(username, passwordHash);

        logAuthDecision('USER_REGISTERED', { username, status: 'SUCCESS', userId: newUser.id });
        return res.status(201).json({
            message: 'User created successfully! Please complete 5 enrollment samples.',
            userId: newUser.id
        });
    } catch (err) {
        console.error('Registration Error:', err);
        return res.status(500).json({ error: 'Internal server error.' });
    }
});

/**
 * GET /api/auth/profile/:username
 * Fetch baseline profile statistics for a user (excluding password)
 */
router.get('/profile/:username', async (req, res) => {
    const { username } = req.params;

    try {
        const user = await db.findUserByUsername(username);
        if (!user) {
            return res.status(404).json({ error: 'User not found.' });
        }

        if (!user.is_enrolled) {
            return res.status(200).json({
                username: user.username,
                isEnrolled: false,
                message: 'User has not completed profile enrollment.'
            });
        }

        const profile = await db.getTypingProfile(user.id);
        return res.status(200).json({
            username: user.username,
            isEnrolled: true,
            targetPhrase: profile.target_phrase,
            metrics: {
                meanHoldTimes: profile.mean_hold_times,
                meanFlightTimes: profile.mean_flight_times,
                updatedAt: profile.updated_at
            }
        });
    } catch (err) {
        console.error('Fetch Profile Error:', err);
        return res.status(500).json({ error: 'Internal server error.' });
    }
});

/**
 * POST /api/auth/login
 * Validates password, collects enrollment samples, or evaluates keystroke similarity
 */
router.post('/login', validateTimingData, async (req, res) => {
    const { username, password, typingData } = req.body;

    try {
        const user = await db.findUserByUsername(username);
        if (!user) {
            logAuthDecision('LOGIN_FAILED', { username, reason: 'User not found' });
            return res.status(401).json({ error: 'Invalid credentials.' });
        }

        const isPasswordValid = await bcrypt.compare(password, user.password_hash);
        if (!isPasswordValid) {
            logAuthDecision('LOGIN_FAILED', { username, reason: 'Invalid password' });
            return res.status(401).json({ error: 'Invalid credentials.' });
        }

        // Enrollment Flow
        if (!user.is_enrolled) {
            const currentSampleCount = await db.getEnrollmentSampleCount(user.id);
            const nextSampleIndex = currentSampleCount + 1;

            await db.saveEnrollmentSample(user.id, nextSampleIndex, typingData);

            if (nextSampleIndex < ENROLLMENT_REQUIRED_COUNT) {
                const remaining = ENROLLMENT_REQUIRED_COUNT - nextSampleIndex;
                logAuthDecision('ENROLLMENT_SAMPLE_ADDED', { username, status: 'SUCCESS', sampleIndex: nextSampleIndex });
                return res.status(200).json({
                    status: 'ENROLLMENT_IN_PROGRESS',
                    message: `Sample ${nextSampleIndex}/${ENROLLMENT_REQUIRED_COUNT} stored. ${remaining} remaining.`,
                    samplesRemaining: remaining
                });
            }

            const samples = await db.getEnrollmentSamples(user.id);
            const aggregatedProfile = buildProfileFromSamples(samples);

            await db.saveTypingProfile(user.id, TARGET_PHRASE, aggregatedProfile);
            await db.updateUser(user.id, { is_enrolled: true });

            logAuthDecision('ENROLLMENT_COMPLETED', { username, status: 'SUCCESS' });
            return res.status(200).json({
                status: 'ENROLLMENT_COMPLETE',
                message: 'Profile baseline established. Behavioral biometric active.'
            });
        }

        // Verification Flow
        const profile = await db.getTypingProfile(user.id);
        const result = evaluateKeystrokeAttempt(typingData, profile);

        if (!result.isMatch) {
            const newFailureCount = user.failed_typing_attempts + 1;

            if (newFailureCount >= MAX_TYPING_FAILURES) {
                await db.resetUserTypingProfile(user.id);
                logAuthDecision('KEYSTROKE_FAILURE_LOCKOUT', { username, score: result.percentage, reason: 'Exceeded max failures' });
                return res.status(403).json({
                    error: 'Repeated keystroke verification failures. Baseline reset. Re-enrollment required.',
                    score: result.percentage,
                    requiresReenrollment: true
                });
            } else {
                await db.updateUser(user.id, { failed_typing_attempts: newFailureCount });
                logAuthDecision('KEYSTROKE_MISMATCH', { username, score: result.percentage, attempt: newFailureCount });
                return res.status(403).json({
                    error: `Keystroke dynamics mismatch (${result.percentage} score).`,
                    score: result.percentage,
                    breakdown: result.breakdown,
                    attemptsRemaining: MAX_TYPING_FAILURES - newFailureCount
                });
            }
        }

        await db.updateUser(user.id, { failed_typing_attempts: 0 });
        logAuthDecision('LOGIN_SUCCESS', { username, status: 'SUCCESS', score: result.percentage });

        return res.status(200).json({
            status: 'SUCCESS',
            message: 'Authenticated successfully!',
            confidenceScore: result.percentage,
            breakdown: result.breakdown
        });

    } catch (err) {
        console.error('Auth Route Error:', err);
        return res.status(500).json({ error: 'Internal server error.' });
    }
});

module.exports = router;