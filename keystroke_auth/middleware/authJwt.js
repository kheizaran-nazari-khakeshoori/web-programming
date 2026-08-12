const jwt = require('jsonwebtoken');

/**
 * Middleware to verify JWT token in Authorization header
 */
function verifyToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer <TOKEN>

    if (!token) {
        return res.status(401).json({ error: 'Access denied. No authentication token provided.' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(403).json({ error: 'Invalid or expired session token.' });
    }
}

/**
 * Helper to sign session tokens
 */
function generateSessionToken(user) {
    return jwt.sign(
        { id: user.id, username: user.username },
        process.env.JWT_SECRET || 'fallback_secret',
        { expiresIn: '2h' } // Token expires in 2 hours
    );
}

module.exports = { verifyToken, generateSessionToken };