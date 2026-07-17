export interface RiskParams {
  bankrollSol: number;
  basePositionPercent: number;
  maxPositionPercent: number;
  stopLossPercent: number;
}

export interface PositionPlan {
  suggestedSizeSol: number;
  suggestedSizePercent: number;
  stopLossMarketCapSol?: number;
}

/**
 * Turns a signal into a concrete (suggested) trade plan instead of a bare
 * "buy" — this is a transparent, static heuristic, not a model: size scales
 * with conviction relative to the configured buy threshold, is cut for
 * rug-flagged tokens, and is capped/floored by the configured bounds. The
 * stop-loss is expressed as a market-cap level relative to entry, since
 * that's the only price proxy this bot has (see pumpfun.ts fetchTokenInfo).
 */
export function computePositionPlan(
  params: RiskParams,
  opts: { convictionMultiplier: number; rugFlagged: boolean; entryMarketCapSol?: number }
): PositionPlan {
  let sizePercent = params.basePositionPercent * opts.convictionMultiplier;
  if (opts.rugFlagged) sizePercent *= 0.3;
  sizePercent = Math.min(sizePercent, params.maxPositionPercent);
  sizePercent = Math.max(sizePercent, 0);

  const suggestedSizeSol = (params.bankrollSol * sizePercent) / 100;
  const stopLossMarketCapSol = opts.entryMarketCapSol
    ? opts.entryMarketCapSol * (1 - params.stopLossPercent / 100)
    : undefined;

  return { suggestedSizeSol, suggestedSizePercent: sizePercent, stopLossMarketCapSol };
}
