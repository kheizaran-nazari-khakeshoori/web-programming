document.addEventListener('DOMContentLoaded', () => {
    const targetInput = document.getElementById('targetPhrase');
    const loginForm = document.getElementById('loginForm');
    const statusMessage = document.getElementById('statusMessage');

    // Keystroke tracking state
    let keyEvents = [];
    let activePresses = {};

    // Reset tracking buffer whenever the user clears or restarts typing
    targetInput.addEventListener('focus', () => {
        resetKeystrokeBuffer();
    });

    targetInput.addEventListener('keydown', (e) => {
        // Ignore modifier keys and navigation
        if (['Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'Tab'].includes(e.key)) {
            return;
        }

        // If backspace is pressed, reset the timing sequence to avoid noisy timing metrics
        if (e.key === 'Backspace') {
            resetKeystrokeBuffer();
            return;
        }

        const now = performance.now();

        // Avoid repeated keydown triggers from holding a key down
        if (!activePresses[e.code]) {
            activePresses[e.code] = now;
            keyEvents.push({
                key: e.key,
                code: e.code,
                pressTime: now,
                releaseTime: null
            });
        }
    });

    targetInput.addEventListener('keyup', (e) => {
        if (!activePresses[e.code]) return;

        const now = performance.now();
        delete activePresses[e.code];

        // Match keyup timestamp with corresponding keydown event
        for (let i = keyEvents.length - 1; i >= 0; i--) {
            if (keyEvents[i].code === e.code && keyEvents[i].releaseTime === null) {
                keyEvents[i].releaseTime = now;
                break;
            }
        }
    });

    function resetKeystrokeBuffer() {
        keyEvents = [];
        activePresses = {};
    }

    /**
     * Converts raw press/release timestamps into feature vectors:
     * - Hold Time: Duration key remained pressed (releaseTime - pressTime)
     * - Flight Time: Latency between key_N release and key_N+1 press
     */
    function extractTimingFeatures() {
        const holdTimes = [];
        const flightTimes = [];

        for (let i = 0; i < keyEvents.length; i++) {
            const current = keyEvents[i];
            
            if (current.pressTime && current.releaseTime) {
                holdTimes.push(Math.round(current.releaseTime - current.pressTime));
            }

            if (i < keyEvents.length - 1) {
                const next = keyEvents[i + 1];
                if (current.releaseTime && next.pressTime) {
                    flightTimes.push(Math.round(next.pressTime - current.releaseTime));
                }
            }
        }

        return { holdTimes, flightTimes };
    }

    // Submit payload to backend
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        const timingData = extractTimingFeatures();

        if (timingData.holdTimes.length === 0) {
            statusMessage.textContent = 'Please type the verification phrase manually.';
            statusMessage.className = 'status-message error';
            return;
        }

        statusMessage.textContent = 'Authenticating...';
        statusMessage.className = 'status-message info';

        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username,
                    password,
                    typingData
                })
            });

            const data = await response.json();

            if (response.ok) {
                statusMessage.textContent = data.message || 'Authenticated successfully!';
                statusMessage.className = 'status-message success';
                resetKeystrokeBuffer();
            } else {
                statusMessage.textContent = data.error || 'Authentication failed.';
                statusMessage.className = 'status-message error';
                resetKeystrokeBuffer();
            }
        } catch (err) {
            console.error('Submission error:', err);
            statusMessage.textContent = 'Network error. Please try again.';
            statusMessage.className = 'status-message error';
        }
    });
});