const express = require('express');
const router = express.Router();
const db = require('../db');

/**
 * POST /api/auth/recover
 * Fallback mechanism if keystroke biometric fails consistently.
 */
router.post('/recover', async (req, res) => {
    const { username, securityCode } = req.body;

    if (!username || !securityCode) {
        return res.status(400).json({ error: 'Username and security recovery code are required.' });
    }

    try {
        const user = await db.findUserByUsername(username);
        if (!user) {
            return res.status(404).json({ error: 'User not found.' });
        }

        // Demo recovery logic (verifies against a mock or stored recovery pin)
        if (securityCode === "123456" || securityCode === user.recovery_pin) {
            await db.updateUser(user.id, { failed_typing_attempts: 0 });
            return res.status(200).json({
                status: 'RECOVERY_SUCCESS',
                message: 'Identity verified via recovery code. Typing failure counter reset.'
            });
        } else {
            return res.status(401).json({ error: 'Invalid recovery code.' });
        }
    } catch (err) {
        console.error('Recovery Error:', err);
        return res.status(500).json({ error: 'Internal server error.' });
    }
});

module.exports = router;