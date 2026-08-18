const { buildProfileFromSamples } = require('../utils/keystrokeMatcher');
const { evaluateKeystrokeAttempt } = require('../services/scoringService');

// Owner Profile
const ownerProfile = buildProfileFromSamples([
    { holdTimes: [100, 105, 98, 102], flightTimes: [50, 55, 52] },
    { holdTimes: [102, 107, 100, 104], flightTimes: [52, 57, 54] },
    { holdTimes: [99, 104, 97, 101], flightTimes: [49, 54, 51] },
    { holdTimes: [101, 106, 99, 103], flightTimes: [51, 56, 53] },
    { holdTimes: [100, 105, 98, 102], flightTimes: [50, 55, 52] }
]);

// 3 Different Impostors using the correct password
const impostors = [
    { name: "Impostor A (Slow pecker)", timing: { holdTimes: [180, 190, 175, 185], flightTimes: [200, 220, 210] } },
    { name: "Impostor B (Fast touch typist)", timing: { holdTimes: [50, 55, 48, 52], flightTimes: [20, 25, 22] } },
    { name: "Impostor C (Burst typist)", timing: { holdTimes: [100, 50, 180, 60], flightTimes: [150, 20, 200] } }
];

function runImpostorTests() {
    console.log("=== Impostor Rejection Test Suite ===");
    impostors.forEach(imp => {
        const res = evaluateKeystrokeAttempt(imp.timing, ownerProfile);
        console.log(`[${imp.name}] -> Score: ${res.percentage} | Result: ${res.isMatch ? 'REJECT FAILED (Accepted)' : 'REJECT SUCCESS (Blocked)'}`);
    });
}

runImpostorTests();