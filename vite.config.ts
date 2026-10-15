import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  worker: {format: 'es'},
  plugins: [svelte()],
  server: {hmr: false},
  build: {
    outDir: process.env.DECK_STUDIO_BUILD_DIR || 'dist',
    target: 'es2022',
    manifest: true,
    rollupOptions: {input: {studio: 'index.html', characters: 'characters.html', brand: 'brand.html'},output:{codeSplitting:{groups:[...['chart-caption','chart-continuation','template-edit-adaptation','table-fit'].map(name=>({name,test:new RegExp(`/src/core/${name}\\.ts$`),includeDependenciesRecursively:false})),{name:'command-search',test:/\/src\/components\/ui\/(?:CommandSearch|SearchResults|SearchField)\.svelte$/,includeDependenciesRecursively:false}]}}},
  },
});
