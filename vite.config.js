import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';
import { classicMarkup, seoTags } from './scripts/content.js';

export default defineConfig({
  plugins: [{
    name: 'cv-prerender',
    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        const graph = JSON.parse(readFileSync(new URL('./data/graph.json', import.meta.url), 'utf8'));
        return html.replace('<!--SEO-->', seoTags(graph)).replace('<!--CLASSIC-->', classicMarkup(graph));
      }
    }
  }],
  build: { target: 'es2022', chunkSizeWarningLimit: 650, rollupOptions: { output: { manualChunks: { three: ['three'] } } } },
  server: { port: 5173, strictPort: true }
});
