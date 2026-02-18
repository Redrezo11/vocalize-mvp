/**
 * One-time migration script: Backfill speaker_count on listening tests.
 *
 * For each listening test with speaker_count == null and an audioId,
 * looks up the AudioEntry's speakers array and sets speaker_count.
 *
 * Run:
 *   node server/migrate-speaker-count.js          (local, uses .env.local)
 *   heroku run node server/migrate-speaker-count.js  (production)
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const MONGODB_URI = process.env.MONGODB_URI || process.env.VITE_MONGODB_URI;

// Minimal schemas — only fields we need
const listeningTestSchema = new mongoose.Schema({
  audioId: { type: mongoose.Schema.Types.ObjectId, ref: 'AudioEntry' },
  title: String,
  type: String,
  speaker_count: { type: Number, default: null },
}, { strict: false });

const audioEntrySchema = new mongoose.Schema({
  speakers: [String],
}, { strict: false });

const ListeningTest = mongoose.model('ListeningTest', listeningTestSchema);
const AudioEntry = mongoose.model('AudioEntry', audioEntrySchema);

async function migrate() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(MONGODB_URI);
  console.log('Connected.\n');

  // Find listening tests without speaker_count
  const tests = await ListeningTest.find({
    speaker_count: null,
    type: { $regex: /^listening/ },
  });

  console.log(`Found ${tests.length} listening tests without speaker_count.\n`);

  let updated = 0;
  let skipped = 0;

  for (const test of tests) {
    if (!test.audioId) {
      console.log(`  [SKIP] "${test.title}" — no audioId`);
      skipped++;
      continue;
    }

    const audioEntry = await AudioEntry.findById(test.audioId);
    if (!audioEntry || !audioEntry.speakers || audioEntry.speakers.length === 0) {
      // Default to 2 (dialogue) if we can't determine
      console.log(`  [DEFAULT] "${test.title}" — no audio entry or empty speakers, defaulting to 2`);
      await ListeningTest.updateOne({ _id: test._id }, { speaker_count: 2 });
      updated++;
      continue;
    }

    const count = audioEntry.speakers.length;
    console.log(`  [UPDATE] "${test.title}" — ${count} speaker(s): ${audioEntry.speakers.join(', ')}`);
    await ListeningTest.updateOne({ _id: test._id }, { speaker_count: count });
    updated++;
  }

  console.log(`\nDone. Updated: ${updated}, Skipped: ${skipped}`);
  await mongoose.disconnect();
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
