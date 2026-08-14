const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
require('dotenv').config();

const authRoutes = require('./routes/authRoutes');
const { apiLimiter, authLimiter } = require('./middleware/rateLimiter');

const app = express();

// Trust reverse proxies (required for Heroku/Render/Nginx behind HTTPS)
app.set('trust proxy', 1);

// Security Headers via Helmet
app.use(helmet());

// CORS Configuration
app.use(cors({
    origin: process.env.CLIENT_ORIGIN || 'http://localhost:3000',
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
}));

// Body Parser with strict payload size limit
app.use(express.json({ limit: '10kb' }));

// Static frontend files
app.use(express.static('public'));

// Apply Rate Limiters
app.use('/api/', apiLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

// Mount Routes
app.use('/api/auth', authRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`[SECURE SERVER] Application running on port ${PORT}`);
});