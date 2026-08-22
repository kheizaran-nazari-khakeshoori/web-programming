/**
 * Analyzes enrollment samples to check if the user's typing pattern is consistent enough.
 */
function evaluateProfileConsistency(samples) {
    if (!samples || samples.length < 2) return { isConsistent: true, score: 1.0 };

    // Calculate variance of key hold times across samples
    let totalHoldVariance = 0;
    const numKeys = samples[0].holdTimes.length;

    for (let i = 0; i < numKeys; i++) {
        const keyHolds = samples.map(s => s.holdTimes[i] || 0);
        const mean = keyHolds.reduce((a, b) => a + b, 0) / keyHolds.length;
        const variance = keyHolds.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / keyHolds.length;
        totalHoldVariance += Math.sqrt(variance); // Standard deviation sum
    }

    const averageStdDev = totalHoldVariance / numKeys;
    
    // If standard deviation across hold times is over 45ms, profile is considered weak/inconsistent
    const isConsistent = averageStdDev <= 45;

    return {
        isConsistent,
        averageSpreadMs: Math.round(averageStdDev),
        feedback: isConsistent 
            ? "Great consistency! Your typing profile is strong." 
            : "Your typing speed varied quite a bit across samples. You may experience occasional login friction."
    };
}

module.exports = { evaluateProfileConsistency };