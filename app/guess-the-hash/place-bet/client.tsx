"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { listCV, uintCV } from "@stacks/transactions";
import StacksWalletPanel from "../../components/stacks/StacksWalletPanel";
import { useStacksWallet } from "../../components/stacks/useStacksWallet";
import Notice from "@/app/components/ui/Notice";
import HowItWorksPanel from "@/app/components/ui/HowItWorksPanel";
import {
  getStacksContractAddress,
  getStacksContractName,
  getStacksContractPrincipal,
  getStacksFeeBpsFromEnv,
  getStacksNetworkName,
} from "@/lib/stacks-config";
import { fetchGuessTheHashConfig } from "@/lib/stacks-readonly";
import { getStacksNetwork } from "@/lib/stacks-network";
import { getHumanReadableError, getKnownErrorByKey } from "@/lib/stacks-errors";
import { getOpenContractCall } from "@/lib/stacks-connect";
import {
  formatUstxToStx,
  getExplorerAddressUrl,
  getExplorerTxUrl,
  hexCharToDigit,
  parseStxToUstx,
  shortenStacksAddress,
  toHexDigit,
} from "@/lib/stacks-utils";

const LEFT_KEYS = ["A", "B", "C", "D", "E", "F"];
const RIGHT_KEYS = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];
const MAX_STAKE_USTX = 1000n * 1_000_000n;

