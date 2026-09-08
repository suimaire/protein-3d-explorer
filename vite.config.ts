import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({ plugins: [react()], base: '/protein-3d-explorer/', build: { rollupOptions: { output: { manualChunks: (id) => id.includes('/three/') ? 'three' : undefined } } } });
