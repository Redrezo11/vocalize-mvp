import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import { v2 as cloudinary } from 'cloudinary';
import path from 'path';
import { fileURLToPath } from 'url';

// Load env from .env.local in development, Heroku provides env vars in production
dotenv.config({ path: '.env.local' });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Cloudinary Configuration
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// MongoDB Connection - use MONGODB_URI in production, fall back to VITE_MONGODB_URI for local dev
const MONGODB_URI = process.env.MONGODB_URI || process.env.VITE_MONGODB_URI;

mongoose.connect(MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
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

// Create audio entry
app.post('/api/audio-entries', async (req, res) => {
  try {
    const { title, transcript, audio_data, duration, engine, speaker_mapping, speakers, is_transcript_only } = req.body;
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
      is_transcript_only: is_transcript_only || false
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
    const { title, transcript, audio_data, duration, engine, speaker_mapping, speakers, is_transcript_only } = req.body;

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
