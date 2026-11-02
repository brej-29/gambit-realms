import { defineConfig } from 'vitest/config';

// Relative base so the build works under any GitHub Pages sub-path.
export default defineConfig({ base: './', build: { target: 'es2022' }, test: { exclude: ['**/node_modules/**', '.worktrees/**', 'dist/**'] } });
