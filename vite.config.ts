import { defineConfig } from 'vite';

/**
 * GitHub Pages project site: https://throsturfh.github.io/Mystery/
 * CI may pass the path reported by actions/configure-pages (`base_path`).
 */
function pagesBase(): string {
  const configured = process.env.PAGES_BASE_PATH?.trim();
  const raw = configured && configured !== '/' ? configured : '/Mystery/';
  const withLeading = raw.startsWith('/') ? raw : `/${raw}`;
  return withLeading.endsWith('/') ? withLeading : `${withLeading}/`;
}

export default defineConfig({
  base: pagesBase(),
  server: {
    host: '0.0.0.0',
    port: 8734,
    strictPort: true,
  },
  preview: {
    host: '0.0.0.0',
    port: 8735,
    strictPort: true,
  },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 2000,
  },
});
