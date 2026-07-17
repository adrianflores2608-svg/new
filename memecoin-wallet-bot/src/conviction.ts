import { TrackedWallet } from "./types";

const MIN_WEIGHT = 0.5;
const MAX_WEIGHT = 3;
const SOL_PER_WEIGHT_POINT = 20;

/**
 * Wallets discovered/ranked via /discover or `npm run rank` carry a sampled
 * realized-PnL figure; weight their buys accordingly so a buy from a wallet
 * with a strong track record counts for more than one from an unranked
 * wallet (weight 1, neutral) or a wallet with a negative track record
 * (weight floored at 0.5, never zero — an unprofitable wallet can still be
 * an early/correct signal occasionally).
 */
export function walletConvictionWeight(wallet: TrackedWallet | undefined): number {
  if (!wallet || wallet.realizedPnlSol === undefined) return 1;
  const weight = 1 + wallet.realizedPnlSol / SOL_PER_WEIGHT_POINT;
  return Math.min(MAX_WEIGHT, Math.max(MIN_WEIGHT, weight));
}
