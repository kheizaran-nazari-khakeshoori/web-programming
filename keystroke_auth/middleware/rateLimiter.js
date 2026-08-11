const rateLimit = require('express-rate-limit');

/**
 * Strict rate limiter for login and registration attempts
 * Limits each IP to 5 requests per 15-minute window
 */
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // Limit each IP to 5 requests per window
    standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
    legacyHeaders: false, // Disable `X-RateLimit-*` headers
    message: {
        error: 'Too many login attempts from this IP. Please try again after 15 minutes.'
    }
});

/**
 * General API rate limiter
 * Limits each IP to 100 requests per 15-minute window
 */
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        error: 'Too many requests. Please slow down.'
    }
});

module.exports = { authLimiter, apiLimiter };