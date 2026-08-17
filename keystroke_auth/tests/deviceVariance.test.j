const { buildProfileFromSamples } = require('../utils/keystrokeMatcher');
const { evaluateKeystrokeAttempt } = require('../services/scoringService');

const desktopBaseline = buildProfileFromSamples([
    { holdTimes: [90, 85, 88, 92], flightTimes: [40, 45, 42] },
    { holdTimes: [92, 87, 90, 94], flightTimes: [42, 47, 44] },
    { holdTimes: [89, 84, 86, 90], flightTimes: [39, 43, 41] },
    { holdTimes: [91, 86, 89, 93], flightTimes: [41, 46, 43] },
    { holdTimes: [90, 85, 87, 91], flightTimes: [40, 44, 42] }
]);

function runDeviceTests() {
    console.log("=== Desktop Baseline vs. Mobile Touchscreen Simulation ===");
    // Touchscreen taps typically feature higher hold times and variable flight latencies
    const mobileAttempt = { holdTimes: [140, 135, 150, 145], flightTimes: [110, 125, 105] };
    const mobileResult = evaluateKeystrokeAttempt(mobileAttempt, desktopBaseline);
    console.log(`Mobile Attempt Score: ${mobileResult.percentage} | Accepted: ${mobileResult.isMatch}`);

    console.log("\n=== Desktop Baseline vs. Browser Event Loop Drift (+15ms overhead) ===");
    const browserDriftAttempt = { holdTimes: [105, 100, 103, 107], flightTimes: [55, 60, 57] };
    const driftResult = evaluateKeystrokeAttempt(browserDriftAttempt, desktopBaseline);
    console.log(`Browser Drift Score: ${driftResult.percentage} | Accepted: ${driftResult.isMatch}`);
}

runDeviceTests();