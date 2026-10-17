import { defineConfig } from 'vite';
import {runtimePublicAssets} from './scripts/public-assets.mjs';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig(({command}) => ({
  worker: {format: 'es'},
  publicDir: command === 'build' ? false : 'public',
  plugins: [svelte(), ...(process.env.VITE_DECK_RUNTIME === 'browser' ? [] : [runtimePublicAssets()])],
  server: {hmr: false},
  build: {
    outDir: process.env.DECK_STUDIO_BUILD_DIR || 'dist',
    target: 'es2022',
    manifest: true,
    rollupOptions: {input: {studio: 'index.html', characters: 'characters.html', brand: 'brand.html'},output:{codeSplitting:{groups:[{name:'startup-primitives',test:new RegExp("/(?:src/core/design\\-system\\-schema\\.ts|src/core/chart\\-schema\\.ts|src/core/interactions\\.ts|src/core/table\\-schema\\.ts|src/core/document\\-data\\.ts|src/core/document\\-media\\-transport\\.ts|src/core/template\\-scaling\\.ts|src/core/shapes\\.ts|src/core/slide\\-visibility\\.ts|src/core/shape\\-schema\\.ts|src/core/draft\\-store\\.ts|src/core/drawing\\-identity\\.ts|src/core/resource\\-purpose\\.ts|src/core/font\\-fallbacks\\.json|src/core/font\\-stack\\.ts|src/core/json\\-request\\.ts|src/core/chart\\-caption\\.ts|src/core/chart\\-format\\.ts|src/core/runtime\\.ts|src/core/container\\-tree\\.ts|src/core/inline\\-text\\-width\\.ts)$"),priority:100,includeDependenciesRecursively:false},{name:'line-geometry',test:/\/src\/core\/(?:line-path|hit-testing)\.ts$/,includeDependenciesRecursively:false},...['chart-caption','chart-continuation','template-edit-adaptation','table-fit'].map(name=>({name,test:new RegExp(`/src/core/${name}\\.ts$`),includeDependenciesRecursively:false})),{name:'command-search',test:/\/src\/components\/ui\/(?:CommandSearch|SearchResults|SearchField)\.svelte$/,includeDependenciesRecursively:false}]}}},
  },
}));
