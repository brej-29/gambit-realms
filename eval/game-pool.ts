import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { Worker } from 'node:worker_threads';
import type { GameRecord, GameTask } from './game';

interface Slot {
  worker: Worker;
  task?: GameTask;
}

type Message = GameRecord | { seed: number; error: string };

export class GamePool {
  private readonly slots: Slot[];
  private readonly queue: GameTask[] = [];
  private results: GameRecord[] = [];
  private disposed = false;
  private completed = 0;
  private resolveAll?: (results: GameRecord[]) => void;
  private rejectAll?: (error: Error) => void;
  private onComplete?: (completed: number, total: number, result?: GameRecord) => void;
  private total = 0;

  constructor(size: number) {
    const loader = pathToFileURL(createRequire(import.meta.url).resolve('tsx/esm')).href;
    this.slots = Array.from({ length: Math.max(1, size) }, () => {
      const worker = new Worker(new URL('./game-worker.ts', import.meta.url), { execArgv: ['--import', loader] });
      const slot: Slot = { worker };
      worker.on('message', (message: Message) => this.finish(slot, message));
      worker.on('error', (error) => this.fail(error instanceof Error ? error : new Error(String(error))));
      return slot;
    });
  }

  run(tasks: readonly GameTask[], onComplete?: (completed: number, total: number, result?: GameRecord) => void): Promise<GameRecord[]> {
    if (this.disposed) return Promise.reject(new Error('game pool has been disposed'));
    if (!tasks.length) return Promise.resolve([]);
    this.results = [];
    this.completed = 0;
    this.total = tasks.length;
    this.onComplete = onComplete;
    this.queue.push(...tasks);
    return new Promise((resolve, reject) => {
      this.resolveAll = resolve;
      this.rejectAll = reject;
      this.pump();
    });
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.rejectAll?.(new Error('game pool disposed'));
    for (const slot of this.slots) {
      slot.worker.postMessage({ type: 'dispose' });
      void slot.worker.terminate();
    }
  }

  private pump(): void {
    if (this.disposed) return;
    for (const slot of this.slots) {
      if (slot.task) continue;
      const task = this.queue.shift();
      if (!task) break;
      slot.task = task;
      slot.worker.postMessage(task);
    }
    if (!this.queue.length && this.completed === this.total && this.resolveAll) {
      const resolve = this.resolveAll;
      this.resolveAll = undefined;
      this.rejectAll = undefined;
      resolve([...this.results]);
    }
  }

  private finish(slot: Slot, message: Message): void {
    const task = slot.task;
    if (!task) return;
    slot.task = undefined;
    if ('error' in message) {
      this.fail(new Error(`game ${message.seed}: ${message.error}`));
      return;
    }
    this.results.push(message);
    this.completed++;
    this.onComplete?.(this.completed, this.total, message);
    this.pump();
    if (this.resolveAll && this.completed === this.total) {
      const resolve = this.resolveAll;
      this.resolveAll = undefined;
      this.rejectAll = undefined;
      this.onComplete = undefined;
      resolve([...this.results]);
    }
  }

  private fail(error: Error): void {
    if (this.disposed) return;
    this.disposed = true;
    this.rejectAll?.(error);
    for (const slot of this.slots) void slot.worker.terminate();
  }
}
