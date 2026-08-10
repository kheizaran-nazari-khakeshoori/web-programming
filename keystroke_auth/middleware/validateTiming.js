/**
 * Middleware to validate incoming keystroke timing payloads
 */
function validateTimingData(req, res, next) {
    const { typingData } = req.body;

    if (!typingData) {
        return res.status(400).json({ error: 'Missing typingData object.' });
    }

    const { holdTimes, flightTimes } = typingData;

    if (!Array.isArray(holdTimes) || !Array.isArray(flightTimes)) {
        return res.status(400).json({ error: 'Invalid payload: holdTimes and flightTimes must be arrays.' });
    }

    if (holdTimes.length === 0) {
        return res.status(400).json({ error: 'Incomplete timing data: holdTimes cannot be empty.' });
    }

    // Validate that all recorded timings are positive numbers
    const isValidHold = holdTimes.every(t => typeof t === 'number' && t >= 0);
    const isValidFlight = flightTimes.every(t => typeof t === 'number');

    if (!isValidHold || !isValidFlight) {
        return res.status(400).json({ error: 'Malformed timing values: Timings must be numeric.' });
    }

    next();
}

module.exports = { validateTimingData };