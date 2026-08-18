const { calculateSimilarityScore } = require('../utils/keystrokeMatcher');
const { SCORE_THRESHOLDS } = require('../config/constants');

/**
 * Calculates FAR (False Accept Rate) and FRR (False Reject Rate)
 */
function evaluateMetrics(genuineAttempts, impostorAttempts, baseline) {
    let falseRejects = 0;
    let falseAccepts = 0;

    // Evaluate Genuine Trials
    genuineAttempts.forEach(attempt => {
        const res = calculateSimilarityScore(attempt, baseline);
        if (res.confidenceScore < SCORE_THRESHOLDS.STRICT) {
            falseRejects++;
        }
    });

    // Evaluate Impostor Trials
    impostorAttempts.forEach(attempt => {
        const res = calculateSimilarityScore(attempt, baseline);
        if (res.confidenceScore >= SCORE_THRESHOLDS.STRICT) {
            falseAccepts++;
        }
    });

    const FRR = ((falseRejects / genuineAttempts.length) * 100).toFixed(2);
    const FAR = ((falseAccepts / impostorAttempts.length) * 100).toFixed(2);

    return {
        threshold: SCORE_THRESHOLDS.STRICT,
        totalGenuine: genuineAttempts.length,
        falseRejects,
        FRR: `${FRR}%`,
        totalImpostors: impostorAttempts.length,
        falseAccepts,
        FAR: `${FAR}%`
    };
}

module.exports = { evaluateMetrics };