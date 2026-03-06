import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => {
    if (mode === 'lib') {
        return {
            plugins: [react()],
            build: {
                outDir: 'lib',
                lib: {
                    entry: './src/index.ts',
                    formats: ['es'],
                    fileName: 'tools-admin-ui',
                },
                minify: false,
                sourcemap: true,
                emptyOutDir: false,
                rollupOptions: {
                    external: (id: string) =>
                        !id.startsWith('.') &&
                        !id.startsWith('/') &&
                        !id.startsWith('virtual:'),
                },
            },
        };
    }

    // Dev mode — standalone admin UI with Tailwind
    return {
        plugins: [react(), tailwindcss()],
        server: {
            port: 5174,
        },
    };
});
