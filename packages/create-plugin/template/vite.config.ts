import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts'; // Generates TypeScript declarations
import { exportPluginCss } from '@vertesia/vite-plugin-export-css';
import { version } from "./package.json"

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
      dts({ rollupTypes: true }),
      exportPluginCss(),
    ],
    optimizeDeps: isBuildMode ? {
      exclude: EXTERNALS
    } : undefined,
    build: {
      lib: isBuildMode ? {
        entry: './src/index.tsx', // Main entry point of your library
        formats: ['es'], // Build ESM versions
        name: '${plugin_var_name}',
        fileName: `${plugin_name}-${version}`,
      } : undefined,
      minify: false,
      rollupOptions: {
        external: isBuildMode ? EXTERNALS : [],
      }
    }
  }
})
