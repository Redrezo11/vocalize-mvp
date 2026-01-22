/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ELEVENLABS_API_KEY: string;
  readonly VITE_GEMINI_API_KEY: string;
  readonly VITE_ANTHROPIC_API_KEY: string;
  readonly VITE_MONGODB_URI: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
