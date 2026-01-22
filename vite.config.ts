import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
        proxy: {
          '/api': {
            target: 'http://localhost:3001',
            changeOrigin: true,
          },
        },
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      build: {
        rollupOptions: {
          output: {
            manualChunks: (id) => {
              // Core React - loaded first
              if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) {
                return 'vendor-react';
              }
              // Google/Gemini SDK - large, split out
              if (id.includes('@google/genai')) {
                return 'vendor-google';
              }
              // Anthropic SDK
              if (id.includes('@anthropic-ai')) {
                return 'vendor-anthropic';
              }
              // Supabase (if still used)
              if (id.includes('@supabase')) {
                return 'vendor-supabase';
              }
            }
          }
        },
        // Increase chunk size warning limit
        chunkSizeWarningLimit: 500,
        // Target modern browsers for smaller bundles
        target: 'es2020',
        // Minify for production
        minify: 'esbuild',
      }
    };
});
