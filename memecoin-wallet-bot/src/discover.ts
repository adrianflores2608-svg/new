import axios from "axios";

/**
 * Candidate-wallet discovery via pump.fun's public frontend API — undocumented
 * and can change shape/paths without notice (same caveat as src/pumpfun.ts's
 * fetchTokenInfo). If discovery stops returning candidates, check these
 * endpoints against the current pump.fun site first.
 */
const PUMP_FUN_API = "https://frontend-api.pump.fun";

interface RawCoin {
  mint?: string;
}

interface RawTrade {
  user?: string;
  is_buy?: boolean;
}

async function fetchTrendingMints(limit: number): Promise<string[]> {
  try {
    const { data } = await axios.get<RawCoin[]>(`${PUMP_FUN_API}/coins`, {
      params: { offset: 0, limit, sort: "market_cap", order: "DESC", includeNsfw: false },
      timeout: 10_000,
    });
    if (!Array.isArray(data)) return [];
    return data.map((c) => c.mint).filter((m): m is string => typeof m === "string");
  } catch (err) {
    console.error("[discover] failed to fetch trending mints:", (err as Error).message);
    return [];
  }
}

async function fetchMintBuyers(mint: string, limit: number): Promise<string[]> {
  try {
    const { data } = await axios.get<RawTrade[]>(`${PUMP_FUN_API}/trades/all/${mint}`, {
      params: { limit, offset: 0 },
      timeout: 10_000,
    });
    if (!Array.isArray(data)) return [];
    return data
      .filter((t) => t.is_buy)
      .map((t) => t.user)
      .filter((u): u is string => typeof u === "string");
  } catch (err) {
    console.error(`[discover] failed to fetch trades for ${mint}:`, (err as Error).message);
    return [];
  }
}

export interface DiscoverOptions {
  seedMintLimit: number;
  tradesPerMint: number;
  maxCandidates: number;
}

/**
 * Builds a pool of candidate wallets by pulling recent buyers across a
 * sample of currently-trending pump.fun tokens. This is a seed for the PnL
 * ranker, not a ranking itself — most candidates will be mediocre or losing
 * traders; rankWallets() is what actually filters for skill.
 */
export async function discoverCandidateWallets(opts: DiscoverOptions): Promise<string[]> {
  const mints = await fetchTrendingMints(opts.seedMintLimit);
  const candidates = new Set<string>();

  for (const mint of mints) {
    const buyers = await fetchMintBuyers(mint, opts.tradesPerMint);
    for (const buyer of buyers) {
      candidates.add(buyer);
      if (candidates.size >= opts.maxCandidates) return Array.from(candidates);
    }
  }

  return Array.from(candidates);
}
