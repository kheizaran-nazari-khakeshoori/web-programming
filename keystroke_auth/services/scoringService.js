const { calculateSimilarityScore } = require('../utils/keystrokeMatcher');
const { SCORE_THRESHOLDS, FEATURE_WEIGHTS } = require('../config/constants');

/**
 * Evaluates typing sample against stored profile and determines authentication result.
 */
function evaluateKeystrokeAttempt(attemptData, storedProfile) {
    const weights = {
        hold: FEATURE_WEIGHTS.HOLD_TIME_WEIGHT,
        flight: FEATURE_WEIGHTS.FLIGHT_TIME_WEIGHT
    };

    const evaluation = calculateSimilarityScore(attemptData, storedProfile, weights);
    const score = evaluation.confidenceScore;
    const isMatch = score >= SCORE_THRESHOLDS.STRICT;

    return {
        isMatch,
        score,
        percentage: `${Math.round(score * 100)}%`,
        thresholdUsed: SCORE_THRESHOLDS.STRICT,
        breakdown: evaluation.breakdown
    };
}

module.exports = {
    evaluateKeystrokeAttempt
};