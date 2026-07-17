import http from "http";
import { Storage } from "./storage";

function withCors(res: http.ServerResponse): void {
  // Local-only, read-only, non-sensitive data (on-chain-derived signal
  // status) — open CORS is an accepted tradeoff since the server only binds
  // to 127.0.0.1 (see startLocalServer below) and exposes no secrets or
  // control endpoints.
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
}

function sendJson(res: http.ServerResponse, status: number, body: unknown): void {
  withCors(res);
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

export interface MintStatus {
  mint: string;
  hasSignal: boolean;
  status?: "open" | "sold";
  buyersCount?: number;
  sellersCount?: number;
  rugFlagged?: boolean;
  suggestedSizeSol?: number;
  stopLossMarketCapSol?: number;
  lastUpdated: number;
}

function buildMintStatus(storage: Storage, mint: string): MintStatus {
  const position = storage.getPosition(mint);
  if (!position || !position.signaledBuyAt) {
    return { mint, hasSignal: false, lastUpdated: Math.floor(Date.now() / 1000) };
  }

  const openTrade = storage.getOpenPaperTrade(mint);
  const closedTrades = storage.getClosedPaperTrades().filter((t) => t.mint === mint);
  const latestClosed = closedTrades[closedTrades.length - 1];
  const trade = openTrade ?? latestClosed;

  return {
    mint,
    hasSignal: true,
    status: position.signaledSellAt ? "sold" : "open",
    buyersCount: Object.keys(position.buyers).length,
    sellersCount: Object.keys(position.sellers).length,
    rugFlagged: trade?.rugFlagged,
    suggestedSizeSol: trade?.sizeSol,
    stopLossMarketCapSol: trade?.stopLossMarketCapSol,
    lastUpdated: Math.floor(Date.now() / 1000),
  };
}

/**
 * Minimal local-only read API for the companion browser extension
 * (extension/). Bound to 127.0.0.1 — not reachable from the network.
 */
export function startLocalServer(storage: Storage, port: number): http.Server {
  const server = http.createServer((req, res) => {
    if (req.method === "OPTIONS") {
      withCors(res);
      res.writeHead(204);
      res.end();
      return;
    }

    const url = new URL(req.url ?? "/", "http://localhost");

    if (url.pathname === "/api/health") {
      return sendJson(res, 200, { ok: true });
    }

    if (url.pathname === "/api/positions") {
      const positions = storage
        .getAllPositions()
        .filter((p) => p.signaledBuyAt)
        .map((p) => buildMintStatus(storage, p.mint));
      return sendJson(res, 200, { positions });
    }

    const mintMatch = url.pathname.match(/^\/api\/signal\/([^/]+)$/);
    if (mintMatch) {
      return sendJson(res, 200, buildMintStatus(storage, decodeURIComponent(mintMatch[1])));
    }

    sendJson(res, 404, { error: "not found" });
  });

  server.listen(port, "127.0.0.1", () => {
    console.log(`[server] local signal API listening on http://127.0.0.1:${port}`);
  });

  return server;
}
