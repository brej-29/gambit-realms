import { createRequire } from 'node:module';
import type { Engine, EngineLine, EngineOptions } from './types';
import { clippedScore } from './types';

type StockfishMessage = (line: string) => void;
type StockfishProcess = {
  processCommand(command: string): void;
  terminate(): void;
};
type StockfishFactory = (flavour: string, onMessage: StockfishMessage) => StockfishProcess;

const require = createRequire(import.meta.url);

function parseInfo(line: string): EngineLine | undefined {
  if (!line.startsWith('info ')) return undefined;
  const depthMatch = line.match(/\bdepth (\d+)/);
  const multipvMatch = line.match(/\bmultipv (\d+)/);
  const scoreMatch = line.match(/\bscore (cp|mate) (-?\d+)/);
  const pvMatch = line.match(/\bpv (.+)$/);
  if (!depthMatch || !scoreMatch || !pvMatch) return undefined;
  const scoreKind = scoreMatch[1];
  const scoreValue = Number(scoreMatch[2]);
  return {
    uci: pvMatch[1]!.trim().split(/\s+/)[0] ?? '',
    cp: scoreKind === 'cp' ? clippedScore(scoreValue, undefined) : clippedScore(undefined, scoreValue),
    ...(scoreKind === 'mate' ? { mate: scoreValue } : {}),
    pv: pvMatch[1]!.trim().split(/\s+/),
    depth: Number(depthMatch[1]),
    // The adapter keeps this private field while a request is active.
    ...(multipvMatch ? { __multipv: Number(multipvMatch[1]) } : {}),
  } as EngineLine & { __multipv?: number };
}

type Pending = {
  fen: string;
  options: EngineOptions;
  resolve: (lines: EngineLine[]) => void;
  reject: (error: Error) => void;
};

export class NodeEngine implements Engine {
  private readonly engine: StockfishProcess;
  private readonly queue: Pending[] = [];
  private active: Pending | undefined;
  private ready = false;
  private readyRequested = false;
  private disposed = false;
  private readonly latest = new Map<number, EngineLine & { __multipv?: number }>();
  private readonly readyWaiters: Array<() => void> = [];
  private readonly keepAlive = setInterval(() => undefined, 100);

  constructor() {
    const factory = require('stockfish') as StockfishFactory;
    this.engine = factory('lite-single', (line) => this.onMessage(line));
    this.engine.processCommand('uci');
  }

  analyse(fen: string, options: EngineOptions): Promise<EngineLine[]> {
    if (this.disposed) return Promise.reject(new Error('engine has been disposed'));
    return new Promise<EngineLine[]>((resolve, reject) => {
      this.queue.push({ fen, options, resolve, reject });
      this.pump();
    });
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    const error = new Error('engine disposed');
    this.active?.reject(error);
    for (const request of this.queue.splice(0)) request.reject(error);
    clearInterval(this.keepAlive);
    this.engine.terminate();
  }

  private onMessage(line: string): void {
    if (line.includes('uciok')) {
      if (this.readyRequested) return this.handleReadyToken(line);
      this.readyRequested = true;
      setImmediate(() => this.engine.processCommand('isready'));
    }
    if (line.includes('readyok')) this.handleReadyToken(line);
    const info = parseInfo(line);
    if (info && this.active) {
      const multipv = (info as EngineLine & { __multipv?: number }).__multipv ?? 1;
      const previous = this.latest.get(multipv);
      if (!previous || info.depth >= previous.depth) this.latest.set(multipv, info as EngineLine & { __multipv?: number });
      return;
    }
    if (line.startsWith('bestmove ') && this.active) {
      const request = this.active;
      const lines = [...this.latest.entries()]
        .sort(([a], [b]) => a - b)
        .map(([, value]) => {
          const { __multipv: _multipv, ...publicLine } = value;
          return publicLine;
        });
      this.active = undefined;
      this.latest.clear();
      request.resolve(lines);
      this.pump();
    }
  }

  private handleReadyToken(_line: string): void {
    if (this.ready) return;
    this.ready = true;
      for (const waiter of this.readyWaiters.splice(0)) waiter();
      this.pump();
  }

  private pump(): void {
    if (!this.ready || this.active || this.disposed || this.queue.length === 0) return;
    const request = this.queue.shift();
    if (!request) return;
    this.active = request;
    // The single-thread WASM build aborts when commands are issued from inside its own output callback.
    setImmediate(() => this.send(request));
  }

  private send(request: Pending): void {
    this.engine.processCommand('ucinewgame');
    const multipv = Math.max(1, Math.floor(request.options.multipv ?? 1));
    this.engine.processCommand(`setoption name MultiPV value ${multipv}`);
    this.engine.processCommand('setoption name UCI_LimitStrength value ' + (request.options.uciElo === undefined ? 'false' : 'true'));
    if (request.options.uciElo !== undefined) this.engine.processCommand(`setoption name UCI_Elo value ${Math.round(request.options.uciElo)}`);
    this.engine.processCommand(`setoption name Skill Level value ${Math.max(0, Math.min(20, Math.round(request.options.skill ?? 20)))}`);
    this.engine.processCommand(`position fen ${request.fen}`);
    const limit = request.options.nodes !== undefined ? `nodes ${Math.max(1, Math.floor(request.options.nodes))}` : `depth ${Math.max(1, Math.floor(request.options.depth ?? 12))}`;
    this.engine.processCommand(`go ${limit}`);
  }
}

export function createNodeEngine(): Engine {
  return new NodeEngine();
}

