import { parentPort } from 'node:worker_threads';
import { createNodeEngine } from '../src/engine/node';
import type { EngineOptions } from '../src/engine/types';

if (!parentPort) throw new Error('engine worker requires a parent port');
const port = parentPort;
const engine = createNodeEngine();

port.on('message', async (message: { id: number; fen: string; options: EngineOptions } | { type: 'dispose' }) => {
  if ('type' in message) {
    engine.dispose();
    return;
  }
  try {
    const lines = await engine.analyse(message.fen, message.options);
    port.postMessage({ id: message.id, lines });
  } catch (error: unknown) {
    port.postMessage({ id: message.id, error: error instanceof Error ? error.message : String(error) });
  }
});

