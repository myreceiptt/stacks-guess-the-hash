"use client";
import { useMemo, useState, type ChangeEvent, useEffect } from "react";
import Link from "next/link";
import StacksWalletPanel from "../../components/stacks/StacksWalletPanel";
import { useStacksWallet } from "../../components/stacks/useStacksWallet";
import { useStacksTipHeight } from "../../components/stacks/useStacksTipHeight";
import Notice from "@/app/components/ui/Notice";
import StatusBadge from "@/app/components/ui/StatusBadge";
import {
  getStacksContractAddress,
  getStacksContractName,
  getStacksContractPrincipal,
  getStacksNetworkName,
  getStacksResolverTipUstxFromEnv,
} from "@/lib/stacks-config";
import {
  fetchGuessTheHashBet,
  type GuessTheHashBet,
  fetchGuessTheHashConfig,
} from "@/lib/stacks-readonly";
import { getStacksNetwork } from "@/lib/stacks-network";
import { getHumanReadableError, getKnownErrorByKey } from "@/lib/stacks-errors";
import {
  bitmapToDigits,
  getExplorerAddressUrl,
  getExplorerTxUrl,
  formatUstxToStx,
  shortenStacksAddress,
  toHexDigit,
} from "@/lib/stacks-utils";
import { uintCV } from "@stacks/transactions";

