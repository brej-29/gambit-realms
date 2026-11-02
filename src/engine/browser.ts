import type { Engine, EngineLine, EngineOptions } from './types';
import { clippedScore } from './types';

type Pending = {
  fen: string;
  options: EngineOptions;
  resolve: (lines: EngineLine[]) => void;
  reject: (error: Error) => void;
};

type InfoLine = EngineLine & { multipv: number };

function parseInfo(line: string): InfoLine | undefined {
  if (!line.startsWith('info ')) return undefined;
  const depth = Number(line.match(/\bdepth (\d+)/)?.[1] ?? 0);
  const multipv = Number(line.match(/\bmultipv (\d+)/)?.[1] ?? 1);
  const score = line.match(/\bscore (cp|mate) (-?\d+)/);
  const pv = line.match(/\bpv (.+)$/)?.[1]?.trim().split(/\s+/);
  if (!depth || !score || !pv?.length) return undefined;
  const value = Number(score[2]);
  return { uci: pv[0] ?? '', cp: score[1] === 'cp' ? clippedScore(value, undefined) : clippedScore(undefined, value), ...(score[1] === 'mate' ? { mate: value } : {}), pv, depth, multipv };
}

export class BrowserEngine implements Engine {
  private readonly worker: Worker;
  private readonly queue: Pending[] = [];
  private readonly latest = new Map<number, InfoLine>();
  private active: Pending | undefined;
  private ready = false;
  private disposed = false;

  constructor() {
    const base = import.meta.env.BASE_URL;
    this.worker = new Worker(`${base}engine/stockfish-19-lite-single.js`);
    this.worker.onmessage = (event: MessageEvent<string>) => this.onMessage(String(event.data));
    this.worker.onerror = (event) => this.active?.reject(new Error(event.message || 'Stockfish worker failed'));
    this.worker.postMessage('uci');
  }

  analyse(fen: string, options: EngineOptions): Promise<EngineLine[]> {
    if (this.disposed) return Promise.reject(new Error('engine has been disposed'));
    return new Promise((resolve, reject) => {
      this.queue.push({ fen, options, resolve, reject });
      this.pump();
    });
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    const error = new Error('engine disposed');
    this.active?.reject(error);
    for (const item of this.queue.splice(0)) item.reject(error);
    this.worker.terminate();
  }

  private onMessage(line: string): void {
    if (line === 'uciok') {
      this.worker.postMessage('isready');
      return;
    }
    if (line === 'readyok') {
      this.ready = true;
      this.pump();
      return;
    }
    const info = parseInfo(line);
    if (info && this.active) {
      const previous = this.latest.get(info.multipv);
      if (!previous || info.depth >= previous.depth) this.latest.set(info.multipv, info);
      return;
    }
    if (line.startsWith('bestmove ') && this.active) {
      const item = this.active;
      const lines = [...this.latest.entries()].sort(([a], [b]) => a - b).map(([, value]) => {
        const { multipv: _multipv, ...publicLine } = value;
        return publicLine;
      });
      this.active = undefined;
      this.latest.clear();
      item.resolve(lines);
      this.pump();
    }
  }

  private pump(): void {
    if (!this.ready || this.active || !this.queue.length || this.disposed) return;
    const item = this.queue.shift();
    if (!item) return;
    this.active = item;
    const { options } = item;
    const multipv = Math.max(1, Math.floor(options.multipv ?? 1));
    this.worker.postMessage('ucinewgame');
    this.worker.postMessage(`setoption name MultiPV value ${multipv}`);
    this.worker.postMessage(`setoption name UCI_LimitStrength value ${options.uciElo === undefined ? 'false' : 'true'}`);
    if (options.uciElo !== undefined) this.worker.postMessage(`setoption name UCI_Elo value ${Math.round(options.uciElo)}`);
    this.worker.postMessage(`setoption name Skill Level value ${Math.max(0, Math.min(20, Math.round(options.skill ?? 20)))}`);
    this.worker.postMessage(`position fen ${item.fen}`);
    this.worker.postMessage(`go ${options.nodes !== undefined ? `nodes ${Math.max(1, Math.floor(options.nodes))}` : `depth ${Math.max(1, Math.floor(options.depth ?? 12))}`}`);
  }
}

