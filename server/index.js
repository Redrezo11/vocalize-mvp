import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import { v2 as cloudinary } from 'cloudinary';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';
import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';
import cookieParser from 'cookie-parser';
import { parseDocument, validateFile, getSupportedTypes } from './utils/documentParser/index.js';

// Load env from .env.local in development, Heroku provides env vars in production
dotenv.config({ path: '.env.local' });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? process.env.APP_URL || 'https://listening-test-generator-203bfe6d6da6.herokuapp.com'
    : ['http://localhost:5173', 'http://localhost:3001'],
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(cookieParser());

// JWT secret
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'dev-secret-change-in-production');

// Multer configuration for file uploads (memory storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max
  },
  fileFilter: (req, file, cb) => {
    const validation = validateFile(file.originalname, 0); // Size checked by limits
    if (validation.valid) {
      cb(null, true);
    } else {
      cb(new Error(validation.error), false);
    }
  },
});

// Cloudinary Configuration
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// MongoDB Connection - use MONGODB_URI in production, fall back to VITE_MONGODB_URI for local dev
const MONGODB_URI = process.env.MONGODB_URI || process.env.VITE_MONGODB_URI;
console.log('[MongoDB] Connecting to:', MONGODB_URI);

mongoose.connect(MONGODB_URI)
  .then(async () => {
    console.log('[MongoDB] Connected successfully');
    // Seed admin account if it doesn't exist
    try {
      const adminUsername = (process.env.ADMIN_USERNAME || 'admin').toLowerCase().trim();
      const adminPassword = process.env.ADMIN_PASSWORD || 'changeme123';
      const existingAdmin = await mongoose.model('User').findOne({ username: adminUsername }).catch(() => null);
      if (!existingAdmin) {
        const hash = await bcrypt.hash(adminPassword, 12);
        await mongoose.model('User').create({ username: adminUsername, password_hash: hash, name: 'Admin', role: 'admin' });
        console.log(`[Auth] Admin account seeded: ${adminUsername}`);
      }
    } catch (err) {
      // Schema may not be registered yet on first run — that's OK, will seed on next restart
      console.log('[Auth] Admin seed skipped (will retry on next startup):', err.message);
    }
  })
  .catch(err => console.error('MongoDB connection error:', err));

// Audio Entry Schema
const audioEntrySchema = new mongoose.Schema({
  title: { type: String, required: true },
  transcript: { type: String, required: true },
  audio_url: { type: String, default: null },
  cloudinary_public_id: { type: String, default: null },
  duration: { type: Number, default: null },
  engine: { type: String, default: null },
  speaker_mapping: { type: Object, default: {} },
  speakers: [{ type: String }],
  is_transcript_only: { type: Boolean, default: false },
  difficulty: { type: String, default: null },
  created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
});

// Add indexes for faster queries
audioEntrySchema.index({ updated_at: -1 }); // For sorting by recent
audioEntrySchema.index({ is_transcript_only: 1 }); // For filtering

const AudioEntry = mongoose.model('AudioEntry', audioEntrySchema);

// Test Question Schema
const testQuestionSchema = new mongoose.Schema({
  questionText: { type: String, required: true },
  options: [{ type: String }],
  correctAnswer: { type: String, required: true },
  explanation: { type: String },
  explanationArabic: { type: String },
  blankIndex: { type: Number }
});

// Lexis Item Schema
const lexisItemSchema = new mongoose.Schema({
  term: { type: String, required: true },
  definition: { type: String, required: true },
  definitionArabic: { type: String },
  hintArabic: { type: String },
  explanation: { type: String },
  explanationArabic: { type: String },
  example: { type: String },
  partOfSpeech: { type: String }
});

// Preview Activity Schema (pre-listening warm-up)
const previewActivitySchema = new mongoose.Schema({
  type: { type: String, enum: ['prediction', 'wordAssociation', 'trueFalse'], required: true },
  items: { type: mongoose.Schema.Types.Mixed, required: true }  // Array of activity-specific items
});

// Listening Test Schema
const listeningTestSchema = new mongoose.Schema({
  audioId: { type: mongoose.Schema.Types.ObjectId, ref: 'AudioEntry', required: false, default: null },  // null for transcript-only or reading tests
  title: { type: String, required: true },
  type: { type: String, enum: ['listening-comprehension', 'fill-in-blank', 'dictation', 'reading-comprehension', 'reading-fill-in-blank'], required: true },
  questions: [testQuestionSchema],
  lexis: [lexisItemSchema],  // Vocabulary items for the test
  lexisAudio: { type: mongoose.Schema.Types.Mixed, default: null },  // Generated vocabulary audio
  preview: [previewActivitySchema],  // Pre-listening/pre-reading preview activities
  classroomActivity: { type: mongoose.Schema.Types.Mixed, default: null },  // Pre-activity classroom discussion
  transferQuestion: { type: mongoose.Schema.Types.Mixed, default: null },  // Plenary transfer question
  speaker_count: { type: Number, default: null },  // Number of speakers (null for reading tests)
  source_text: { type: String, default: null },  // Reading passage (null for listening tests)
  difficulty: { type: String, enum: ['A1', 'A2', 'B1', 'B2', 'C1'] },  // CEFR level
  bonus_questions: [testQuestionSchema],  // Pre-generated bonus questions pool
  created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
});