export default function GuessTheHashWalletClient() {
  const { address } = useStacksWallet();
  const [betIdInput, setBetIdInput] = useState("");
  const [betStatus, setBetStatus] = useState<
    "idle" | "loading" | "error" | "not_found"
  >("idle");
  const [betError, setBetError] = useState<string | null>(null);
  const [bet, setBet] = useState<GuessTheHashBet | null>(null);
  const [currentBetId, setCurrentBetId] = useState<bigint | null>(null);
  const [resolverTipUstx, setResolverTipUstx] = useState<bigint | null>(null);
  const [resolveStatus, setResolveStatus] = useState<
    "idle" | "submitting" | "broadcasted" | "confirmed" | "error"
  >("idle");
  const [resolveNotice, setResolveNotice] = useState<{
    variant: "success" | "error" | "info";
    title: string;
    description?: string;
  } | null>(null);
  const [resolveTxId, setResolveTxId] = useState<string | null>(null);
  const [resolveBetIdInput, setResolveBetIdInput] = useState("");

  const contractAddress = getStacksContractAddress();
  const contractName = getStacksContractName();
  const contractPrincipal = getStacksContractPrincipal();
  const networkName = getStacksNetworkName();
  const { height: currentHeight, error: heightError } = useStacksTipHeight();

  const betChoices = useMemo(() => {
    if (!bet) {
      return [];
    }
    return bitmapToDigits(bet.choiceBitmap).map((digit) =>
      toHexDigit(digit).toUpperCase(),
    );
  }, [bet]);

  const loadBet = async (betId: bigint) => {
    if (!address || !contractAddress) {
      return null;
    }
    setBetStatus("loading");
    setBetError(null);
    try {
      const result = await fetchGuessTheHashBet(betId, address);
      if (!result) {
        setBetStatus("not_found");
        setBet(null);
        return null;
      }
      setBet(result);
      setCurrentBetId(betId);
      setBetStatus("idle");
      return result;
    } catch (error) {
      setBetStatus("error");
      setBetError(error instanceof Error ? error.message : String(error));
      setBet(null);
      return null;
    }
  };

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
    await loadBet(betId);
  };

  const refreshResolverTip = async () => {
    if (!contractAddress) {
      return;
    }
    try {
      const config = await fetchGuessTheHashConfig(address ?? contractAddress);
      setResolverTipUstx(config.resolverTipUstx);
    } catch {
      const fallback = getStacksResolverTipUstxFromEnv();
      if (fallback) {
        try {
          setResolverTipUstx(BigInt(fallback));
          return;
        } catch {
          setResolverTipUstx(null);
          return;
        }
      }
      setResolverTipUstx(null);
    }
  };

  useEffect(() => {
    refreshResolverTip();
  }, [address, contractAddress]);

  const resolveBet = async (betId: bigint) => {
    if (!address || !contractAddress || !contractName) {
      setResolveNotice({
        variant: "info",
        title: "Connect a wallet.",
        description: "Connect a wallet and configure contract first.",
      });
      return;
    }
    if (networkName !== "testnet") {
      const message = getKnownErrorByKey("networkMismatch");
      setResolveNotice({
        variant: "error",
        title: message.title,
        description: message.detail,
      });
      return;
    }
    setResolveNotice(null);
    setResolveTxId(null);
    setResolveStatus("submitting");
    try {
      const { openContractCall } = await import("@stacks/connect");
      openContractCall({
        contractAddress,
        contractName,
        functionName: "resolve",
        functionArgs: [uintCV(betId)],
        network: getStacksNetwork(),
        stxAddress: address,
        onFinish: async (data) => {
          setResolveTxId(data.txId);
          setResolveStatus("broadcasted");
          setResolveNotice({
            variant: "success",
            title: "Resolve submitted.",
            description: "Transaction broadcasted successfully.",
          });
          const updated = await loadBet(betId);
          if (updated?.resolved) {
            setResolveStatus("confirmed");
          }
        },
        onCancel: () => {
          setResolveStatus("idle");
          const message = getKnownErrorByKey("cancelled");
          setResolveNotice({
            variant: "error",
            title: message.title,
            description: message.detail,
          });
        },
      });
    } catch (error) {
      setResolveStatus("error");
      const message = getHumanReadableError(error);
      setResolveNotice({
        variant: "error",
        title: message.title,
        description: message.detail,
      });
    }
  };

  const betStatusLabel = useMemo(() => {
    if (!bet) {
      return "—";
    }
    if (bet.resolved) {
      return "Resolved";
    }
    if (currentHeight === null) {
      return "Pending (height unknown)";
    }
    if (currentHeight < Number(bet.targetHeight)) {
      return "Pending (waiting for target block)";
    }
    return "Ready to resolve";
  }, [bet, currentHeight]);

  const payoutUstx = useMemo(() => {
    if (!bet) {
      return 0n;
    }
    if (!bet.won) {
      return 0n;
    }
    return bet.stakePerCharUstx * 2n;
  }, [bet]);

  const readyToResolve =
    bet &&
    !bet.resolved &&
    currentHeight !== null &&
    currentHeight >= Number(bet.targetHeight);

  const statusVariant = useMemo(() => {
    if (!bet) {
      return "pending";
    }
    if (bet.resolved) {
      return "resolved";
    }
    if (currentHeight !== null && currentHeight >= Number(bet.targetHeight)) {
      return "ready";
    }
    return "pending";
  }, [bet, currentHeight]);

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
          <Notice
            variant="info"
            title="Connect your wallet"
            description="Connect a wallet to view your bets."
          />
        ) : null}
        <p className="text-xs text-zinc-500">
          Current height:{" "}
          {currentHeight !== null ? currentHeight : "Unavailable"}
        </p>
        {heightError ? (
          <p className="text-xs text-amber-300">{heightError}</p>
        ) : null}
      </section>

      {address ? (
        <>
          <section className="space-y-4 rounded-lg border border-zinc-800/60 bg-zinc-900/20 p-4">
            <h2 className="text-lg font-semibold text-zinc-100">Bet Lookup</h2>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <input
                value={betIdInput}
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  setBetIdInput(event.currentTarget.value)
                }
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
              <div className="space-y-2">
                <div className="h-4 w-2/3 animate-pulse rounded bg-zinc-800/60" />
                <div className="h-4 w-1/2 animate-pulse rounded bg-zinc-800/60" />
              </div>
            ) : null}
            {betStatus === "not_found" ? (
              <Notice
                variant="info"
                title="Bet not found."
                description="No bet exists with that ID."
              />
            ) : null}
            {betStatus === "error" ? (
              <Notice
                variant="error"
                title="Unable to load bet."
                description={betError ?? "Unable to read bet data."}
              />
            ) : null}
            {bet ? (
              <div className="space-y-2 text-sm text-zinc-300">
                <p>
                  Current height:{" "}
                  <span className="text-zinc-100">
                    {currentHeight ?? "Unavailable"}
                  </span>
                </p>
                <p>
                  Status: <StatusBadge variant={statusVariant} label={betStatusLabel} />
                </p>
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
                        ).toUpperCase()})`}
                  </span>
                </p>
                {bet.resolved ? (
                  <>
                    <p>
                      Payout (uSTX):{" "}
                      <span className="text-zinc-100">
                        {payoutUstx.toString()}
                      </span>{" "}
                      <span className="text-xs text-zinc-500">
                        ({formatUstxToStx(payoutUstx)} STX)
                      </span>
                    </p>
                    <p>
                      Resolver tip:{" "}
                      <span className="text-zinc-100">
                        {resolverTipUstx ? resolverTipUstx.toString() : "—"}
                      </span>{" "}
                      <span className="text-xs text-zinc-500">
                        {resolverTipUstx
                          ? `expected tip: ${formatUstxToStx(
                              resolverTipUstx,
                            )} STX`
                          : "expected tip unavailable"}
                      </span>
                    </p>
                  </>
                ) : null}
              </div>
            ) : null}
          </section>

          <section className="space-y-3 rounded-lg border border-zinc-800/60 bg-zinc-900/20 p-4">
            <h2 className="text-lg font-semibold text-zinc-100">Resolve</h2>
            <button
              type="button"
              onClick={() => {
                if (!bet || currentBetId === null) {
                  return;
                }
                resolveBet(currentBetId);
              }}
              disabled={
                !readyToResolve || resolveStatus === "submitting" || currentBetId === null
              }
              className="rounded-md border border-zinc-700 px-4 py-2 text-sm text-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed hover:border-zinc-500 hover:text-white">
              {resolveStatus === "submitting" ? "Resolving..." : "Resolve"}
            </button>
            <p className="text-xs text-zinc-500">
              Status:{" "}
              {resolveStatus === "idle"
                ? "Idle"
                : resolveStatus === "submitting"
                ? "Pending signature"
                : resolveStatus === "broadcasted"
                ? "Broadcasted"
                : resolveStatus === "confirmed"
                ? "Confirmed"
                : "Error"}
            </p>
            {!readyToResolve && bet && !bet.resolved ? (
              <p className="text-xs text-zinc-500">
                {currentHeight !== null &&
                currentHeight < Number(bet.targetHeight)
                  ? "Too early."
                  : "Waiting for readiness."}
              </p>
            ) : null}
            {resolveNotice ? (
              <Notice
                variant={resolveNotice.variant}
                title={resolveNotice.title}
                description={resolveNotice.description}
                actionLabel={resolveTxId ? "View transaction" : undefined}
                actionHref={
                  resolveTxId ? getExplorerTxUrl(resolveTxId, networkName) : undefined
                }
              />
            ) : null}
            {resolveTxId ? (
              <p className="text-xs text-zinc-400">
                Resolve tx:{" "}
                <Link
                  className="underline text-zinc-200 hover:text-white"
                  href={getExplorerTxUrl(resolveTxId, networkName)}
                  target="_blank">
                  {resolveTxId}
                </Link>
              </p>
            ) : null}
          </section>

          <section className="space-y-3 rounded-lg border border-zinc-800/60 bg-zinc-900/20 p-4">
            <h2 className="text-lg font-semibold text-zinc-100">
              Resolve someone else’s bet
            </h2>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <input
                value={resolveBetIdInput}
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  setResolveBetIdInput(event.currentTarget.value)
                }
                placeholder="Bet ID"
                className="w-full rounded-md border border-zinc-700 bg-black px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-500"
              />
              <button
                type="button"
                onClick={() => {
                  try {
                    const betId = BigInt(resolveBetIdInput.trim());
                    resolveBet(betId);
                  } catch {
                    setResolveNotice({
                      variant: "error",
                      title: "Invalid bet ID.",
                      description: "Bet ID must be a valid integer.",
                    });
                  }
                }}
                className="rounded-md border border-zinc-700 px-4 py-2 text-sm text-zinc-200 hover:border-zinc-500 hover:text-white">
                Resolve
              </button>
            </div>
          </section>
        </>
      ) : null}
    </main>
  );
}
