"use client";
import StacksWalletPanel from "@/app/components/stacks/StacksWalletPanel";
import { useStacksWallet } from "@/app/components/stacks/useStacksWallet";
import MyStats from "./MyStats";
import Leaderboard from "./Leaderboard";
import Notice from "@/app/components/ui/Notice";

export default function GuessTheHashStatsClient() {
  const { address, networkName } = useStacksWallet();

  return (
    <div className="space-y-8">
      <StacksWalletPanel />
      {address ? (
        <MyStats address={address} networkName={networkName} />
      ) : (
        <Notice
          variant="info"
          title="Connect your wallet"
          description="Connect your wallet to view personal stats."
        />
      )}
      <Leaderboard networkName={networkName} />
    </div>
  );
}