// Add indexes for faster queries
listeningTestSchema.index({ created_at: -1 }); // For sorting by recent
listeningTestSchema.index({ audioId: 1 }); // For querying by audio

const ListeningTest = mongoose.model('ListeningTest', listeningTestSchema);

// App Settings Schema (singleton - one document per app instance)
const appSettingsSchema = new mongoose.Schema({
  _id: { type: String, default: 'default' }, // Single settings document
  app_mode: { type: String, enum: ['listening', 'reading'], default: 'listening' },
  difficulty_level: { type: String, enum: ['A1', 'A2', 'B1', 'B2', 'C1'], default: 'B1' },
  content_mode: { type: String, enum: ['standard', 'halal', 'elsd'], default: 'standard' },
  classroom_theme: { type: String, enum: ['light', 'dark'], default: 'light' },
  updated_at: { type: Date, default: Date.now }
});

const AppSettings = mongoose.model('AppSettings', appSettingsSchema);

// User Schema
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password_hash: { type: String, required: true },
  name: { type: String, required: true, trim: true },
  role: { type: String, enum: ['admin', 'teacher'], default: 'teacher' },
  is_active: { type: Boolean, default: true },
  token_balance: { type: Number, default: 0 },
  token_limit: { type: Number, default: 0 },
  tokens_used: { type: Number, default: 0 },
  refresh_token: { type: String, default: null },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
});
userSchema.index({ username: 1 });
const User = mongoose.model('User', userSchema);

// Usage Log Schema (append-only ledger for token tracking)
const usageLogSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  operation: { type: String, required: true },
  tokens_used: { type: Number, required: true },
  provider: { type: String },
  model: { type: String },
  metadata: { type: mongoose.Schema.Types.Mixed },
  created_at: { type: Date, default: Date.now }
});
usageLogSchema.index({ user_id: 1, created_at: -1 });
const UsageLog = mongoose.model('UsageLog', usageLogSchema);

// Helper: Upload audio to Cloudinary
const uploadToCloudinary = async (base64Audio, publicId) => {
  try {
    const dataUri = `data:audio/mpeg;base64,${base64Audio}`;
    const result = await cloudinary.uploader.upload(dataUri, {
      resource_type: 'video', // Cloudinary uses 'video' for audio files
      public_id: publicId,
      folder: 'vocalize-audio',
      overwrite: true
    });
    return {
      url: result.secure_url,
      public_id: result.public_id,
      duration: result.duration
    };
  } catch (error) {
    console.error('Cloudinary upload error:', error);
    throw error;
  }
};

// Helper: Delete audio from Cloudinary
const deleteFromCloudinary = async (publicId) => {
  try {
    if (publicId) {
      await cloudinary.uploader.destroy(publicId, { resource_type: 'video' });
    }
  } catch (error) {
    console.error('Cloudinary delete error:', error);
  }
};

// Helper: Upload test audio (lexis, word, classroom) to Cloudinary
// Accepts full data URLs (audio/mpeg from OpenAI, audio/wav from Gemini)
const uploadTestAudio = async (dataUrl, publicId) => {
  if (!dataUrl || !dataUrl.startsWith('data:')) return null;
  try {
    const result = await cloudinary.uploader.upload(dataUrl, {
      resource_type: 'video',
      public_id: publicId,
      folder: 'vocalize-test-audio',
      overwrite: true
    });
    return result.secure_url;
  } catch (error) {
    console.error('Test audio upload error:', error);
    return null;
  }
};

