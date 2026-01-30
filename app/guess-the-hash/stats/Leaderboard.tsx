"use client";
import { useEffect, useMemo, useState } from "react";
import type { StacksNetworkName } from "@/lib/stacks-config";
import { buildLeaderboard, type LeaderboardEntry } from "@/lib/stacks-stats";
import { formatUstxToStx, shortenStacksAddress } from "@/lib/stacks-utils";
import Notice from "@/app/components/ui/Notice";

type LeaderboardProps = {
  networkName: StacksNetworkName;
};

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export default function Leaderboard({ networkName }: LeaderboardProps) {
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [scannedBets, setScannedBets] = useState(0);

  const loadLeaderboard = async () => {
    setStatus("loading");
    setError(null);
    try {
      const result = await buildLeaderboard(networkName, 20);
      setEntries(result.entries);
      setScannedBets(result.scannedBets);
      setStatus("idle");
    } catch (fetchError) {
      setStatus("error");
      setError(fetchError instanceof Error ? fetchError.message : String(fetchError));
    }
  };

  useEffect(() => {
    loadLeaderboard();
  }, [networkName]);

  const rows = useMemo(() => {
    return entries.map((entry) => ({
      address: shortenStacksAddress(entry.address),
      wins: entry.wins,
      totalBets: entry.totalBets,
      winRate: formatPercent(entry.winRate),
      net: formatUstxToStx(entry.netUstx),
    }));
  }, [entries]);

  return (
    <div className="rounded-lg border border-zinc-700/60 bg-zinc-900/30 p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-zinc-100">Leaderboard</h2>
          <p className="text-xs text-zinc-400">
            All-time testnet stats derived from contract transactions ({scannedBets} bets scanned).
          </p>
        </div>
        <button
          type="button"
          onClick={loadLeaderboard}
          className="rounded-md border border-zinc-700 px-3 py-1 text-xs text-zinc-200 hover:border-zinc-500"
          disabled={status === "loading"}>
          {status === "loading" ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {status === "loading" && entries.length === 0 ? (
        <p className="mt-4 text-sm text-zinc-300">Loading leaderboard…</p>
      ) : null}

      {status === "error" ? (
        <p className="mt-4 text-sm text-red-300">{error ?? "Failed to load leaderboard."}</p>
      ) : null}

      {rows.length > 0 ? (
        <div className="mt-4 overflow-hidden rounded-md border border-zinc-800/70">
          <div className="grid grid-cols-5 gap-2 border-b border-zinc-800/70 bg-zinc-900/70 px-3 py-2 text-xs text-zinc-400">
            <span>Address</span>
            <span>Wins</span>
            <span>Total Bets</span>
            <span>Win Rate</span>
            <span>Net P/L (STX)</span>
          </div>
          {rows.map((row, index) => (
            <div
              key={`${row.address}-${index}`}
              className="grid grid-cols-5 gap-2 px-3 py-2 text-sm text-zinc-200 odd:bg-zinc-900/40">
              <span>{row.address}</span>
              <span>{row.wins}</span>
              <span>{row.totalBets}</span>
              <span>{row.winRate}</span>
              <span>{row.net}</span>
            </div>
          ))}
        </div>
      ) : status !== "loading" ? (
        <div className="mt-4">
          <Notice
            variant="info"
            title="No leaderboard data yet."
            description="Place and resolve bets to populate the leaderboard."
          />
        </div>
      ) : null}
    </div>
  );
}
