import fs from "fs";
import path from "path";
import { StoreShape, TokenPosition, TrackedWallet } from "./types";

const DATA_DIR = path.join(__dirname, "..", "data");
const STORE_PATH = path.join(DATA_DIR, "state.json");

const EMPTY_STATE: StoreShape = {
  wallets: [],
  lastSignature: {},
  positions: {},
};

export class Storage {
  private state: StoreShape;

  constructor() {
    this.state = this.load();
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
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const tmpPath = `${STORE_PATH}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(this.state, null, 2));
    fs.renameSync(tmpPath, STORE_PATH);
  }

  getWallets(): TrackedWallet[] {
    return this.state.wallets;
  }

  addWallet(address: string, label?: string): TrackedWallet {
    const existing = this.state.wallets.find((w) => w.address === address);
    if (existing) return existing;
    const wallet: TrackedWallet = { address, label, addedAt: Date.now() };
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
}