// Process all base64 audio fields in a test, upload to Cloudinary, replace with URLs
const processTestAudioUploads = async (testId, data) => {
  const uploads = [];

  // lexisAudio.url
  if (data.lexisAudio?.url?.startsWith('data:')) {
    uploads.push(
      uploadTestAudio(data.lexisAudio.url, `lexis_audio_${testId}`)
        .then(url => { if (url) data.lexisAudio.url = url; })
    );
  }

  // lexisAudio.wordAudios
  if (data.lexisAudio?.wordAudios) {
    for (const [wordId, wordAudio] of Object.entries(data.lexisAudio.wordAudios)) {
      if (wordAudio.url?.startsWith('data:')) {
        uploads.push(
          uploadTestAudio(wordAudio.url, `word_audio_${testId}_${wordId}`)
            .then(url => { if (url) wordAudio.url = url; })
        );
      }
    }
  }

  // classroomActivity.audioEn
  if (data.classroomActivity?.audioEn?.startsWith('data:')) {
    uploads.push(
      uploadTestAudio(data.classroomActivity.audioEn, `classroom_en_${testId}`)
        .then(url => { if (url) data.classroomActivity.audioEn = url; })
    );
  }

  // classroomActivity.audioAr
  if (data.classroomActivity?.audioAr?.startsWith('data:')) {
    uploads.push(
      uploadTestAudio(data.classroomActivity.audioAr, `classroom_ar_${testId}`)
        .then(url => { if (url) data.classroomActivity.audioAr = url; })
    );
  }

  if (uploads.length > 0) {
    console.log(`[processTestAudioUploads] Uploading ${uploads.length} audio file(s) for test ${testId}`);
    await Promise.all(uploads);
    console.log(`[processTestAudioUploads] Done uploading for test ${testId}`);
  }

  return data;
};

// ==================== REQUEST LOGGING MIDDLEWARE ====================
app.use('/api', (req, res, next) => {
  const start = Date.now();
  const ua = req.headers['user-agent'] || 'unknown';
  // Compact user-agent: just browser + OS
  const uaShort = ua.includes('Android') ? 'Android' :
                   ua.includes('iPhone') ? 'iPhone' :
                   ua.includes('iPad') ? 'iPad' :
                   ua.includes('Windows') ? 'Windows' :
                   ua.includes('Mac') ? 'Mac' : ua.slice(0, 40);

  res.on('finish', () => {
    const duration = Date.now() - start;
    const logLevel = res.statusCode >= 500 ? 'ERROR' : res.statusCode >= 400 ? 'WARN' : 'INFO';
    console.log(`[${logLevel}] ${req.method} ${req.originalUrl} → ${res.statusCode} (${duration}ms) [${uaShort}]`);
  });
  next();
});

// ==================== AUTH HELPERS ====================

// Generate access token (15 min)
async function generateAccessToken(user) {
  return new SignJWT({ userId: user._id.toString(), role: user.role, username: user.username })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('15m')
    .sign(JWT_SECRET);
}

// Generate refresh token (7 days)
async function generateRefreshToken(user) {
  return new SignJWT({ userId: user._id.toString(), type: 'refresh' })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('7d')
    .sign(JWT_SECRET);
}

// Set auth cookies on response
function setAuthCookies(res, accessToken, refreshToken) {
  const isProduction = process.env.NODE_ENV === 'production';
  res.cookie('accessToken', accessToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'strict' : 'lax',
    maxAge: 15 * 60 * 1000 // 15 min
  });
  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'strict' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  });
}

// Clear auth cookies
function clearAuthCookies(res) {
  res.clearCookie('accessToken');
  res.clearCookie('refreshToken');
}

// ==================== AUTH MIDDLEWARE ====================

// Require authentication
async function authenticate(req, res, next) {
  const token = req.cookies?.accessToken;
  if (!token) return res.status(401).json({ error: 'Authentication required' });
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// Require admin role
function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
  next();
}

// Check if user can modify a resource (creator or admin)
function canModify(createdBy, user) {
  if (user.role === 'admin') return true;
  if (!createdBy) return false; // null = pre-auth data, treated as admin-owned
  return createdBy.toString() === user.userId;
}

// Deduct tokens atomically. Admins are unlimited (log only). Returns null if insufficient.
async function deductTokens(userId, role, amount, operation, details = {}) {
  if (role === 'admin') {
    // Admin: log only, no deduction
    await UsageLog.create({ user_id: userId, tokens_used: amount, operation, ...details });
    return { admin: true };
  }
  const user = await User.findOneAndUpdate(
    { _id: userId, token_balance: { $gte: amount } },
    { $inc: { token_balance: -amount, tokens_used: amount } },
    { new: true }
  );
  if (user) {
    await UsageLog.create({ user_id: userId, tokens_used: amount, operation, ...details });
  }
  return user;
}

