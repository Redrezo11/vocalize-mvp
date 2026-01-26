import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));

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

// Listening Test Schema
const listeningTestSchema = new mongoose.Schema({
  audioId: { type: mongoose.Schema.Types.ObjectId, ref: 'AudioEntry', required: false, default: null },  // null for transcript-only tests
  title: { type: String, required: true },
  type: { type: String, enum: ['listening-comprehension', 'fill-in-blank', 'dictation'], required: true },
  questions: [testQuestionSchema],
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
});

const ListeningTest = mongoose.model('ListeningTest', listeningTestSchema);

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
    const { title, transcript, audio_data, duration, engine, speaker_mapping, speakers } = req.body;

    // For local dev, store audio as data URL directly
    let audioUrl = null;
    if (audio_data) {
      audioUrl = `data:audio/mpeg;base64,${audio_data}`;
    }

    const entry = new AudioEntry({
      title,
      transcript,
      audio_url: audioUrl,
      duration,
      engine,
      speaker_mapping,
      speakers
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
    const { title, transcript, audio_data, duration, engine, speaker_mapping, speakers } = req.body;

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
    const { audioId, title, type, questions } = req.body;

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
      questions
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
    const { title, type, questions } = req.body;

    const test = await ListeningTest.findByIdAndUpdate(
      req.params.id,
      {
        title,
        type,
        questions,
        updated_at: new Date()
      },
      { new: true }
    );

    if (!test) {
      return res.status(404).json({ error: 'Test not found' });
    }

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
