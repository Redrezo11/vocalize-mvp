-- Create audio_entries table
CREATE TABLE IF NOT EXISTS audio_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  transcript TEXT NOT NULL,
  audio_url TEXT,
  engine TEXT NOT NULL CHECK (engine IN ('BROWSER', 'GEMINI', 'ELEVEN_LABS')),
  speaker_mapping JSONB DEFAULT '{}',
  speakers TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create index for faster sorting by updated_at
CREATE INDEX IF NOT EXISTS idx_audio_entries_updated_at ON audio_entries(updated_at DESC);

-- Enable Row Level Security (but allow all for now - no auth)
ALTER TABLE audio_entries ENABLE ROW LEVEL SECURITY;

-- Policy to allow all operations (public access, no auth required)
CREATE POLICY "Allow all access to audio_entries" ON audio_entries
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Create storage bucket for audio files
INSERT INTO storage.buckets (id, name, public)
VALUES ('audio-files', 'audio-files', true)
ON CONFLICT (id) DO NOTHING;

-- Policy to allow public read access to audio files
CREATE POLICY "Public read access for audio files" ON storage.objects
  FOR SELECT
  USING (bucket_id = 'audio-files');

-- Policy to allow public upload to audio files
CREATE POLICY "Public upload access for audio files" ON storage.objects
  FOR INSERT
  WITH CHECK (bucket_id = 'audio-files');

-- Policy to allow public delete of audio files
CREATE POLICY "Public delete access for audio files" ON storage.objects
  FOR DELETE
  USING (bucket_id = 'audio-files');