// ==================== AUTH ROUTES ====================

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password required' });

    const user = await User.findOne({ username: username.toLowerCase().trim() });
    if (!user) return res.status(401).json({ error: 'Invalid username or password' });
    if (!user.is_active) return res.status(403).json({ error: 'Account is disabled' });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid username or password' });

    const accessToken = await generateAccessToken(user);
    const refreshToken = await generateRefreshToken(user);

    // Store refresh token in DB
    user.refresh_token = refreshToken;
    await user.save();

    setAuthCookies(res, accessToken, refreshToken);
    res.json({ user: { id: user._id, username: user.username, name: user.name, role: user.role, token_balance: user.token_balance } });
  } catch (err) {
    console.error('[Auth] Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Refresh access token
app.post('/api/auth/refresh', async (req, res) => {
  try {
    const token = req.cookies?.refreshToken;
    if (!token) return res.status(401).json({ error: 'No refresh token' });

    const { payload } = await jwtVerify(token, JWT_SECRET);
    const user = await User.findById(payload.userId);
    if (!user || !user.is_active || user.refresh_token !== token) {
      clearAuthCookies(res);
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    // Rotate tokens
    const accessToken = await generateAccessToken(user);
    const refreshToken = await generateRefreshToken(user);
    user.refresh_token = refreshToken;
    await user.save();

    setAuthCookies(res, accessToken, refreshToken);
    res.json({ user: { id: user._id, username: user.username, name: user.name, role: user.role, token_balance: user.token_balance } });
  } catch {
    clearAuthCookies(res);
    res.status(401).json({ error: 'Invalid refresh token' });
  }
});

// Logout
app.post('/api/auth/logout', async (req, res) => {
  try {
    const token = req.cookies?.refreshToken;
    if (token) {
      // Attempt to parse and clear DB token, but don't fail if invalid
      try {
        const { payload } = await jwtVerify(token, JWT_SECRET);
        await User.findByIdAndUpdate(payload.userId, { refresh_token: null });
      } catch {}
    }
    clearAuthCookies(res);
    res.json({ message: 'Logged out' });
  } catch {
    clearAuthCookies(res);
    res.json({ message: 'Logged out' });
  }
});

// Get current user
app.get('/api/auth/me', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('-password_hash -refresh_token');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ id: user._id, username: user.username, name: user.name, role: user.role, is_active: user.is_active, token_balance: user.token_balance });
  } catch (err) {
    console.error('[Auth] Me error:', err);
    res.status(500).json({ error: 'Failed to get user' });
  }
});

// ==================== ADMIN ROUTES ====================

// List all users
app.get('/api/admin/users', authenticate, requireAdmin, async (req, res) => {
  try {
    const users = await User.find().select('-password_hash -refresh_token').sort({ created_at: -1 });
    res.json(users);
  } catch (err) {
    console.error('[Admin] List users error:', err);
    res.status(500).json({ error: 'Failed to list users' });
  }
});

