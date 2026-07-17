import fs from "fs";
import path from "path";
import { PaperTrade, StoreShape, TokenPosition, TrackedWallet } from "./types";

const DATA_DIR = path.join(__dirname, "..", "data");
const STORE_PATH = path.join(DATA_DIR, "state.json");

const EMPTY_STATE: StoreShape = {
  wallets: [],
  lastSignature: {},
  positions: {},
  paperPositions: {},
  closedPaperTrades: [],
};

export class Storage {
  private state: StoreShape;
  private persist: boolean;

  constructor(opts: { persist?: boolean } = {}) {
    this.persist = opts.persist ?? true;
    this.state = this.persist ? this.load() : structuredClone(EMPTY_STATE);
  }

  private load(): StoreShape {
    if (!fs.existsSync(STORE_PATH)) {
      return structuredClone(EMPTY_STATE);
    }
    try {
      const raw = fs.readFileSync(STORE_PATH, "utf-8");
      return { ...structuredClone(EMPTY_STATE), ...JSON.parse(raw) };
    } catch {
      return structuredClone(EMPTY_STATE);
    }
  }

  private save(): void {
    if (!this.persist) return;
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const tmpPath = `${STORE_PATH}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(this.state, null, 2));
    fs.renameSync(tmpPath, STORE_PATH);
  }

  getWallets(): TrackedWallet[] {
    return this.state.wallets;
  }

  addWallet(
    address: string,
    label?: string,
    ranking?: { realizedPnlSol?: number; winRate?: number }
  ): TrackedWallet {
    const existing = this.state.wallets.find((w) => w.address === address);
    if (existing) {
      if (ranking) {
        existing.realizedPnlSol = ranking.realizedPnlSol;
        existing.winRate = ranking.winRate;
        this.save();
      }
      return existing;
    }
    const wallet: TrackedWallet = {
      address,
      label,
      addedAt: Date.now(),
      realizedPnlSol: ranking?.realizedPnlSol,
      winRate: ranking?.winRate,
    };
    this.state.wallets.push(wallet);
    this.save();
    return wallet;
  }

  removeWallet(address: string): boolean {
    const before = this.state.wallets.length;
    this.state.wallets = this.state.wallets.filter((w) => w.address !== address);
    delete this.state.lastSignature[address];
    this.save();
    return this.state.wallets.length < before;
  }

  getLastSignature(address: string): string | undefined {
    return this.state.lastSignature[address];
  }

  setLastSignature(address: string, signature: string): void {
    this.state.lastSignature[address] = signature;
    this.save();
  }

  getPosition(mint: string): TokenPosition | undefined {
    return this.state.positions[mint];
  }

  upsertPosition(position: TokenPosition): void {
    this.state.positions[position.mint] = position;
    this.save();
  }

  getAllPositions(): TokenPosition[] {
    return Object.values(this.state.positions);
  }

  openPaperTrade(trade: PaperTrade): void {
    this.state.paperPositions[trade.mint] = trade;
    this.save();
  }

  getOpenPaperTrade(mint: string): PaperTrade | undefined {
    return this.state.paperPositions[mint];
  }

  getOpenPaperTrades(): PaperTrade[] {
    return Object.values(this.state.paperPositions);
  }

  closePaperTrade(mint: string, exit: NonNullable<PaperTrade["exit"]>): PaperTrade | undefined {
    const trade = this.state.paperPositions[mint];
    if (!trade) return undefined;
    trade.exit = exit;
    this.state.closedPaperTrades.push(trade);
    delete this.state.paperPositions[mint];
    this.save();
    return trade;
  }

  getClosedPaperTrades(): PaperTrade[] {
    return this.state.closedPaperTrades;
  }
}
