import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { Worker } from 'node:worker_threads';
import type { Engine, EngineLine, EngineOptions } from '../src/engine/types';

interface Request {
  id: number;
  fen: string;
  options: EngineOptions;
  resolve: (lines: EngineLine[]) => void;
  reject: (error: Error) => void;
}

interface WorkerSlot {
  worker: Worker;
  busy: boolean;
  request?: Request;
}

export class EnginePool implements Engine {
  private readonly slots: WorkerSlot[];
  private readonly queue: Request[] = [];
  private nextId = 1;
  private disposed = false;

  constructor(size: number) {
    const loader = pathToFileURL(createRequire(import.meta.url).resolve('tsx/esm')).href;
    this.slots = Array.from({ length: Math.max(1, size) }, () => {
      const worker = new Worker(new URL('./engine-worker.ts', import.meta.url), { execArgv: ['--import', loader] });
      const slot: WorkerSlot = { worker, busy: false };
      worker.on('message', (message: { id: number; lines?: EngineLine[]; error?: string }) => this.finish(slot, message));
      worker.on('error', (error) => this.fail(slot, error instanceof Error ? error : new Error(String(error))));
      return slot;
    });
  }

  analyse(fen: string, options: EngineOptions): Promise<EngineLine[]> {
    if (this.disposed) return Promise.reject(new Error('engine pool has been disposed'));
    return new Promise((resolve, reject) => {
      this.queue.push({ id: this.nextId++, fen, options, resolve, reject });
      this.pump();
    });
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    const error = new Error('engine pool disposed');
    for (const request of this.queue.splice(0)) request.reject(error);
    for (const slot of this.slots) {
      slot.request?.reject(error);
      slot.worker.postMessage({ type: 'dispose' });
      void slot.worker.terminate();
    }
  }

  private pump(): void {
    if (this.disposed) return;
    for (const slot of this.slots) {
      if (slot.busy) continue;
      const request = this.queue.shift();
      if (!request) return;
      slot.busy = true;
      slot.request = request;
      slot.worker.postMessage({ id: request.id, fen: request.fen, options: request.options });
    }
  }

  private finish(slot: WorkerSlot, message: { id: number; lines?: EngineLine[]; error?: string }): void {
    const request = slot.request;
    if (!request || request.id !== message.id) return;
    slot.request = undefined;
    slot.busy = false;
    if (message.error) request.reject(new Error(message.error));
    else request.resolve(message.lines ?? []);
    this.pump();
  }

  private fail(slot: WorkerSlot, error: Error): void {
    slot.request?.reject(error);
    slot.request = undefined;
    slot.busy = false;
    this.pump();
  }
}

