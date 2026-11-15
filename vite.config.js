import { defineConfig } from 'vite';

// base './' so the build works from a GitHub Pages sub-path.
export default defineConfig({
  base: './',
  server: { port: 5173, strictPort: false },
  build: { chunkSizeWarningLimit: 800 }, // three.js alone is ~590 kB; it loads behind the loading screen
  test: {
    environment: 'node',
    include: ['core/**/*.test.js', 'stages/**/*.test.js', 'ui/**/*.test.js'],
  },
});
