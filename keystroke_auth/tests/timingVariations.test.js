const { buildProfileFromSamples, calculateSimilarityScore } = require('../utils/keystrokeMatcher');
const { evaluateKeystrokeAttempt } = require('../services/scoringService');

// Baseline timing vectors derived from 5 enrollment trials
const mockEnrollmentSamples = [
    { holdTimes: [100, 110, 95, 105], flightTimes: [50, 60, 55] },
    { holdTimes: [102, 108, 98, 102], flightTimes: [52, 58, 54] },
    { holdTimes: [99, 112, 94, 106], flightTimes: [48, 62, 56] },
    { holdTimes: [101, 109, 96, 104], flightTimes: [51, 59, 53] },
    { holdTimes: [100, 111, 97, 103], flightTimes: [50, 61, 55] }
];

const baseline = buildProfileFromSamples(mockEnrollmentSamples);

function runTimingTests() {
    console.log("=== 1. Testing Normal Typing (Should Pass) ===");
    const normal = evaluateKeystrokeAttempt({ holdTimes: [101, 109, 96, 104], flightTimes: [50, 60, 54] }, baseline);
    console.log(`Score: ${normal.percentage} | Passed: ${normal.isMatch}`);

    console.log("\n=== 2. Testing Fast Typing (Uniform Speedup) ===");
    const fast = evaluateKeystrokeAttempt({ holdTimes: [60, 65, 58, 62], flightTimes: [25, 30, 28] }, baseline);
    console.log(`Score: ${fast.percentage} | Passed: ${fast.isMatch}`);

    console.log("\n=== 3. Testing Slow Typing (Intentional Delays) ===");
    const slow = evaluateKeystrokeAttempt({ holdTimes: [200, 210, 190, 205], flightTimes: [150, 160, 155] }, baseline);
    console.log(`Score: ${slow.percentage} | Passed: ${slow.isMatch}`);

    console.log("\n=== 4. Testing Irregular/Typo Dynamics ===");
    const erratic = evaluateKeystrokeAttempt({ holdTimes: [100, 350, 95, 400], flightTimes: [50, 500, 55] }, baseline);
    console.log(`Score: ${erratic.percentage} | Passed: ${erratic.isMatch}`);
}

runTimingTests();