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