"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import StacksWalletPanel from "../../components/stacks/StacksWalletPanel";
import { useStacksWallet } from "../../components/stacks/useStacksWallet";
import {
  getStacksContractAddress,
  getStacksContractPrincipal,
  getStacksNetworkName,
} from "@/lib/stacks-config";
import {
  fetchGuessTheHashBet,
  type GuessTheHashBet,
} from "@/lib/stacks-readonly";
import {
  bitmapToDigits,
  getExplorerAddressUrl,
  shortenStacksAddress,
  toHexDigit,
} from "@/lib/stacks-utils";

export default function GuessTheHashWalletPage() {
  const { address } = useStacksWallet();
  const [betIdInput, setBetIdInput] = useState("");
  const [betStatus, setBetStatus] = useState<
    "idle" | "loading" | "error" | "not_found"
  >("idle");
  const [betError, setBetError] = useState<string | null>(null);
  const [bet, setBet] = useState<GuessTheHashBet | null>(null);

  const contractAddress = getStacksContractAddress();
  const contractPrincipal = getStacksContractPrincipal();
  const networkName = getStacksNetworkName();

  const betChoices = useMemo(() => {
    if (!bet) {
      return [];
    }
    return bitmapToDigits(bet.choiceBitmap).map((digit) => toHexDigit(digit));
  }, [bet]);

  const handleSubmit = async () => {
    if (!address || !contractAddress) {
      return;
    }
    let betId: bigint;
    try {
      betId = BigInt(betIdInput.trim());
    } catch {
      setBetStatus("error");
      setBetError("Bet ID must be a valid integer.");
      setBet(null);
      return;
    }
    setBetStatus("loading");
    setBetError(null);
    try {
      const result = await fetchGuessTheHashBet(betId, address);
      if (!result) {
        setBetStatus("not_found");
        setBet(null);
        return;
      }
      setBet(result);
      setBetStatus("idle");
    } catch (error) {
      setBetStatus("error");
      setBetError(error instanceof Error ? error.message : String(error));
      setBet(null);
    }
  };

  return (
    <main className="mx-auto max-w-3xl px-6 py-12 space-y-10">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold">Guess The Hash — My Wallet</h1>
        <p className="text-sm text-zinc-400">
          Connect a Stacks wallet and read bet details by ID.
        </p>
      </header>

      <section className="space-y-4 rounded-lg border border-zinc-800/60 bg-zinc-900/20 p-4">
        <h2 className="text-lg font-semibold text-zinc-100">
          Wallet Connection
        </h2>
        <StacksWalletPanel />
        {!address ? (
          <p className="text-sm text-zinc-400">
            Connect a wallet to view your bets.
          </p>
        ) : null}
      </section>

      {address ? (
        <>
          <section className="space-y-4 rounded-lg border border-zinc-800/60 bg-zinc-900/20 p-4">
            <h2 className="text-lg font-semibold text-zinc-100">Bet Lookup</h2>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <input
                value={betIdInput}
                onChange={(event) => setBetIdInput(event.target.value)}
                placeholder="Bet ID"
                className="w-full rounded-md border border-zinc-700 bg-black px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-500"
              />
              <button
                type="button"
                onClick={handleSubmit}
                className="rounded-md border border-zinc-700 px-4 py-2 text-sm text-zinc-200 hover:border-zinc-500 hover:text-white">
                {betStatus === "loading" ? "Loading..." : "Lookup"}
              </button>
            </div>
            <p className="text-xs text-zinc-500">Connected as: {address}</p>
          </section>

          <section className="space-y-3 rounded-lg border border-zinc-800/60 bg-zinc-900/20 p-4">
            <h2 className="text-lg font-semibold text-zinc-100">Bet Details</h2>
            {contractPrincipal ? (
              <p className="text-xs text-zinc-500">
                Contract:{" "}
                <Link
                  className="underline text-zinc-200 hover:text-white"
                  href={getExplorerAddressUrl(contractPrincipal, networkName)}
                  target="_blank">
                  {shortenStacksAddress(contractPrincipal)}
                </Link>
              </p>
            ) : null}
            {betStatus === "loading" ? (
              <p className="text-sm text-zinc-400">Loading bet...</p>
            ) : null}
            {betStatus === "not_found" ? (
              <p className="text-sm text-zinc-400">Bet not found.</p>
            ) : null}
            {betStatus === "error" ? (
              <p className="text-sm text-red-300">
                {betError ?? "Unable to read bet data."}
              </p>
            ) : null}
            {bet ? (
              <div className="space-y-2 text-sm text-zinc-300">
                <p>
                  Bettor: <span className="text-zinc-100">{bet.bettor}</span>
                </p>
                <p>
                  Choices:{" "}
                  <span className="text-zinc-100">
                    {betChoices.length ? betChoices.join(", ") : "—"}
                  </span>
                </p>
                <p>
                  Stake per char (uSTX):{" "}
                  <span className="text-zinc-100">
                    {bet.stakePerCharUstx.toString()}
                  </span>
                </p>
                <p>
                  Total stake (uSTX):{" "}
                  <span className="text-zinc-100">
                    {bet.totalStakeUstx.toString()}
                  </span>
                </p>
                <p>
                  Placed height:{" "}
                  <span className="text-zinc-100">
                    {bet.placedHeight.toString()}
                  </span>
                </p>
                <p>
                  Target height:{" "}
                  <span className="text-zinc-100">
                    {bet.targetHeight.toString()}
                  </span>
                </p>
                <p>
                  Resolved:{" "}
                  <span className="text-zinc-100">
                    {bet.resolved ? "Yes" : "No"}
                  </span>
                </p>
                <p>
                  Won:{" "}
                  <span className="text-zinc-100">
                    {bet.won ? "Yes" : "No"}
                  </span>
                </p>
                <p>
                  Outcome digit:{" "}
                  <span className="text-zinc-100">
                    {bet.outcomeDigit === null
                      ? "—"
                      : `${bet.outcomeDigit} (${toHexDigit(
                          bet.outcomeDigit,
                        )})`}
                  </span>
                </p>
              </div>
            ) : null}
          </section>
        </>
      ) : null}
    </main>
  );
}