export default function PlaceBetClient() {
  const { address } = useStacksWallet();
  const [selectedDigits, setSelectedDigits] = useState<number[]>([]);
  const [stakeInput, setStakeInput] = useState("0.001");
  const [feeBps, setFeeBps] = useState<bigint | null>(null);
  const [feeError, setFeeError] = useState<string | null>(null);
  const [txId, setTxId] = useState<string | null>(null);
  const [txStatus, setTxStatus] = useState<"idle" | "submitting" | "error">(
    "idle",
  );
  const [txNotice, setTxNotice] = useState<{
    variant: "success" | "error" | "info";
    title: string;
    description?: string;
  } | null>(null);

  const contractAddress = getStacksContractAddress();
  const contractName = getStacksContractName();
  const contractPrincipal = getStacksContractPrincipal();
  const networkName = getStacksNetworkName();

  useEffect(() => {
    if (!contractAddress) {
      return;
    }
    const sender = address ?? contractAddress;
    fetchGuessTheHashConfig(sender)
      .then((config) => {
        setFeeBps(config.feeBps);
        setFeeError(null);
      })
      .catch(() => {
        const fallback = getStacksFeeBpsFromEnv();
        if (fallback) {
          try {
            setFeeBps(BigInt(fallback));
            setFeeError(null);
            return;
          } catch {
            setFeeError("Unable to parse fee-bps from env.");
            setFeeBps(null);
            return;
          }
        }
        setFeeBps(null);
        setFeeError("Unable to load fee configuration.");
      });
  }, [address, contractAddress]);

  const toggleDigit = (label: string) => {
    const value = hexCharToDigit(label);
    if (value === null) {
      return;
    }
    setSelectedDigits((prev) => {
      if (prev.includes(value)) {
        return prev.filter((digit) => digit !== value);
      }
      if (prev.length >= 16) {
        return prev;
      }
      return [...prev, value];
    });
  };

  const selectedCount = selectedDigits.length;
  const sortedDigits = useMemo(
    () => [...selectedDigits].sort((a, b) => a - b),
    [selectedDigits],
  );

  const { ustx: stakePerCharUstx, rounded } = useMemo(
    () => parseStxToUstx(stakeInput),
    [stakeInput],
  );

  const stakeError = useMemo(() => {
    if (!stakeInput.trim()) {
      return "Stake per character is required.";
    }
    if (!stakePerCharUstx) {
      return "Stake per character must be a valid number.";
    }
    if (stakePerCharUstx === 0n) {
      return "Stake per character must be greater than 0.";
    }
    if (stakePerCharUstx > MAX_STAKE_USTX) {
      return "Stake per character is too large.";
    }
    return null;
  }, [stakeInput, stakePerCharUstx]);

  const feeBpsValue = feeBps ?? 100n;
  const totalStakeUstx = useMemo(() => {
    if (!stakePerCharUstx || selectedCount === 0) {
      return 0n;
    }
    return stakePerCharUstx * BigInt(selectedCount);
  }, [stakePerCharUstx, selectedCount]);

  const feeUstx = useMemo(() => {
    if (!totalStakeUstx) {
      return 0n;
    }
    return (totalStakeUstx * feeBpsValue) / 10000n;
  }, [totalStakeUstx, feeBpsValue]);

  const netUstx = useMemo(() => totalStakeUstx - feeUstx, [totalStakeUstx, feeUstx]);

  const handleSubmit = async () => {
    setTxNotice(null);
    setTxId(null);
    if (!address) {
      setTxNotice({
        variant: "info",
        title: "Connect your wallet.",
        description: "Connect your wallet to place a bet.",
      });
      return;
    }
    if (!contractAddress || !contractName) {
      setTxNotice({
        variant: "error",
        title: "Configuration missing.",
        description: "Contract configuration is missing.",
      });
      return;
    }
    if (networkName !== "testnet") {
      const message = getKnownErrorByKey("networkMismatch");
      setTxNotice({ variant: "error", title: message.title, description: message.detail });
      return;
    }
    if (selectedCount < 1) {
      setTxNotice({
        variant: "error",
        title: "Select digits.",
        description: "Select at least one digit.",
      });
      return;
    }
    if (stakeError || !stakePerCharUstx) {
      setTxNotice({
        variant: "error",
        title: "Invalid stake.",
        description: stakeError ?? "Invalid stake amount.",
      });
      return;
    }
    setTxStatus("submitting");
    try {
      const openContractCall = await getOpenContractCall();
      openContractCall({
        contractAddress,
        contractName,
        functionName: "place-bet",
        functionArgs: [
          listCV(sortedDigits.map((digit) => uintCV(digit))),
          uintCV(stakePerCharUstx),
        ],
        network: getStacksNetwork(),
        stxAddress: address,
        onFinish: (data) => {
          setTxId(data.txId);
          setTxStatus("idle");
          setTxNotice({
            variant: "success",
            title: "Bet submitted.",
            description: "Transaction broadcasted successfully.",
          });
        },
        onCancel: () => {
          setTxStatus("idle");
          const message = getKnownErrorByKey("cancelled");
          setTxNotice({ variant: "error", title: message.title, description: message.detail });
        },
      });
    } catch (error) {
      setTxStatus("error");
      const message = getHumanReadableError(error);
      setTxNotice({ variant: "error", title: message.title, description: message.detail });
    }
  };

  return (
    <main className="mx-auto max-w-4xl px-6 py-12 space-y-10">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold">Place Bet</h1>
        <p className="text-sm text-zinc-400">
          Select digits and commit a bet on Stacks testnet.
        </p>
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
      </header>

      {networkName !== "testnet" ? (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          Switch to Testnet.
        </div>
      ) : null}

      <section className="space-y-4 rounded-lg border border-zinc-800/60 bg-zinc-900/20 p-4">
        <h2 className="text-lg font-semibold text-zinc-100">Wallet</h2>
        <StacksWalletPanel />
        {!address ? (
          <Notice
            variant="info"
            title="Connect your wallet"
            description="Connect a wallet to place a bet on testnet."
          />
        ) : null}
      </section>

      <HowItWorksPanel />

      <section className="space-y-4 rounded-lg border border-zinc-800/60 bg-zinc-900/20 p-4">
        <h2 className="text-lg font-semibold text-zinc-100">Choose Digits</h2>
        <div className="grid gap-4 md:grid-cols-[1fr_2fr]">
          <div>
            <p className="text-xs text-zinc-500 mb-2">A-F</p>
            <div className="grid grid-cols-3 gap-2">
              {LEFT_KEYS.map((key) => {
                const digit = hexCharToDigit(key) ?? 0;
                const isSelected = selectedDigits.includes(digit);
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => toggleDigit(key)}
                    className={`rounded-md border px-3 py-2 text-sm ${
                      isSelected
                        ? "border-emerald-400/60 bg-emerald-400/10 text-emerald-200"
                        : "border-zinc-700 text-zinc-200 hover:border-zinc-500"
                    }`}>
                    {key}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <p className="text-xs text-zinc-500 mb-2">0-9</p>
            <div className="grid grid-cols-5 gap-2">
              {RIGHT_KEYS.map((key) => {
                const digit = hexCharToDigit(key) ?? 0;
                const isSelected = selectedDigits.includes(digit);
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => toggleDigit(key)}
                    className={`rounded-md border px-3 py-2 text-sm ${
                      isSelected
                        ? "border-emerald-400/60 bg-emerald-400/10 text-emerald-200"
                        : "border-zinc-700 text-zinc-200 hover:border-zinc-500"
                    }`}>
                    {key}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        <p className="text-xs text-zinc-500">
          Selected:{" "}
          {sortedDigits.length
            ? sortedDigits.map((digit) => toHexDigit(digit).toUpperCase()).join(", ")
            : "None"}
        </p>
      </section>

      <section className="space-y-4 rounded-lg border border-zinc-800/60 bg-zinc-900/20 p-4">
        <h2 className="text-lg font-semibold text-zinc-100">Stake</h2>
        <div className="space-y-2">
          <label className="text-sm text-zinc-400">
            Stake per character (STX)
          </label>
          <input
            value={stakeInput}
            onChange={(event) => setStakeInput(event.currentTarget.value)}
            placeholder="0.001"
            className="w-full rounded-md border border-zinc-700 bg-black px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-500"
          />
          {stakeError ? (
            <p className="text-xs text-red-300">{stakeError}</p>
          ) : null}
          {rounded ? (
            <p className="text-xs text-amber-300">
              Stake rounded down to 6 decimals for uSTX.
            </p>
          ) : null}
        </div>

        {feeBps === null && !feeError ? (
          <div className="space-y-2">
            <div className="h-4 w-1/2 animate-pulse rounded bg-zinc-800/60" />
            <div className="h-4 w-2/3 animate-pulse rounded bg-zinc-800/60" />
            <div className="h-4 w-3/4 animate-pulse rounded bg-zinc-800/60" />
          </div>
        ) : null}

        <div className="grid gap-2 text-sm text-zinc-300">
          <p>
            Selected count:{" "}
            <span className="text-zinc-100">{selectedCount}</span>
          </p>
          <p>
            Total stake (STX):{" "}
            <span className="text-zinc-100">
              {formatUstxToStx(totalStakeUstx)}{" "}
            </span>
            <span className="text-xs text-zinc-500">
              ({totalStakeUstx.toString()} uSTX)
            </span>
          </p>
          <p>
            Fee ({feeBpsValue.toString()} bps):{" "}
            <span className="text-zinc-100">
              {formatUstxToStx(feeUstx)}
            </span>{" "}
            <span className="text-xs text-zinc-500">
              ({feeUstx.toString()} uSTX)
            </span>
          </p>
          <p>
            Net to contract (STX):{" "}
            <span className="text-zinc-100">
              {formatUstxToStx(netUstx)}
            </span>{" "}
            <span className="text-xs text-zinc-500">
              ({netUstx.toString()} uSTX)
            </span>
          </p>
          {feeError ? <p className="text-xs text-amber-300">{feeError}</p> : null}
        </div>
      </section>

      <section className="space-y-3 rounded-lg border border-zinc-800/60 bg-zinc-900/20 p-4">
        <h2 className="text-lg font-semibold text-zinc-100">Commit Bet</h2>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={
            txStatus === "submitting" ||
            !address ||
            selectedCount < 1 ||
            Boolean(stakeError)
          }
          className="rounded-md border border-zinc-700 px-4 py-2 text-sm text-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed hover:border-zinc-500 hover:text-white">
          {txStatus === "submitting" ? "Submitting..." : "Place Bet"}
        </button>
        {txNotice ? (
          <Notice
            variant={txNotice.variant}
            title={txNotice.title}
            description={txNotice.description}
            actionLabel={txId ? "View transaction" : undefined}
            actionHref={txId ? getExplorerTxUrl(txId, networkName) : undefined}
          />
        ) : null}
        {txId ? (
          <p className="text-xs text-zinc-400">
            Submitted:{" "}
            <Link
              className="underline text-zinc-200 hover:text-white"
              href={getExplorerTxUrl(txId, networkName)}
              target="_blank">
              {txId}
            </Link>
          </p>
        ) : null}
      </section>
    </main>
  );
}
