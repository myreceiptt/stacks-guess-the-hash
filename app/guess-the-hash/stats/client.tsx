"use client";
import StacksWalletPanel from "@/app/components/stacks/StacksWalletPanel";
import { useStacksWallet } from "@/app/components/stacks/useStacksWallet";
import MyStats from "./MyStats";
import Leaderboard from "./Leaderboard";

export default function GuessTheHashStatsClient() {
  const { address, networkName } = useStacksWallet();

  return (
    <div className="space-y-8">
      <StacksWalletPanel />
      {address ? (
        <MyStats address={address} networkName={networkName} />
      ) : (
        <div className="rounded-lg border border-zinc-700/60 bg-zinc-900/30 p-6">
          <h2 className="text-lg font-semibold text-zinc-100">My Stats</h2>
          <p className="mt-2 text-sm text-zinc-400">
            Connect your wallet to view personal stats.
          </p>
        </div>
      )}
      <Leaderboard networkName={networkName} />
    </div>
  );
}
