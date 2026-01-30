"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import StacksWalletPanel from "../components/stacks/StacksWalletPanel";
import { useStacksWallet } from "../components/stacks/useStacksWallet";
import Notice from "@/app/components/ui/Notice";
import {
  getStacksContractAddress,
  getStacksContractName,
  getStacksContractPrincipal,
  getStacksNetworkName,
} from "@/lib/stacks-config";
import {
  fetchGuessTheHashConfig,
  type GuessTheHashConfig,
} from "@/lib/stacks-readonly";
import {
  getExplorerAddressUrl,
  shortenStacksAddress,
} from "@/lib/stacks-utils";

export default function GuessTheHashClient() {
  const { address } = useStacksWallet();
  const [config, setConfig] = useState<GuessTheHashConfig | null>(null);
  const [configStatus, setConfigStatus] = useState<
    "idle" | "loading" | "error"
  >("idle");
  const [configError, setConfigError] = useState<string | null>(null);

  const contractAddress = getStacksContractAddress();
  const contractName = getStacksContractName();
  const contractPrincipal = getStacksContractPrincipal();
  const networkName = getStacksNetworkName();

  useEffect(() => {
    if (!contractAddress || !contractName) {
      setConfigStatus("error");
      setConfigError("Missing Stacks contract configuration.");
      return;
    }
    const senderAddress = address ?? contractAddress;
    setConfigStatus("loading");
    fetchGuessTheHashConfig(senderAddress)
      .then((result) => {
        setConfig(result);
        setConfigStatus("idle");
        setConfigError(null);
      })
      .catch((error) => {
        setConfigStatus("error");
        setConfigError(error instanceof Error ? error.message : String(error));
      });
  }, [address, contractAddress, contractName]);

  const lastBetId = useMemo(() => {
    if (!config) {
      return null;
    }
    if (config.nextBetId <= 1n) {
      return null;
    }
    return config.nextBetId - 1n;
  }, [config]);

  return (
    <main className="mx-auto max-w-3xl px-6 py-12 space-y-10">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold">Guess The Hash</h1>
        <p className="text-sm text-zinc-400">
          Read-only contract status and wallet connection for the Stacks testnet
          deployment.
        </p>
      </header>

      <section className="space-y-4 rounded-lg border border-zinc-800/60 bg-zinc-900/20 p-4">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-zinc-100">
            Contract Status
          </h2>
          <p className="text-sm text-zinc-400">
            Network: <span className="text-zinc-200">{networkName}</span>
          </p>
          <p className="text-sm text-zinc-400">
            Contract:{" "}
            {contractPrincipal ? (
              <Link
                className="underline text-zinc-200 hover:text-white"
                href={getExplorerAddressUrl(contractPrincipal, networkName)}
                target="_blank">
                {shortenStacksAddress(contractPrincipal)}
              </Link>
            ) : (
              <span className="text-zinc-200">Not configured</span>
            )}
          </p>
        </div>

        <div className="rounded-lg border border-zinc-800/80 bg-black/30 px-4 py-4">
          {configStatus === "loading" ? (
            <p className="text-sm text-zinc-400">Loading config...</p>
          ) : null}
          {configStatus === "error" ? (
            <p className="text-sm text-red-300">
              {configError ?? "Unable to read contract config."}
            </p>
          ) : null}
          {config ? (
            <div className="space-y-2 text-sm text-zinc-300">
              <p>
                Fee (bps):{" "}
                <span className="text-zinc-100">
                  {config.feeBps.toString()}
                </span>
              </p>
              <p>
                Resolver tip (uSTX):{" "}
                <span className="text-zinc-100">
                  {config.resolverTipUstx.toString()}
                </span>
              </p>
              <p>
                Next bet ID:{" "}
                <span className="text-zinc-100">
                  {config.nextBetId.toString()}
                </span>
              </p>
              <p>
                Last known bet ID:{" "}
                <span className="text-zinc-100">
                  {lastBetId ? lastBetId.toString() : "None yet"}
                </span>
              </p>
            </div>
          ) : null}
        </div>
      </section>

      <section className="space-y-4 rounded-lg border border-zinc-800/60 bg-zinc-900/20 p-4">
        <h2 className="text-lg font-semibold text-zinc-100">
          Wallet Connection
        </h2>
        <StacksWalletPanel />
        {!address ? (
          <Notice
            variant="info"
            title="Connect your wallet"
            description="Connect to view personalized bet data."
          />
        ) : null}
      </section>

      <section className="space-y-2 rounded-lg border border-zinc-800/60 bg-zinc-900/20 p-4">
        <h2 className="text-lg font-semibold text-zinc-100">Actions</h2>
        <div className="flex flex-col gap-2 text-sm">
          <Link
            className="underline text-zinc-200 hover:text-white"
            href="/guess-the-hash/place-bet">
            Place Bet
          </Link>
          <Link
            className="underline text-zinc-200 hover:text-white"
            href="/guess-the-hash/wallet">
            My Wallet
          </Link>
          <Link
            className="underline text-zinc-200 hover:text-white"
            href="/guess-the-hash/history">
            Bet History
          </Link>
          <Link
            className="underline text-zinc-200 hover:text-white"
            href="/guess-the-hash/stats">
            Leaderboard &amp; My Stats
          </Link>
        </div>
      </section>
    </main>
  );
}
