/**
 * Keystroke Dynamics Matching and Aggregation Utilities
 */

/**
 * Calculates the arithmetic mean of an array of numbers.
 * @param {number[]} arr 
 * @returns {number}
 */
function calculateMean(arr) {
    if (!arr || arr.length === 0) return 0;
    const sum = arr.reduce((acc, val) => acc + val, 0);
    return sum / arr.length;
}

/**
 * Calculates the sample standard deviation of an array of numbers.
 * @param {number[]} arr 
 * @param {number} mean 
 * @returns {number}
 */
function calculateStdDev(arr, mean) {
    if (!arr || arr.length <= 1) return 10; // Default minimum variance in ms
    const variance = arr.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / (arr.length - 1);
    const std = Math.sqrt(variance);
    return std < 5 ? 5 : std; // Prevent division-by-zero or overly strict thresholds
}

/**
 * Aggregates raw typing timing samples collected during enrollment 
 * into a single user baseline profile (means & standard deviations).
 * * @param {Array<{ holdTimes: number[], flightTimes: number[] }>} samples 
 * @returns {{ meanHoldTimes: number[], stdHoldTimes: number[], meanFlightTimes: number[], stdFlightTimes: number[] }}
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

    // Calculate mean and std deviation for Hold Times (key down -> key up)
    for (let i = 0; i < numHoldKeys; i++) {
        const keyHoldValues = samples.map(s => s.holdTimes[i] || 0);
        const mean = calculateMean(keyHoldValues);
        const std = calculateStdDev(keyHoldValues, mean);

        meanHoldTimes.push(Math.round(mean));
        stdHoldTimes.push(Math.round(std));
    }

    // Calculate mean and std deviation for Flight Times (key_N up -> key_N+1 down)
    for (let i = 0; i < numFlightPairs; i++) {
        const keyFlightValues = samples.map(s => s.flightTimes[i] || 0);
        const mean = calculateMean(keyFlightValues);
        const std = calculateStdDev(keyFlightValues, mean);

        meanFlightTimes.push(Math.round(mean));
        stdFlightTimes.push(Math.round(std));
    }

    return {
        meanHoldTimes,
        stdHoldTimes,
        meanFlightTimes,
        stdFlightTimes
    };
}

/**
 * Compares an incoming login attempt's timing vector against the stored profile baseline.
 * Uses Z-Score statistical distance to compute a normalized score from 0.0 to 1.0.
 * * @param {{ holdTimes: number[], flightTimes: number[] }} attemptData 
 * @param {object} storedProfile 
 * @returns {number} Normalized similarity score between 0.0 and 1.0
 */
function calculateSimilarityScore(attemptData, storedProfile) {
    const { holdTimes, flightTimes } = attemptData;
    
    // Support database column names (snake_case) or JS property names (camelCase)
    const meanHoldTimes = storedProfile.mean_hold_times || storedProfile.meanHoldTimes;
    const stdHoldTimes = storedProfile.std_hold_times || storedProfile.stdHoldTimes;
    const meanFlightTimes = storedProfile.mean_flight_times || storedProfile.meanFlightTimes;
    const stdFlightTimes = storedProfile.std_flight_times || storedProfile.stdFlightTimes;

    let totalZScore = 0;
    let featureCount = 0;

    // Evaluate Hold Times Z-Score: |X - μ| / σ
    if (holdTimes && meanHoldTimes) {
        holdTimes.forEach((hold, index) => {
            if (meanHoldTimes[index] !== undefined) {
                const mean = meanHoldTimes[index];
                const std = stdHoldTimes[index] || 10;
                const zScore = Math.abs(hold - mean) / std;
                totalZScore += zScore;
                featureCount++;
            }
        });
    }

    // Evaluate Flight Times Z-Score
    if (flightTimes && meanFlightTimes) {
        flightTimes.forEach((flight, index) => {
            if (meanFlightTimes[index] !== undefined) {
                const mean = meanFlightTimes[index];
                const std = stdFlightTimes[index] || 15;
                const zScore = Math.abs(flight - mean) / std;
                totalZScore += zScore;
                featureCount++;
            }
        });
    }

    if (featureCount === 0) return 0;

    // Average Z-Score deviation across all features
    const averageZScore = totalZScore / featureCount;

    // Map the average Z-score to a 0.0 – 1.0 similarity scale:
    // Average Z-Score of 0.0  => 1.00 (100% match)
    // Average Z-Score of 1.5  => 0.85 (85% match threshold)
    // Average Z-Score >= 10.0 => 0.00 (0% match)
    const similarity = Math.max(0, 1 - (averageZScore / 10.0));

    return parseFloat(similarity.toFixed(2));
}

module.exports = {
    buildProfileFromSamples,
    calculateSimilarityScore
};