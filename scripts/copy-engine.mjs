// Copies the single-threaded lite Stockfish WASM build into public/engine so the
// browser worker can load it from the same origin (no COOP/COEP headers needed).
import { cpSync, mkdirSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
let pkgDir;
try {
  pkgDir = dirname(require.resolve('stockfish/package.json'));
} catch {
  console.warn('stockfish package not installed yet, skipping engine copy');
  process.exit(0);
}
const out = join(process.cwd(), 'public', 'engine');
mkdirSync(out, { recursive: true });
for (const f of ['stockfish-19-lite-single.js', 'stockfish-19-lite-single.wasm']) {
  const src = join(pkgDir, 'bin', f);
  if (!existsSync(src)) throw new Error(`missing ${src}`);
  cpSync(src, join(out, f));
}
console.log('engine copied to public/engine');
