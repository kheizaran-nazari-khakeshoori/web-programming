import bcrypt from 'bcryptjs';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import session from 'express-session';
import {
  addTypingSample,
  createUser,
  getTypingProfileByUserId,
  getUserByUsername,
  upsertTypingProfile
} from './db.js';
import { buildTypingFeatures, compareTypingSamples, parseFeaturePayload } from './typing.js';

const app = express();
const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false
});

app.use(helmet());
app.use(express.json({ limit: '16kb' }));
app.use(express.static('public'));
app.use(
  session({
    secret: 'keystroke-demo-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: false,
      maxAge: 1000 * 60 * 30
    }
  })
);

app.get('/api/health', (_request, response) => {
  response.json({ ok: true });
});

app.post('/api/register', authLimiter, async (request, response) => {
  const username = typeof request.body.username === 'string' ? request.body.username.trim().toLowerCase() : '';
  const password = typeof request.body.password === 'string' ? request.body.password : '';

  if (!username || password.length < 8) {
    return response.status(400).json({ message: 'Username and password are required.' });
  }

  if (getUserByUsername(username)) {
    return response.status(409).json({ message: 'Username already exists.' });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = createUser(username, passwordHash);

  request.session.userId = user.id;

  response.status(201).json({
    message: 'Account created. Enroll a typing profile next.',
    user: { id: user.id, username: user.username }
  });
});

app.post('/api/enroll', authLimiter, (request, response) => {
  const username = typeof request.body.username === 'string' ? request.body.username.trim().toLowerCase() : '';
  const phrase = typeof request.body.phrase === 'string' ? request.body.phrase.trim() : '';
  const payload = parseFeaturePayload(request.body);

  if (!username || !phrase || !payload) {
    return response.status(400).json({ message: 'Valid username, phrase, and typing data are required.' });
  }

  const user = getUserByUsername(username);

  if (!user) {
    return response.status(404).json({ message: 'Account not found.' });
  }

  const holdTimes = payload.holdTimes;
  const flightTimes = payload.flightTimes;
  const threshold = 74;

  addTypingSample({ userId: user.id, phrase, holdTimes, flightTimes });
  const profile = upsertTypingProfile({ userId: user.id, phrase, holdTimes, flightTimes, threshold });

  response.json({
    message: 'Typing profile saved.',
    profile: {
      phrase: profile.phrase,
      sampleCount: profile.sample_count,
      threshold: profile.threshold,
      holdTimes: JSON.parse(profile.avg_hold_json),
      flightTimes: JSON.parse(profile.avg_flight_json)
    }
  });
});

app.post('/api/login', authLimiter, async (request, response) => {
  const username = typeof request.body.username === 'string' ? request.body.username.trim().toLowerCase() : '';
  const password = typeof request.body.password === 'string' ? request.body.password : '';
  const phrase = typeof request.body.phrase === 'string' ? request.body.phrase.trim() : '';
  const payload = parseFeaturePayload(request.body);

  if (!username || !password || !phrase || !payload) {
    return response.status(400).json({ message: 'Username, password, phrase, and typing data are required.' });
  }

  const user = getUserByUsername(username);

  if (!user) {
    return response.status(401).json({ message: 'Invalid login.' });
  }

  const passwordMatches = await bcrypt.compare(password, user.password_hash);

  if (!passwordMatches) {
    return response.status(401).json({ message: 'Invalid login.' });
  }

  const profile = getTypingProfileByUserId(user.id);

  if (!profile) {
    return response.status(409).json({ message: 'Typing profile has not been enrolled yet.' });
  }

  if (profile.phrase !== phrase) {
    return response.status(401).json({ message: 'Phrase does not match the enrolled profile.' });
  }

  const result = compareTypingSamples(
    {
      holdTimes: JSON.parse(profile.avg_hold_json),
      flightTimes: JSON.parse(profile.avg_flight_json),
      threshold: profile.threshold
    },
    {
      holdTimes: buildTypingFeatures(payload.holdTimes, payload.flightTimes).holdTimes,
      flightTimes: buildTypingFeatures(payload.holdTimes, payload.flightTimes).flightTimes
    }
  );

  request.session.userId = user.id;

  response.json({
    message: result.accepted ? 'Authentication successful.' : 'Typing pattern rejected.',
    authenticated: result.accepted,
    confidence: result.confidence,
    holdDistance: result.holdDistance,
    flightDistance: result.flightDistance,
    combinedDistance: result.combinedDistance
  });
});

app.get('/api/profile/:username', (request, response) => {
  const username = request.params.username.trim().toLowerCase();
  const user = getUserByUsername(username);

  if (!user) {
    return response.status(404).json({ message: 'Account not found.' });
  }

  const profile = getTypingProfileByUserId(user.id);

  if (!profile) {
    return response.status(404).json({ message: 'Typing profile not found.' });
  }

  response.json({
    username: user.username,
    profile: {
      phrase: profile.phrase,
      sampleCount: profile.sample_count,
      threshold: profile.threshold,
      holdTimes: JSON.parse(profile.avg_hold_json),
      flightTimes: JSON.parse(profile.avg_flight_json)
    }
  });
});

app.get('*', (_request, response) => {
  response.sendFile(new URL('../public/index.html', import.meta.url).pathname);
});

const port = process.env.PORT || 3000;

if (process.env.NODE_ENV !== 'test') {
  app.listen(port, () => {
    console.log(`Keystroke authentication app listening on http://localhost:${port}`);
  });
}

export default app;
