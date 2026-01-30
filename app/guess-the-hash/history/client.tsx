"use client";
import { useCallback, useEffect, useState } from "react";
import StacksWalletPanel from "@/app/components/stacks/StacksWalletPanel";
import { useStacksWallet } from "@/app/components/stacks/useStacksWallet";
import { useStacksTipHeight } from "@/app/components/stacks/useStacksTipHeight";
import HowItWorksPanel from "@/app/components/ui/HowItWorksPanel";
import Notice from "@/app/components/ui/Notice";
import {
  getStacksContractAddress,
  getStacksContractName,
} from "@/lib/stacks-config";
import {
  clearBetReceiptCache,
  fetchBetReceiptsForAddress,
  type BetReceipt,
} from "@/lib/stacks-history";
import ReceiptCard from "./ReceiptCard";

export default function GuessTheHashHistoryClient() {
  const { address, networkName } = useStacksWallet();
  const contractAddress = getStacksContractAddress();
  const contractName = getStacksContractName();
  const { height: currentHeight, error: heightError } = useStacksTipHeight();
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [receipts, setReceipts] = useState<BetReceipt[]>([]);

  const loadHistory = useCallback(
    async (force = false) => {
      if (!address) {
        return;
      }
      setStatus("loading");
      setError(null);
      try {
        const result = await fetchBetReceiptsForAddress(address, networkName, {
          force,
        });
        setReceipts(result);
        setStatus("idle");
      } catch (fetchError) {
        setStatus("error");
        setError(fetchError instanceof Error ? fetchError.message : String(fetchError));
      }
    },
    [address, networkName],
  );

  useEffect(() => {
    if (!address) {
      return;
    }
    loadHistory();
  }, [address, loadHistory]);

  const handleRefresh = async () => {
    if (!address) {
      return;
    }
    clearBetReceiptCache(address, networkName);
    await loadHistory(true);
  };

  return (
    <main className="mx-auto max-w-4xl space-y-8 px-6 py-12">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold text-zinc-100">Bet Receipts</h1>
        <p className="text-sm text-zinc-400">
          Audit-grade timeline for your Guess The Hash bets.
        </p>
      </header>

      <StacksWalletPanel />
      <HowItWorksPanel />
      {!contractAddress || !contractName ? (
        <Notice
          variant="error"
          title="Missing contract config."
          description="Set NEXT_PUBLIC_CONTRACT_ADDRESS and NEXT_PUBLIC_CONTRACT_NAME in .env.local and restart dev server."
        />
      ) : null}

      {address ? (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs text-zinc-400">
              Current height: {currentHeight ?? "—"}
              {heightError ? ` (height error: ${heightError})` : ""}
            </div>
            <button
              type="button"
              onClick={handleRefresh}
              className="rounded-md border border-zinc-700 px-3 py-1 text-xs text-zinc-200 hover:border-zinc-500">
              Refresh
            </button>
          </div>

          {status === "loading" && receipts.length === 0 ? (
            <div className="rounded-lg border border-zinc-800/70 bg-zinc-900/30 p-6 text-sm text-zinc-300">
              Loading bet receipts…
            </div>
          ) : null}

          {status === "error" ? (
            <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-200">
              {error ?? "Unable to load bet receipts."}
              <button
                type="button"
                onClick={handleRefresh}
                className="ml-3 underline text-red-100 hover:text-white">
                Retry
              </button>
            </div>
          ) : null}

          {receipts.length === 0 && status !== "loading" ? (
            <div className="rounded-lg border border-zinc-800/70 bg-zinc-900/30 p-6 text-sm text-zinc-300">
              No bet receipts yet.
            </div>
          ) : null}

          <div className="space-y-4">
            {receipts.map((receipt) => (
              <ReceiptCard
                key={`${receipt.placeTx.txid}-${receipt.betId ?? "unknown"}`}
                receipt={receipt}
                currentHeight={currentHeight}
                onRefresh={handleRefresh}
              />
            ))}
          </div>
        </section>
      ) : (
        <Notice
          variant="info"
          title="Connect your wallet"
          description="Connect your wallet to view bet receipts."
        />
      )}
    </main>
  );
}
