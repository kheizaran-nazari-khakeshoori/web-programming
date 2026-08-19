# Security Policy & Architecture

## Security Controls Implemented

1. **Password Protection**: Passwords are hashed using `bcrypt` with a salt round factor of 10 prior to storage.
2. **Behavioral Biometric Second Factor**: Keystroke timing patterns act as an adaptive layer on top of password authentication.
3. **Session Management**: Session tokens are signed using `JWT` with a 2-hour expiration window.
4. **Rate Limiting**: Brute-force protections enforce a maximum of 5 auth attempts per 15-minute window per IP.
5. **Data Minimization**: Unprocessed keystroke event arrays (`enrollment_samples`) are purged immediately after profile aggregation.
6. **HTTP Security Headers**: Powered by `helmet.js` to mitigate Clickjacking, XSS, and MIME-sniffing attacks.
7. **HTTPS Requirement**: Production deployments must terminate SSL/TLS at the reverse proxy (Nginx/Cloudflare) or load balancer level.
# Behavioral Biometric Evaluation Report

## Test Summary

| Test Scenario | Total Trials | Pass Rate / Accuracy | Notes |
| :--- | :--- | :--- | :--- |
| **Normal Login** | 50 | 96% | Matches baseline within ±1.5 standard deviations |
| **Fast Typing** | 20 | 75% | Slight drop in confidence score due to compressed flight times |
| **Slow Typing** | 20 | 60% | Higher variance triggering warning score thresholds |
| **Typo-Heavy Inputs** | 20 | 15% | High deviation in hold times due to backspaces/corrections |
| **Cross-Device Drift** | 30 | 70% | Touchscreen vs. physical keyboard variance requires re-calibration |
| **Impostor Attacks** | 50 | 94% Blocked | Effective rejection of alternative typing patterns |

## Biometric Metrics
- **Configured Threshold**: `0.85` (STRICT)
- **False Rejection Rate (FRR)**: `4.0%`
- **False Acceptance Rate (FAR)**: `6.0%`