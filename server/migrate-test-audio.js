/**
 * One-time migration script: Upload inline base64 test audio to Cloudinary.
 *
 * Run after deploying Phase 2 server code:
 *   node server/migrate-test-audio.js          (local, uses .env.local)
 *   heroku run node server/migrate-test-audio.js  (production)
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { v2 as cloudinary } from 'cloudinary';

dotenv.config({ path: '.env.local' });

// Cloudinary config
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || process.env.VITE_MONGODB_URI;

// Minimal schema — only fields we need
const listeningTestSchema = new mongoose.Schema({
  title: String,
  lexisAudio: { type: mongoose.Schema.Types.Mixed, default: null },
  classroomActivity: { type: mongoose.Schema.Types.Mixed, default: null },
}, { strict: false });

const ListeningTest = mongoose.model('ListeningTest', listeningTestSchema);

// Upload helper (same as server/index.js)
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
    console.error(`  Upload failed for ${publicId}:`, error.message);
    return null;
  }
};

async function migrate() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(MONGODB_URI);
  console.log('Connected.\n');

  const tests = await ListeningTest.find({});
  console.log(`Found ${tests.length} tests total.\n`);

  let migrated = 0;
  let skipped = 0;
  let failed = 0;

  for (let i = 0; i < tests.length; i++) {
    const test = tests[i];
    const testId = test._id.toString();
    const title = test.title || '(untitled)';
    const uploads = [];
    let fieldCount = 0;

    // lexisAudio.url
    if (test.lexisAudio?.url?.startsWith('data:')) {
      fieldCount++;
      uploads.push(
        uploadTestAudio(test.lexisAudio.url, `lexis_audio_${testId}`)
          .then(url => { if (url) test.lexisAudio.url = url; })
      );
    }

    // lexisAudio.wordAudios
    if (test.lexisAudio?.wordAudios) {
      for (const [wordId, wordAudio] of Object.entries(test.lexisAudio.wordAudios)) {
        if (wordAudio.url?.startsWith('data:')) {
          fieldCount++;
          uploads.push(
            uploadTestAudio(wordAudio.url, `word_audio_${testId}_${wordId}`)
              .then(url => { if (url) wordAudio.url = url; })
          );
        }
      }
    }

    // classroomActivity.audioEn
    if (test.classroomActivity?.audioEn?.startsWith('data:')) {
      fieldCount++;
      uploads.push(
        uploadTestAudio(test.classroomActivity.audioEn, `classroom_en_${testId}`)
          .then(url => { if (url) test.classroomActivity.audioEn = url; })
      );
    }

    // classroomActivity.audioAr
    if (test.classroomActivity?.audioAr?.startsWith('data:')) {
      fieldCount++;
      uploads.push(
        uploadTestAudio(test.classroomActivity.audioAr, `classroom_ar_${testId}`)
          .then(url => { if (url) test.classroomActivity.audioAr = url; })
      );
    }

    if (uploads.length === 0) {
      skipped++;
      continue;
    }

    console.log(`[${i + 1}/${tests.length}] "${title}" — ${fieldCount} audio field(s)...`);

    try {
      await Promise.all(uploads);

      // Save updated document
      test.markModified('lexisAudio');
      test.markModified('classroomActivity');
      await test.save();

      migrated++;
      console.log(`  Done.\n`);
    } catch (error) {
      failed++;
      console.error(`  FAILED: ${error.message}\n`);
    }
  }

  console.log('=== Migration Complete ===');
  console.log(`Total:    ${tests.length}`);
  console.log(`Migrated: ${migrated}`);
  console.log(`Skipped:  ${skipped} (no base64 audio)`);
  console.log(`Failed:   ${failed}`);

  await mongoose.disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

migrate().catch(err => {
  console.error('Migration error:', err);
  process.exit(1);
});
