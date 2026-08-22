const express = require('express');
const bcrypt = require('bcrypt');
const router = express.Router();

const db = require('../db');
const uiMessages = require('../config/uiMessages');
const { evaluateProfileConsistency } = require('../utils/profileQualityCheck');
const { evaluateKeystrokeAttempt } = require('../services/scoringService');
const { buildProfileFromSamples } = require('../utils/keystrokeMatcher');
const { TARGET_PHRASE, ENROLLMENT_REQUIRED_COUNT, MAX_TYPING_FAILURES } = require('../config/constants');

/**
 * POST /api/auth/login
 * Includes user guidance and fallback recovery paths
 */
router.post('/login', async (req, res) => {
    const { username, password, typingData } = req.body;

    try {
        const user = await db.findUserByUsername(username);
        if (!user) return res.status(401).json({ error: 'Invalid credentials.' });

        const isPasswordValid = await bcrypt.compare(password, user.password_hash);
        if (!isPasswordValid) return res.status(401).json({ error: 'Invalid credentials.' });

        // Enrollment Flow
        if (!user.is_enrolled) {
            const currentSampleCount = await db.getEnrollmentSampleCount(user.id);
            const nextSampleIndex = currentSampleCount + 1;

            await db.saveEnrollmentSample(user.id, nextSampleIndex, typingData);

            if (nextSampleIndex < ENROLLMENT_REQUIRED_COUNT) {
                const remaining = ENROLLMENT_REQUIRED_COUNT - nextSampleIndex;
                return res.status(200).json({
                    status: 'ENROLLMENT_IN_PROGRESS',
                    message: `Sample ${nextSampleIndex} of ${ENROLLMENT_REQUIRED_COUNT} saved. ${remaining} more to go!`,
                    explanation: uiMessages.ENROLLMENT_EXPLANATION,
                    samplesRemaining: remaining
                });
            }

            // Enrollment Complete: Evaluate Profile Quality
            const samples = await db.getEnrollmentSamples(user.id);
            const qualityReport = evaluateProfileConsistency(samples);
            const aggregatedProfile = buildProfileFromSamples(samples);

            await db.saveTypingProfile(user.id, TARGET_PHRASE, aggregatedProfile);
            await db.updateUser(user.id, { is_enrolled: true });

            return res.status(200).json({
                status: 'ENROLLMENT_COMPLETE',
                message: 'Your typing profile has been created!',
                qualityFeedback: qualityReport.feedback,
                isProfileWeak: !qualityReport.isConsistent
            });
        }

        // Verification Flow
        const profile = await db.getTypingProfile(user.id);
        const result = evaluateKeystrokeAttempt(typingData, profile);

        if (!result.isMatch) {
            const newFailureCount = user.failed_typing_attempts + 1;

            if (newFailureCount >= MAX_TYPING_FAILURES) {
                await db.resetUserTypingProfile(user.id);
                return res.status(403).json({
                    error: 'Keystroke evaluation failed repeatedly.',
                    message: 'We reset your baseline profile for security.',
                    fallbackAvailable: true,
                    fallbackInstructions: uiMessages.RECOVERY_FALLBACK_OPTION,
                    requiresReenrollment: true
                });
            } else {
                await db.updateUser(user.id, { failed_typing_attempts: newFailureCount });
                return res.status(403).json({
                    error: `Keystroke rhythm didn't match (${result.percentage} score).`,
                    tip: uiMessages.INCONSISTENT_SAMPLE_TIP,
                    attemptsRemaining: MAX_TYPING_FAILURES - newFailureCount,
                    fallbackAvailable: true,
                    fallbackInstructions: uiMessages.RECOVERY_FALLBACK_OPTION
                });
            }
        }

        await db.updateUser(user.id, { failed_typing_attempts: 0 });

        return res.status(200).json({
            status: 'SUCCESS',
            message: 'Authenticated successfully!',
            confidenceScore: result.percentage
        });

    } catch (err) {
        console.error('Auth Route Error:', err);
        return res.status(500).json({ error: 'Internal server error.' });
    }
});

module.exports = router;