// Create user (teacher)
app.post('/api/admin/users', authenticate, requireAdmin, async (req, res) => {
  try {
    const { username, password, name, role } = req.body;
    if (!username || !password || !name) return res.status(400).json({ error: 'Username, password, and name required' });
    if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });

    const existing = await User.findOne({ username: username.toLowerCase().trim() });
    if (existing) return res.status(409).json({ error: 'Username already in use' });

    const password_hash = await bcrypt.hash(password, 12);
    const user = await User.create({
      username: username.toLowerCase().trim(),
      password_hash,
      name: name.trim(),
      role: role === 'admin' ? 'admin' : 'teacher'
    });

    res.status(201).json({ id: user._id, username: user.username, name: user.name, role: user.role, is_active: user.is_active });
  } catch (err) {
    console.error('[Admin] Create user error:', err);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// Update user
app.put('/api/admin/users/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const { name, username, is_active, password } = req.body;
    const updates = { updated_at: new Date() };
    if (name !== undefined) updates.name = name.trim();
    if (username !== undefined) updates.username = username.toLowerCase().trim();
    if (is_active !== undefined) updates.is_active = is_active;
    if (password) {
      if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
      updates.password_hash = await bcrypt.hash(password, 12);
    }

    const user = await User.findByIdAndUpdate(req.params.id, updates, { new: true }).select('-password_hash -refresh_token');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    console.error('[Admin] Update user error:', err);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// Delete user
app.delete('/api/admin/users/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    // Prevent deleting yourself
    if (user._id.toString() === req.user.userId) return res.status(400).json({ error: 'Cannot delete your own account' });
    await User.findByIdAndDelete(req.params.id);
    res.json({ message: 'User deleted' });
  } catch (err) {
    console.error('[Admin] Delete user error:', err);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// ==================== TOKEN ROUTES ====================

// Get own token balance
app.get('/api/tokens/balance', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('token_balance token_limit tokens_used role');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({
      token_balance: user.token_balance,
      token_limit: user.token_limit,
      tokens_used: user.tokens_used,
      unlimited: user.role === 'admin'
    });
  } catch (err) {
    console.error('[Tokens] Balance error:', err);
    res.status(500).json({ error: 'Failed to get balance' });
  }
});

// Report usage & deduct tokens
app.post('/api/tokens/use', authenticate, async (req, res) => {
  try {
    const { operation, tokens, provider, model, metadata } = req.body;
    if (!operation || !tokens || tokens <= 0) return res.status(400).json({ error: 'operation and tokens (>0) required' });

    const result = await deductTokens(req.user.userId, req.user.role, tokens, operation, { provider, model, metadata });
    if (!result) return res.status(402).json({ error: 'Insufficient tokens' });

    if (result.admin) {
      return res.json({ unlimited: true });
    }
    res.json({ token_balance: result.token_balance });
  } catch (err) {
    console.error('[Tokens] Use error:', err);
    res.status(500).json({ error: 'Failed to deduct tokens' });
  }
});

// Admin: grant/set tokens for a user
app.put('/api/admin/users/:id/tokens', authenticate, requireAdmin, async (req, res) => {
  try {
    const { token_balance, token_limit } = req.body;
    const updates = { updated_at: new Date() };
    if (token_balance !== undefined) updates.token_balance = token_balance;
    if (token_limit !== undefined) updates.token_limit = token_limit;

    const user = await User.findByIdAndUpdate(req.params.id, updates, { new: true })
      .select('-password_hash -refresh_token');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    console.error('[Admin] Token update error:', err);
    res.status(500).json({ error: 'Failed to update tokens' });
  }
});

// Admin: usage analytics
app.get('/api/admin/usage', authenticate, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.query;
    const match = userId ? { user_id: new mongoose.Types.ObjectId(userId) } : {};

    // Per-user summary
    const userSummary = await UsageLog.aggregate([
      { $match: match },
      { $group: {
        _id: '$user_id',
        total_tokens: { $sum: '$tokens_used' },
        operation_count: { $sum: 1 }
      }},
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' }},
      { $unwind: '$user' },
      { $project: {
        _id: 1,
        name: '$user.name',
        username: '$user.username',
        total_tokens: 1,
        operation_count: 1,
        token_balance: '$user.token_balance',
        token_limit: '$user.token_limit'
      }},
      { $sort: { total_tokens: -1 }}
    ]);

    // Breakdown by operation
    const byOperation = await UsageLog.aggregate([
      { $match: match },
      { $group: {
        _id: '$operation',
        total_tokens: { $sum: '$tokens_used' },
        count: { $sum: 1 }
      }},
      { $sort: { total_tokens: -1 }}
    ]);

    // Breakdown by provider
    const byProvider = await UsageLog.aggregate([
      { $match: match },
      { $group: {
        _id: { provider: '$provider', model: '$model' },
        total_tokens: { $sum: '$tokens_used' },
        count: { $sum: 1 }
      }},
      { $sort: { total_tokens: -1 }}
    ]);

    res.json({ userSummary, byOperation, byProvider });
  } catch (err) {
    console.error('[Admin] Usage analytics error:', err);
    res.status(500).json({ error: 'Failed to get usage data' });
  }
});

// API Routes

