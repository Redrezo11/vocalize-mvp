import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';
import { parseDocument, validateFile, getSupportedTypes } from './utils/documentParser/index.js';

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
  example: { type: String },
  partOfSpeech: { type: String }
});

// Listening Test Schema
const listeningTestSchema = new mongoose.Schema({
  audioId: { type: mongoose.Schema.Types.ObjectId, ref: 'AudioEntry', required: false, default: null },  // null for transcript-only tests
  title: { type: String, required: true },
  type: { type: String, enum: ['listening-comprehension', 'fill-in-blank', 'dictation'], required: true },
  questions: [testQuestionSchema],
  lexis: [lexisItemSchema],  // Vocabulary items for the test
  lexisAudio: { type: mongoose.Schema.Types.Mixed, default: null },  // Simple Mixed type - no validation issues
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
});

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

// API Routes

// Get all audio entries
app.get('/api/audio-entries', async (req, res) => {
  try {
    const entries = await AudioEntry.find().sort({ updated_at: -1 });
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

// Create audio entry (stores audio as base64 in DB for local dev - no Cloudinary)
app.post('/api/audio-entries', async (req, res) => {
  try {
    const { title, transcript, audio_data, duration, engine, speaker_mapping, speakers, is_transcript_only, difficulty } = req.body;

    // For local dev, store audio as data URL directly
    let audioUrl = null;
    if (audio_data && !is_transcript_only) {
      audioUrl = `data:audio/mpeg;base64,${audio_data}`;
    }

    const entry = new AudioEntry({
      title,
      transcript,
      audio_url: audioUrl,
      duration,
      engine,
      speaker_mapping,
      speakers,
      is_transcript_only: is_transcript_only || false,
      difficulty: difficulty || null
    });

    await entry.save();
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

    // For local dev, store audio as data URL directly
    if (audio_data) {
      updateData.audio_url = `data:audio/mpeg;base64,${audio_data}`;
      updateData.duration = duration;
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
    const { audioId, title, type, questions, lexis } = req.body;

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
      lexis: lexis || []
    });

    await test.save();
    res.status(201).json(test);
  } catch (error) {
    console.error('Create test error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update test
app.put('/api/tests/:id', async (req, res) => {
  try {
    const { title, type, questions, lexis, lexisAudio } = req.body;

    console.log('[PUT /api/tests/:id] Received lexisAudio:', lexisAudio ? { engine: lexisAudio.engine, urlLength: lexisAudio.url?.length } : 'undefined');

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
      console.log('[PUT /api/tests/:id] Adding lexisAudio to updateData');
    }

    const test = await ListeningTest.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    );

    if (!test) {
      return res.status(404).json({ error: 'Test not found' });
    }

    console.log('[PUT /api/tests/:id] Saved test has lexisAudio:', test.lexisAudio ? { engine: test.lexisAudio.engine, urlLength: test.lexisAudio.url?.length } : 'undefined');
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
      rawText: result.rawText,
    });

  } catch (error) {
    console.error('[Import] Error:', error);

    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large. Maximum size is 10MB.' });
    }

    res.status(500).json({ error: error.message });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    mongodb: mongoose.connection.readyState === 1,
    mode: 'local-memory'
  });
});

// Start server with local MongoDB
async function startServer() {
  const uri = 'mongodb://localhost:27017/vocalize-local';
  console.log('Connecting to local MongoDB...');

  await mongoose.connect(uri);
  console.log('Connected to local MongoDB:', uri);

  app.listen(PORT, () => {
    console.log(`Local server running on port ${PORT}`);
    console.log('Data is persisted in database: vocalize-local');
  });

  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\nShutting down...');
    await mongoose.disconnect();
    process.exit(0);
  });
}

startServer().catch(console.error);
