/**
 * Utility functions for statistical feature extraction and similarity scoring.
 */

function calculateMean(arr) {
    if (!arr || arr.length === 0) return 0;
    return arr.reduce((acc, val) => acc + val, 0) / arr.length;
}

function calculateStdDev(arr, mean) {
    if (!arr || arr.length <= 1) return 10;
    const variance = arr.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / (arr.length - 1);
    const std = Math.sqrt(variance);
    return std < 5 ? 5 : std; // Prevent division by zero or overly strict limits
}

/**
 * Builds aggregated mean and standard deviation profiles from enrollment samples.
 */
function buildProfileFromSamples(samples) {
    if (!samples || samples.length === 0) {
        throw new Error("No enrollment samples provided for profile generation.");
    }

    const numHoldKeys = samples[0].holdTimes.length;
    const numFlightPairs = samples[0].flightTimes.length;

    const meanHoldTimes = [];
    const stdHoldTimes = [];
    const meanFlightTimes = [];
    const stdFlightTimes = [];

    for (let i = 0; i < numHoldKeys; i++) {
        const keyHoldValues = samples.map(s => s.holdTimes[i] || 0);
        const mean = calculateMean(keyHoldValues);
        meanHoldTimes.push(Math.round(mean));
        stdHoldTimes.push(Math.round(calculateStdDev(keyHoldValues, mean)));
    }

    for (let i = 0; i < numFlightPairs; i++) {
        const keyFlightValues = samples.map(s => s.flightTimes[i] || 0);
        const mean = calculateMean(keyFlightValues);
        meanFlightTimes.push(Math.round(mean));
        stdFlightTimes.push(Math.round(calculateStdDev(keyFlightValues, mean)));
    }

    return { meanHoldTimes, stdHoldTimes, meanFlightTimes, stdFlightTimes };
}

/**
 * Calculates feature-level Z-Scores: |X - μ| / σ
 */
function computeVectorZScores(attemptArray, meanArray, stdArray) {
    if (!attemptArray || !meanArray || attemptArray.length === 0) return { totalZ: 0, count: 0 };

    let totalZ = 0;
    let count = 0;

    attemptArray.forEach((val, idx) => {
        if (meanArray[idx] !== undefined) {
            const mean = meanArray[idx];
            const std = stdArray[idx] || 10;
            totalZ += Math.abs(val - mean) / std;
            count++;
        }
    });

    return { totalZ, count };
}

/**
 * Advanced Comparison Engine: Evaluates attempt against stored baseline.
 */
function calculateSimilarityScore(attemptData, storedProfile, weights = { hold: 0.6, flight: 0.4 }) {
    const { holdTimes, flightTimes } = attemptData;

    const meanHold = storedProfile.mean_hold_times || storedProfile.meanHoldTimes;
    const stdHold = storedProfile.std_hold_times || storedProfile.stdHoldTimes;
    const meanFlight = storedProfile.mean_flight_times || storedProfile.meanFlightTimes;
    const stdFlight = storedProfile.std_flight_times || storedProfile.stdFlightTimes;

    const holdStats = computeVectorZScores(holdTimes, meanHold, stdHold);
    const flightStats = computeVectorZScores(flightTimes, meanFlight, stdFlight);

    const holdZScore = holdStats.count > 0 ? holdStats.totalZ / holdStats.count : 0;
    const flightZScore = flightStats.count > 0 ? flightStats.totalZ / flightStats.count : 0;

    // Weighted combined Z-score
    const weightedZ = (holdZScore * weights.hold) + (flightZScore * weights.flight);

    // Map Z-Score to percentage confidence (0.0 - 1.0 scale)
    const overallScore = Math.max(0, 1 - (weightedZ / 4.0));
    const holdScore = Math.max(0, 1 - (holdZScore / 4.0));
    const flightScore = Math.max(0, 1 - (flightZScore / 4.0));

    return {
        confidenceScore: parseFloat(overallScore.toFixed(2)),
        breakdown: {
            holdScore: parseFloat(holdScore.toFixed(2)),
            flightScore: parseFloat(flightScore.toFixed(2)),
            weightedZScore: parseFloat(weightedZ.toFixed(2))
        }
    };
}

module.exports = {
    buildProfileFromSamples,
    calculateSimilarityScore
};