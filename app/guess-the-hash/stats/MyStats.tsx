"use client";
import { useEffect, useMemo, useState } from "react";
import type { StacksNetworkName } from "@/lib/stacks-config";
import { buildWalletStats, type WalletStats } from "@/lib/stacks-stats";
import { formatUstxToStx } from "@/lib/stacks-utils";

type MyStatsProps = {
  address: string;
  networkName: StacksNetworkName;
};

function formatSignedStx(value: bigint): string {
  if (value === 0n) {
    return "0";
  }
  if (value < 0n) {
    return `-${formatUstxToStx(value * -1n)}`;
  }
  return formatUstxToStx(value);
}

export default function MyStats({ address, networkName }: MyStatsProps) {
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [stats, setStats] = useState<WalletStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadStats = async () => {
    setStatus("loading");
    setError(null);
    try {
      const result = await buildWalletStats(address, networkName);
      setStats(result);
      setStatus("idle");
    } catch (fetchError) {
      setStatus("error");
      setError(fetchError instanceof Error ? fetchError.message : String(fetchError));
    }
  };

  useEffect(() => {
    loadStats();
  }, [address, networkName]);

  const statRows = useMemo(() => {
    if (!stats) {
      return [];
    }
    return [
      { label: "Total bets placed", value: stats.totalBets.toString() },
      { label: "Resolved bets", value: stats.totalResolved.toString() },
      { label: "Wins", value: stats.wins.toString() },
      { label: "Losses", value: stats.losses.toString() },
      {
        label: "Total staked (STX)",
        value: formatUstxToStx(stats.totalStakedUstx),
      },
      {
        label: "Total payouts (STX)",
        value: formatUstxToStx(stats.totalPayoutsUstx),
      },
      { label: "Net P/L (STX)", value: formatSignedStx(stats.netUstx) },
    ];
  }, [stats]);

  return (
    <div className="rounded-lg border border-zinc-700/60 bg-zinc-900/30 p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-zinc-100">My Stats</h2>
          <p className="text-xs text-zinc-400">
            Stats are derived from on-chain transactions and may take time to update.
          </p>
        </div>
        <button
          type="button"
          onClick={loadStats}
          className="rounded-md border border-zinc-700 px-3 py-1 text-xs text-zinc-200 hover:border-zinc-500"
          disabled={status === "loading"}>
          {status === "loading" ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {status === "loading" && !stats ? (
        <p className="mt-4 text-sm text-zinc-300">Loading wallet stats…</p>
      ) : null}

      {status === "error" ? (
        <p className="mt-4 text-sm text-red-300">{error ?? "Failed to load stats."}</p>
      ) : null}

      {stats ? (
        <dl className="mt-4 grid gap-3 sm:grid-cols-2">
          {statRows.map((row) => (
            <div key={row.label} className="rounded-md border border-zinc-800/70 p-3">
              <dt className="text-xs text-zinc-400">{row.label}</dt>
              <dd className="text-base font-semibold text-zinc-100">{row.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </div>
  );
}
