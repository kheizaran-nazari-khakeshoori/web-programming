module.exports = {
    TARGET_PHRASE: "security-by-typing",
    ENROLLMENT_REQUIRED_COUNT: 5,
    MAX_TYPING_FAILURES: 3,
    
    // Similarity Threshold Config
    SCORE_THRESHOLDS: {
        STRICT: 0.85,      // Standard authentication threshold (85% match)
        WARN: 0.70,        // Low similarity warning zone
        REJECT: 0.50       // Immediate anomaly trigger
    },

    // Biometric Feature Weights
    FEATURE_WEIGHTS: {
        HOLD_TIME_WEIGHT: 0.60,    // Key hold duration carries 60% weight
        FLIGHT_TIME_WEIGHT: 0.40   // Inter-key latency carries 40% weight
    }
};