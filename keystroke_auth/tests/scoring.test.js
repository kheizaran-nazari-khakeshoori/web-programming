const { buildProfileFromSamples, calculateSimilarityScore } = require('../utils/keystrokeMatcher');
const { evaluateKeystrokeAttempt } = require('../services/scoringService');

// Mock sample enrollment data (5 attempts)
const mockEnrollmentSamples = [
    { holdTimes: [100, 110, 95, 105], flightTimes: [50, 60, 55] },
    { holdTimes: [102, 108, 98, 102], flightTimes: [52, 58, 54] },
    { holdTimes: [99, 112, 94, 106], flightTimes: [48, 62, 56] },
    { holdTimes: [101, 109, 96, 104], flightTimes: [51, 59, 53] },
    { holdTimes: [100, 111, 97, 103], flightTimes: [50, 61, 55] }
];

console.log("=== Testing Profile Generation ===");
const baseline = buildProfileFromSamples(mockEnrollmentSamples);
console.log("Generated Baseline Profile:", JSON.stringify(baseline, null, 2));

console.log("\n=== Testing Identical/Genuine Typing Pattern ===");
const genuineAttempt = { holdTimes: [101, 109, 96, 104], flightTimes: [50, 60, 54] };
const genuineResult = evaluateKeystrokeAttempt(genuineAttempt, baseline);
console.log("Genuine Attempt Evaluation:", genuineResult);

console.log("\n=== Testing Impostor/Anomalous Typing Pattern ===");
const impostorAttempt = { holdTimes: [250, 300, 210, 190], flightTimes: [180, 220, 190] };
const impostorResult = evaluateKeystrokeAttempt(impostorAttempt, baseline);
console.log("Impostor Attempt Evaluation:", impostorResult);