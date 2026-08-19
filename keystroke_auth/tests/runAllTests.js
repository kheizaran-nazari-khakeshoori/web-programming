const { execSync } = require('child_process');

console.log("==========================================");
console.log(" RUNNING SYSTEM-WIDE KEYSTROKE TEST SUITE ");
console.log("==========================================\n");

const testFiles = [
    'tests/timingVariations.test.js',
    'tests/deviceVariance.test.js',
    'tests/impostorRejection.test.js'
];

testFiles.forEach(file => {
    console.log(`\n> Running ${file}...`);
    try {
        const output = execSync(`node ${file}`, { encoding: 'utf-8' });
        console.log(output);
    } catch (err) {
        console.error(`Error running ${file}:`, err.message);
    }
});