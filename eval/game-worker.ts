import { parentPort } from 'node:worker_threads';
import { createNodeEngine } from '../src/engine/node';
import { playGameTask, type GameTask } from './game';

if (!parentPort) throw new Error('game worker requires a parent port');
const engine = createNodeEngine();
parentPort.on('message', async (message: GameTask | { type: 'dispose' }) => {
  if ('type' in message) {
    engine.dispose();
    return;
  }
  try {
    parentPort!.postMessage(await playGameTask(message, engine));
  } catch (error: unknown) {
    parentPort!.postMessage({ seed: message.seed, error: error instanceof Error ? error.message : String(error) });
  }
});
