# Keystroke Dynamics Authentication System

## Project Goal
Build a web application that authenticates users by comparing how they type, not just by checking a password. The project should demonstrate frontend event handling, backend scoring logic, secure storage, and practical security thinking that looks strong on a portfolio or job application.

## What The App Does
- Captures keyboard timing in real time while a user types.
- Builds a typing profile from several sample logins.
- Compares future login attempts against the stored profile.
- Accepts or rejects the login based on similarity.
- Shows where behavioral biometrics can add a layer beyond passwords.

## Recommended Tech Stack
- Frontend: HTML, CSS, JavaScript, React or plain JS if you want a simpler build.
- Backend: Node.js with Express or Python with Flask/FastAPI.
- Database: PostgreSQL or MongoDB.
- Security: bcrypt for passwords, HTTPS, hashed/secured profile storage, rate limiting, and session management.
- Optional analytics: charting library for timing visualization.

## Step-By-Step Build Plan

### 1. Define the authentication flow
- Use password plus typing check for login so password validation happens first and the typing-pattern score acts as a second factor.
- Collect 5 enrollment samples per user to create the typing profile baseline.
- Use the same phrase for every enrollment sample so the baseline stays consistent.
- Reject logins when the typing confidence falls below the threshold, and require a fresh reenrollment after 3 failed typing checks.

### 2. Design the data model
- Create a user table with account details and password hash.
- Create a typing profile table with timing statistics and enrolled samples.
- Store features such as key hold time, flight time, and average timing vectors.

### 3. Build the typing capture frontend
- Add a login form with a text field for the typing sample.
- Capture `keydown` and `keyup` events.
- Record timestamps for each key press and release.
- Convert raw key events into timing features.

### 4. Create the profile enrollment flow
- Let a new user type the same phrase multiple times.
- Aggregate the samples into a baseline profile.
- Store summary statistics securely in the database.

### 5. Implement the comparison engine
- Load the stored user profile during login.
- Compare current typing features with the saved profile.
- Produce a similarity score or confidence value.
- Set an authentication threshold based on testing results.

### 6. Add the backend API
- Create endpoints for registration, sample submission, login verification, and profile retrieval.
- Validate input and reject incomplete timing data.
- Log authentication decisions for debugging and audit purposes.

### 7. Secure the application
- Hash passwords with a strong algorithm.
- Protect the session with secure cookies or token-based auth.
- Rate-limit repeated login attempts.
- Avoid storing raw keystroke data longer than necessary.
- Use HTTPS in deployment.

### 8. Test the system
- Test normal login, slow typing, fast typing, and typo-heavy typing.
- Test whether the score changes across different devices and browsers.
- Test rejection when a stranger uses the correct password.
- Measure false accept and false reject behavior.

### 9. Improve usability
- Add clear feedback when the typing profile is too weak or inconsistent.
- Explain why the system asks for repeated samples.
- Provide a fallback recovery path if biometric verification fails.

### 10. Deploy and document
- Deploy the frontend and backend.
- Seed demo users for reviewers.
- Write setup instructions, API documentation, and architecture notes.
- Add screenshots and a short demo video if possible.

## Hiring-Focused Deliverables
To make this project look strong to an employer, include:
- A polished README with architecture, setup, and security notes.
- A live demo link or recorded walkthrough.
- Clear diagrams showing frontend capture, backend scoring, and database storage.
- A short explanation of why behavioral biometrics matter.
- A section on limitations, such as device variation and sample quality.

## Skills This Project Demonstrates
- Real-time browser event handling.
- API design and backend validation.
- Secure authentication and session handling.
- Database schema design.
- Basic machine-learning-style scoring or statistical comparison.
- Security awareness and product thinking.

## Suggested Resume Bullet
- Built a web-based keystroke dynamics authentication system that captures typing biometrics in real time, compares login behavior against stored user profiles, and adds an extra security layer beyond passwords.

## Good Next Milestones
1. Build the typing capture UI.
2. Store and compare sample profiles.
3. Add authentication API endpoints.
4. Secure the system and test failure cases.
5. Deploy the app and polish the presentation.