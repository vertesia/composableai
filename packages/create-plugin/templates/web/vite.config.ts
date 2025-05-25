import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts'; // Generates TypeScript declarations
import { vertesiaPluginBuilder } from '@vertesia/plugin-builder';

const EXTERNALS = [
  'react',
  'react-dom',
  'react/jsx-runtime',
  'react-dom/client',
  '@vertesia/ui',
  // add any other external dependencies here
];

// https://vite.dev/config/
export default defineConfig(({ command }) => {
  // Check if we're running "vite build"
  const isBuildMode = command === 'build';

  return {
    plugins: [
      tailwindcss(),
      react(),
      dts({
        rollupTypes: true,
        tsconfigPath: './tsconfig.app.json',
        logLevel: 'info'
      }),
      vertesiaPluginBuilder(),
    ],
    optimizeDeps: isBuildMode ? {
      exclude: EXTERNALS
    } : undefined,
    build: {
      lib: isBuildMode ? {
        entry: './src/index.tsx', // Main entry point of your library
        formats: ['es'], // Build ESM versions
        fileName: "plugin",
      } : undefined,
      minify: false,
      rollupOptions: {
        external: isBuildMode ? EXTERNALS : [],
      }
    }
  }
})
