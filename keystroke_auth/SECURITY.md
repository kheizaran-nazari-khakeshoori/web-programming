# Security Policy & Architecture

## Security Controls Implemented

1. **Password Protection**: Passwords are hashed using `bcrypt` with a salt round factor of 10 prior to storage.
2. **Behavioral Biometric Second Factor**: Keystroke timing patterns act as an adaptive layer on top of password authentication.
3. **Session Management**: Session tokens are signed using `JWT` with a 2-hour expiration window.
4. **Rate Limiting**: Brute-force protections enforce a maximum of 5 auth attempts per 15-minute window per IP.
5. **Data Minimization**: Unprocessed keystroke event arrays (`enrollment_samples`) are purged immediately after profile aggregation.
6. **HTTP Security Headers**: Powered by `helmet.js` to mitigate Clickjacking, XSS, and MIME-sniffing attacks.
7. **HTTPS Requirement**: Production deployments must terminate SSL/TLS at the reverse proxy (Nginx/Cloudflare) or load balancer level.
