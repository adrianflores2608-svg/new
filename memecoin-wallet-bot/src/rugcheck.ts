import { Connection, PublicKey } from "@solana/web3.js";

export function createConnection(heliusApiKey: string): Connection {
  return new Connection(`https://mainnet.helius-rpc.com/?api-key=${heliusApiKey}`, "confirmed");
}

export interface RugCheckThresholds {
  requireMintAuthorityRevoked: boolean;
  requireFreezeAuthorityRevoked: boolean;
  maxCreatorHoldingPercent: number;
}

export interface RugCheckResult {
  mint: string;
  mintAuthorityRevoked: boolean;
  freezeAuthorityRevoked: boolean;
  creatorHoldingPercent?: number; // undefined if the creator/supply couldn't be resolved
  passed: boolean;
  reasons: string[];
}

/**
 * Deliberately narrow: revoked mint/freeze authority (a standard SPL rug
 * vector — an un-revoked mint authority means supply can be inflated after
 * you buy) and creator-wallet holding size (pump.fun-specific — a creator
 * sitting on a large slice of supply can dump directly into the curve).
 *
 * This does NOT attempt full holder-distribution analysis. Doing that
 * correctly requires reliably excluding the bonding-curve-owned token
 * account from "top holders" (otherwise every pre-graduation pump.fun token
 * looks like a rug, since the curve legitimately holds most of the supply),
 * which needs a confirmed PDA derivation this project doesn't rely on. A
 * "passed" result means "no crude red flags found," not "verified safe."
 */
export async function checkToken(
  mint: string,
  creatorAddress: string | undefined,
  connection: Connection,
  thresholds: RugCheckThresholds
): Promise<RugCheckResult> {
  const mintPubkey = new PublicKey(mint);
  const reasons: string[] = [];

  const mintInfo = await connection.getParsedAccountInfo(mintPubkey);
  const parsedData = mintInfo.value?.data;
  const parsed =
    parsedData && "parsed" in parsedData ? (parsedData.parsed?.info as Record<string, unknown>) : undefined;
  const mintAuthorityRevoked = !parsed?.mintAuthority;
  const freezeAuthorityRevoked = !parsed?.freezeAuthority;

  if (thresholds.requireMintAuthorityRevoked && !mintAuthorityRevoked) {
    reasons.push("mint authority not revoked — supply can be inflated after you buy");
  }
  if (thresholds.requireFreezeAuthorityRevoked && !freezeAuthorityRevoked) {
    reasons.push("freeze authority not revoked — your tokens could be frozen");
  }

  let creatorHoldingPercent: number | undefined;
  if (creatorAddress) {
    try {
      const [supply, creatorAccounts] = await Promise.all([
        connection.getTokenSupply(mintPubkey),
        connection.getParsedTokenAccountsByOwner(new PublicKey(creatorAddress), {
          mint: mintPubkey,
        }),
      ]);
      const totalSupply = Number(supply.value.amount);
      const creatorBalance = creatorAccounts.value.reduce((sum, acc) => {
        const amount = acc.account.data.parsed?.info?.tokenAmount?.amount;
        return sum + (amount ? Number(amount) : 0);
      }, 0);

      if (totalSupply > 0) {
        creatorHoldingPercent = (creatorBalance / totalSupply) * 100;
        if (creatorHoldingPercent > thresholds.maxCreatorHoldingPercent) {
          reasons.push(`creator wallet holds ~${creatorHoldingPercent.toFixed(0)}% of supply`);
        }
      }
    } catch (err) {
      console.error(`[rugcheck] failed to resolve creator holding for ${mint}:`, (err as Error).message);
    }
  }

  return {
    mint,
    mintAuthorityRevoked,
    freezeAuthorityRevoked,
    creatorHoldingPercent,
    passed: reasons.length === 0,
    reasons,
  };
}
