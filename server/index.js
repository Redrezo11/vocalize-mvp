import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import { v2 as cloudinary } from 'cloudinary';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';
import { parseDocument, validateFile, getSupportedTypes } from './utils/documentParser/index.js';

// Load env from .env.local in development, Heroku provides env vars in production
dotenv.config({ path: '.env.local' });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));

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
  .then(() => console.log('[MongoDB] Connected successfully'))
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
  audioId: { type: mongoose.Schema.Types.ObjectId, ref: 'AudioEntry', required: false, default: null },  // null for transcript-only tests
  title: { type: String, required: true },
  type: { type: String, enum: ['listening-comprehension', 'fill-in-blank', 'dictation'], required: true },
  questions: [testQuestionSchema],
  lexis: [lexisItemSchema],  // Vocabulary items for the test
  lexisAudio: { type: mongoose.Schema.Types.Mixed, default: null },  // Generated vocabulary audio
  preview: [previewActivitySchema],  // Pre-listening preview activities
  difficulty: { type: String, enum: ['A1', 'A2', 'B1', 'B2', 'C1'] },  // CEFR level
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
  difficulty_level: { type: String, enum: ['A1', 'A2', 'B1', 'B2', 'C1'], default: 'B1' },
  content_mode: { type: String, enum: ['standard', 'halal', 'elsd'], default: 'standard' },
  classroom_theme: { type: String, enum: ['light', 'dark'], default: 'light' },
  updated_at: { type: Date, default: Date.now }
});

const AppSettings = mongoose.model('AppSettings', appSettingsSchema);

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

// API Routes

// Get all audio entries
app.get('/api/audio-entries', async (req, res) => {
  try {
    const count = await AudioEntry.countDocuments();
    console.log('[API] Audio entries count:', count);
    const entries = await AudioEntry.find().sort({ updated_at: -1 });
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
      return res.status(404).json({ error: 'Entry not found' });
    }
    res.json(entry);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create audio entry
app.post('/api/audio-entries', async (req, res) => {
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
      difficulty: difficulty || null
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
app.put('/api/audio-entries/:id', async (req, res) => {
  try {
    const { title, transcript, audio_data, duration, engine, speaker_mapping, speakers, is_transcript_only, difficulty } = req.body;

    const existingEntry = await AudioEntry.findById(req.params.id);
    if (!existingEntry) {
      return res.status(404).json({ error: 'Entry not found' });
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
app.delete('/api/audio-entries/:id', async (req, res) => {
  try {
    const entry = await AudioEntry.findById(req.params.id);
    if (!entry) {
      return res.status(404).json({ error: 'Entry not found' });
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
app.get('/api/audio-entries/:audioId/tests', async (req, res) => {
  try {
    const tests = await ListeningTest.find({ audioId: req.params.audioId }).sort({ created_at: -1 });
    res.json(tests);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all tests
app.get('/api/tests', async (req, res) => {
  try {
    const tests = await ListeningTest.find().sort({ created_at: -1 });
    res.json(tests);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get single test
app.get('/api/tests/:id', async (req, res) => {
  try {
    const test = await ListeningTest.findById(req.params.id);
    if (!test) {
      return res.status(404).json({ error: 'Test not found' });
    }
    res.json(test);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create test
app.post('/api/tests', async (req, res) => {
  try {
    const { audioId, title, type, questions, lexis, preview, difficulty } = req.body;

    console.log('[POST /api/tests] Creating test with preview:', preview ? preview.length + ' activities' : 'none');

    // Skip audio verification for transcript-only tests (audioId starts with "transcript-")
    const isTranscriptOnly = audioId && audioId.startsWith('transcript-');

    if (!isTranscriptOnly) {
      // Verify audio entry exists for normal tests
      const audioEntry = await AudioEntry.findById(audioId);
      if (!audioEntry) {
        return res.status(404).json({ error: 'Audio entry not found' });
      }
    }

    const test = new ListeningTest({
      audioId: isTranscriptOnly ? null : audioId,  // Don't store fake IDs
      title,
      type,
      questions,
      lexis: lexis || [],
      preview: preview || [],
      difficulty: difficulty || null
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
app.put('/api/tests/:id', async (req, res) => {
  try {
    const { title, type, questions, lexis, lexisAudio, preview, difficulty } = req.body;

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

    // Only update difficulty if provided
    if (difficulty !== undefined) {
      updateData.difficulty = difficulty;
    }

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
app.delete('/api/tests/:id', async (req, res) => {
  try {
    const test = await ListeningTest.findByIdAndDelete(req.params.id);
    if (!test) {
      return res.status(404).json({ error: 'Test not found' });
    }
    res.json({ message: 'Test deleted' });
  } catch (error) {
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
app.put('/api/settings', async (req, res) => {
  try {
    const { difficultyLevel, contentMode, classroomTheme } = req.body;

    const settings = await AppSettings.findByIdAndUpdate(
      'default',
      {
        $set: {
          difficulty_level: difficultyLevel,
          content_mode: contentMode,
          classroom_theme: classroomTheme,
          updated_at: new Date()
        }
      },
      { new: true, upsert: true }
    );

    res.json({
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
app.get('/api/import/supported-types', (req, res) => {
  res.json(getSupportedTypes());
});

// Import document (PDF, DOCX, TXT) and parse questions
app.post('/api/import/document', upload.single('file'), async (req, res) => {
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
  res.json({
    status: 'ok',
    mongodb: mongoose.connection.readyState === 1,
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

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