// Get all audio entries
app.get('/api/audio-entries', authenticate, async (req, res) => {
  try {
    const count = await AudioEntry.countDocuments();
    console.log('[API] Audio entries count:', count);
    const entries = await AudioEntry.find()
      .populate('created_by', 'name username')
      .sort({ updated_at: -1 });
    console.log('[API] Found entries:', entries.length);
    res.json(entries);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get single audio entry
app.get('/api/audio-entries/:id', async (req, res) => {
  try {
    const entry = await AudioEntry.findById(req.params.id);
    if (!entry) {
      console.log(`[GET /api/audio-entries/:id] Entry NOT FOUND: ${req.params.id}`);
      return res.status(404).json({ error: 'Entry not found' });
    }
    console.log(`[GET /api/audio-entries/:id] Found: "${entry.title}" | transcript: ${entry.is_transcript_only} | audio: ${!!entry.audio_url}`);
    res.json(entry);
  } catch (error) {
    console.error(`[GET /api/audio-entries/:id] ERROR: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// Create audio entry
app.post('/api/audio-entries', authenticate, async (req, res) => {
  try {
    const { title, transcript, audio_data, duration, engine, speaker_mapping, speakers, is_transcript_only, difficulty } = req.body;
    console.log('[SERVER] POST /api/audio-entries received:');
    console.log('[SERVER] is_transcript_only from req.body =', is_transcript_only);
    console.log('[SERVER] typeof is_transcript_only =', typeof is_transcript_only);

    let audioUrl = null;
    let cloudinaryPublicId = null;
    let audioDuration = duration;

    // Upload audio to Cloudinary if provided (skip for transcript-only entries)
    if (audio_data && !is_transcript_only) {
      const tempId = new mongoose.Types.ObjectId();
      const uploadResult = await uploadToCloudinary(audio_data, `audio_${tempId}`);
      audioUrl = uploadResult.url;
      cloudinaryPublicId = uploadResult.public_id;
      audioDuration = uploadResult.duration || duration;
    }

    const entry = new AudioEntry({
      title,
      transcript,
      audio_url: audioUrl,
      cloudinary_public_id: cloudinaryPublicId,
      duration: audioDuration,
      engine,
      speaker_mapping,
      speakers,
      is_transcript_only: is_transcript_only || false,
      difficulty: difficulty || null,
      created_by: req.user.userId
    });

    await entry.save();
    console.log('[SERVER] Saved entry with is_transcript_only =', entry.is_transcript_only);
    res.status(201).json(entry);
  } catch (error) {
    console.error('Create error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update audio entry
app.put('/api/audio-entries/:id', authenticate, async (req, res) => {
  try {
    const { title, transcript, audio_data, duration, engine, speaker_mapping, speakers, is_transcript_only, difficulty } = req.body;

    const existingEntry = await AudioEntry.findById(req.params.id);
    if (!existingEntry) {
      return res.status(404).json({ error: 'Entry not found' });
    }
    if (!canModify(existingEntry.created_by, req.user)) {
      return res.status(403).json({ error: 'You can only edit your own audio entries' });
    }

    const updateData = {
      title,
      transcript,
      engine,
      speaker_mapping,
      speakers,
      updated_at: new Date()
    };

    // Only update is_transcript_only if provided
    if (is_transcript_only !== undefined) {
      updateData.is_transcript_only = is_transcript_only;
    }

    // Only update difficulty if provided
    if (difficulty !== undefined) {
      updateData.difficulty = difficulty;
    }

    // Upload new audio if provided
    if (audio_data) {
      // Delete old audio from Cloudinary
      if (existingEntry.cloudinary_public_id) {
        await deleteFromCloudinary(existingEntry.cloudinary_public_id);
      }

      const uploadResult = await uploadToCloudinary(audio_data, `audio_${req.params.id}`);
      updateData.audio_url = uploadResult.url;
      updateData.cloudinary_public_id = uploadResult.public_id;
      updateData.duration = uploadResult.duration || duration;
    }

    const entry = await AudioEntry.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    );

    res.json(entry);
  } catch (error) {
    console.error('Update error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete audio entry
app.delete('/api/audio-entries/:id', authenticate, async (req, res) => {
  try {
    const entry = await AudioEntry.findById(req.params.id);
    if (!entry) {
      return res.status(404).json({ error: 'Entry not found' });
    }
    if (!canModify(entry.created_by, req.user)) {
      return res.status(403).json({ error: 'You can only delete your own audio entries' });
    }

    // Delete audio from Cloudinary
    if (entry.cloudinary_public_id) {
      await deleteFromCloudinary(entry.cloudinary_public_id);
    }

    await AudioEntry.findByIdAndDelete(req.params.id);
    res.json({ message: 'Entry deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== TEST ROUTES ====================

// Get all tests for an audio entry
app.get('/api/audio-entries/:audioId/tests', authenticate, async (req, res) => {
  try {
    const tests = await ListeningTest.find({ audioId: req.params.audioId })
      .select('-lexisAudio -classroomActivity')
      .sort({ created_at: -1 });
    res.json(tests);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all tests
app.get('/api/tests', authenticate, async (req, res) => {
  try {
    const tests = await ListeningTest.find()
      .populate('created_by', 'name username')
      .select('-lexisAudio -classroomActivity')
      .sort({ created_at: -1 });
    const responseJson = JSON.stringify(tests);
    console.log(`[GET /api/tests] Response size: ${(responseJson.length / 1024).toFixed(1)}KB, ${tests.length} tests`);
    res.json(tests);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get single test (student test loading endpoint)
app.get('/api/tests/:id', async (req, res) => {
  const testId = req.params.id;
  console.log(`[GET /api/tests/:id] Loading test ${testId}`);
  try {
    const dbStart = Date.now();
    const test = await ListeningTest.findById(testId);
    const dbTime = Date.now() - dbStart;

    if (!test) {
      console.log(`[GET /api/tests/:id] Test NOT FOUND: ${testId} (db: ${dbTime}ms)`);
      return res.status(404).json({ error: 'Test not found' });
    }

    const responseSize = JSON.stringify(test).length;
    console.log(`[GET /api/tests/:id] Test found: "${test.title}" | questions: ${test.questions?.length || 0} | preview: ${test.preview?.length || 0} | size: ${(responseSize / 1024).toFixed(1)}KB | db: ${dbTime}ms`);
    res.json(test);
  } catch (error) {
    console.error(`[GET /api/tests/:id] ERROR loading test ${testId}:`, error.message);
    res.status(500).json({ error: error.message });
  }
});

// Create test
app.post('/api/tests', authenticate, async (req, res) => {
  try {
    const { audioId, title, type, questions, lexis, preview, classroomActivity, transferQuestion, sourceText, speakerCount, difficulty, bonusQuestions } = req.body;

    console.log('[POST /api/tests] Creating test with preview:', preview ? preview.length + ' activities' : 'none', '| type:', type);

    // Reading tests don't need audioId validation
    const isReadingTest = type && (type.startsWith('reading'));
    // Skip audio verification for transcript-only tests (audioId starts with "transcript-")
    const isTranscriptOnly = audioId && audioId.startsWith('transcript-');

    if (!isReadingTest && !isTranscriptOnly) {
      // Verify audio entry exists for listening tests
      const audioEntry = await AudioEntry.findById(audioId);
      if (!audioEntry) {
        return res.status(404).json({ error: 'Audio entry not found' });
      }
    }

    const test = new ListeningTest({
      audioId: (isTranscriptOnly || isReadingTest) ? null : audioId,
      title,
      type,
      questions,
      lexis: lexis || [],
      preview: preview || [],
      classroomActivity: classroomActivity || null,
      transferQuestion: transferQuestion || null,
      speaker_count: speakerCount != null ? speakerCount : null,
      source_text: sourceText || null,
      difficulty: difficulty || null,
      bonus_questions: bonusQuestions || [],
      created_by: req.user.userId
    });

    await test.save();
    console.log('[POST /api/tests] Saved test has preview:', test.preview ? test.preview.length + ' activities' : 'none');
    res.status(201).json(test);
  } catch (error) {
    console.error('Create test error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update test
app.put('/api/tests/:id', authenticate, async (req, res) => {
  try {
    const existingTest = await ListeningTest.findById(req.params.id);
    if (!existingTest) return res.status(404).json({ error: 'Test not found' });
    if (!canModify(existingTest.created_by, req.user)) {
      return res.status(403).json({ error: 'You can only edit your own tests' });
    }
    const { title, type, questions, lexis, lexisAudio, preview, classroomActivity, transferQuestion, speakerCount, difficulty, bonusQuestions } = req.body;

    console.log('[SERVER PUT /api/tests/:id] Received preview:', preview ? preview.length + ' activities' : 'undefined');
    console.log('[SERVER PUT /api/tests/:id] Received lexisAudio:', lexisAudio ? { engine: lexisAudio.engine, urlLength: lexisAudio.url?.length } : 'undefined');

    const updateData = {
      title,
      type,
      questions,
      updated_at: new Date()
    };

    // Only update lexis if provided
    if (lexis !== undefined) {
      updateData.lexis = lexis;
    }

    // Only update lexisAudio if provided
    if (lexisAudio !== undefined) {
      updateData.lexisAudio = lexisAudio;
      console.log('[SERVER PUT /api/tests/:id] Adding lexisAudio to updateData');
    }

    // Only update preview if provided
    if (preview !== undefined) {
      updateData.preview = preview;
      console.log('[SERVER PUT /api/tests/:id] Adding preview to updateData');
    }

    // Only update classroomActivity if provided
    if (classroomActivity !== undefined) {
      updateData.classroomActivity = classroomActivity;
    }

    // Only update transferQuestion if provided
    if (transferQuestion !== undefined) {
      updateData.transferQuestion = transferQuestion;
    }

    // Only update speakerCount if provided
    if (speakerCount !== undefined) {
      updateData.speaker_count = speakerCount;
    }

    // Only update difficulty if provided
    if (difficulty !== undefined) {
      updateData.difficulty = difficulty;
    }

    // Only update bonusQuestions if provided
    if (bonusQuestions !== undefined) {
      updateData.bonus_questions = bonusQuestions;
    }

    // Upload any base64 audio to Cloudinary before saving
    await processTestAudioUploads(req.params.id, updateData);

    const test = await ListeningTest.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    );

    if (!test) {
      return res.status(404).json({ error: 'Test not found' });
    }

    console.log('[SERVER PUT /api/tests/:id] Saved test has preview:', test.preview ? test.preview.length + ' activities' : 'none');
    console.log('[SERVER PUT /api/tests/:id] Saved test has lexisAudio:', test.lexisAudio ? { engine: test.lexisAudio.engine, urlLength: test.lexisAudio.url?.length } : 'undefined');
    res.json(test);
  } catch (error) {
    console.error('Update test error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete test
app.delete('/api/tests/:id', authenticate, async (req, res) => {
  console.log('[DELETE /api/tests/:id] Requested ID:', req.params.id, '| type:', typeof req.params.id, '| length:', req.params.id?.length);
  try {
    const test = await ListeningTest.findById(req.params.id);
    if (!test) {
      console.log('[DELETE /api/tests/:id] Test NOT FOUND for ID:', req.params.id);
      return res.status(404).json({ error: 'Test not found' });
    }
    if (!canModify(test.created_by, req.user)) {
      return res.status(403).json({ error: 'You can only delete your own tests' });
    }
    await ListeningTest.findByIdAndDelete(req.params.id);
    console.log('[DELETE /api/tests/:id] Deleted test:', test._id, '| title:', test.title);

    // Clean up Cloudinary audio assets (fire-and-forget)
    const testId = test._id.toString();
    const deletions = [
      deleteFromCloudinary(`vocalize-test-audio/lexis_audio_${testId}`),
      deleteFromCloudinary(`vocalize-test-audio/classroom_en_${testId}`),
      deleteFromCloudinary(`vocalize-test-audio/classroom_ar_${testId}`),
    ];
    if (test.lexisAudio?.wordAudios) {
      for (const wordId of Object.keys(test.lexisAudio.wordAudios)) {
        deletions.push(
          deleteFromCloudinary(`vocalize-test-audio/word_audio_${testId}_${wordId}`)
        );
      }
    }
    Promise.all(deletions).catch(err =>
      console.error('[DELETE /api/tests] Cloudinary cleanup error:', err)
    );

    res.json({ message: 'Test deleted' });
  } catch (error) {
    console.error('[DELETE /api/tests/:id] ERROR for ID:', req.params.id, error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== SETTINGS ROUTES ====================

// Get app settings
app.get('/api/settings', async (req, res) => {
  try {
    let settings = await AppSettings.findById('default');

    // Create default settings if none exist
    if (!settings) {
      settings = new AppSettings({
        _id: 'default',
        difficulty_level: 'B1',
        content_mode: 'standard',
        classroom_theme: 'light'
      });
      await settings.save();
    }

    res.json({
      appMode: settings.app_mode || 'listening',
      difficultyLevel: settings.difficulty_level,
      contentMode: settings.content_mode,
      classroomTheme: settings.classroom_theme || 'light'
    });
  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update app settings
app.put('/api/settings', authenticate, requireAdmin, async (req, res) => {
  try {
    const { appMode, difficultyLevel, contentMode, classroomTheme } = req.body;

    const settings = await AppSettings.findByIdAndUpdate(
      'default',
      {
        $set: {
          app_mode: appMode,
          difficulty_level: difficultyLevel,
          content_mode: contentMode,
          classroom_theme: classroomTheme,
          updated_at: new Date()
        }
      },
      { new: true, upsert: true }
    );

    res.json({
      appMode: settings.app_mode || 'listening',
      difficultyLevel: settings.difficulty_level,
      contentMode: settings.content_mode,
      classroomTheme: settings.classroom_theme
    });
  } catch (error) {
    console.error('Update settings error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== DOCUMENT IMPORT ROUTES ====================

// Get supported file types
app.get('/api/import/supported-types', authenticate, (req, res) => {
  res.json(getSupportedTypes());
});

// Import document (PDF, DOCX, TXT) and parse questions
app.post('/api/import/document', authenticate, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    console.log(`[Import] Processing file: ${req.file.originalname} (${req.file.size} bytes)`);

    // Parse the document
    const result = await parseDocument(req.file.buffer, req.file.originalname);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error,
      });
    }

    // Return parsed data
    res.json({
      success: true,
      questions: result.questions,
      transcript: result.transcript,
      vocabulary: result.vocabulary,
      confidence: result.confidence,
      warnings: result.warnings,
      questionCount: result.questions.length,
      // Always include raw text for answer key parsing
      rawText: result.rawText,
    });

  } catch (error) {
    console.error('[Import] Error:', error);

    // Handle multer errors
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large. Maximum size is 10MB.' });
    }

    res.status(500).json({ error: error.message });
  }
});

// Error handler for multer
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large. Maximum size is 10MB.' });
    }
    return res.status(400).json({ error: error.message });
  }
  next(error);
});

// Health check
app.get('/api/health', (req, res) => {
  const mongoState = ['disconnected', 'connected', 'connecting', 'disconnecting'][mongoose.connection.readyState] || 'unknown';
  console.log(`[Health] mongo: ${mongoState} | uptime: ${Math.round(process.uptime())}s`);
  res.json({
    status: 'ok',
    mongodb: mongoose.connection.readyState === 1,
    mongoState,
    uptime: Math.round(process.uptime()),
    cloudinary: !!process.env.CLOUDINARY_CLOUD_NAME
  });
});

// Serve static files from the React app in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../dist')));

  // Handle React routing, return all requests to React app
  app.get('/{*splat}', (req, res) => {
    res.sendFile(path.join(__dirname, '../dist', 'index.html'));
  });
}

// Log MongoDB connection events for cold start diagnosis
mongoose.connection.on('disconnected', () => console.log('[MongoDB] Disconnected'));
mongoose.connection.on('reconnected', () => console.log('[MongoDB] Reconnected'));
mongoose.connection.on('error', (err) => console.error('[MongoDB] Connection error:', err.message));

app.listen(PORT, () => {
  console.log(`[Server] Started on port ${PORT} at ${new Date().toISOString()}`);
});
