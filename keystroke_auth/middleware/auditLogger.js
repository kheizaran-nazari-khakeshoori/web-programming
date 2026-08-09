/**
 * Middleware/utility for structured security audit logging
 */
function logAuthDecision(event, data) {
    const timestamp = new Date().toISOString();
    const logEntry = {
        timestamp,
        event,
        ...data
    };

    if (data.status === 'SUCCESS') {
        console.log(`[AUDIT - SUCCESS] [${timestamp}] User: ${data.username} | Event: ${event} | Score: ${data.score || 'N/A'}`);
    } else {
        console.warn(`[AUDIT - WARNING] [${timestamp}] User: ${data.username} | Event: ${event} | Reason: ${data.reason || 'N/A'}`);
    }
}

module.exports = { logAuthDecision };