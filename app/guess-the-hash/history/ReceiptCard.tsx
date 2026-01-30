"use client";
import { useMemo, useState } from "react";
import { uintCV } from "@stacks/transactions";
import { getStacksNetwork } from "@/lib/stacks-network";
import {
  getStacksContractAddress,
  getStacksContractName,
  getStacksNetworkName,
} from "@/lib/stacks-config";
import { getExplorerTxUrl, formatUstxToStx, toHexDigit } from "@/lib/stacks-utils";
import type { BetReceipt } from "@/lib/stacks-history";
import Notice from "@/app/components/ui/Notice";
import StatusBadge from "@/app/components/ui/StatusBadge";
import { getHumanReadableError, getKnownErrorByKey } from "@/lib/stacks-errors";

type ReceiptCardProps = {
  receipt: BetReceipt;
  currentHeight: number | null;
  onRefresh: () => void;
};

function formatHeight(value: bigint | null) {
  return value === null ? "—" : value.toString();
}

function formatStxWithUstx(value: bigint | null) {
  if (value === null) {
    return "—";
  }
  return `${formatUstxToStx(value)} STX (${value.toString()} uSTX)`;
}

function formatStx(value: bigint | null) {
  if (value === null) {
    return "—";
  }
  return `${formatUstxToStx(value)} STX`;
}

function TxRow({
  label,
  txid,
  confirmed,
  timestamp,
}: {
  label: string;
  txid: string;
  confirmed: boolean;
  timestamp: string | null;
}) {
  const networkName = getStacksNetworkName();
  return (
    <div className="flex flex-col gap-1 rounded-md border border-zinc-800/70 bg-black/20 px-3 py-2 text-xs text-zinc-300">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-zinc-400">{label}</span>
        <span className={confirmed ? "text-emerald-300" : "text-amber-300"}>
          {confirmed ? "Confirmed" : "Pending"}
        </span>
      </div>
      <a
        className="underline text-zinc-200 hover:text-white"
        href={getExplorerTxUrl(txid, networkName)}
        target="_blank"
        rel="noreferrer">
        {txid}
      </a>
      {timestamp ? <span className="text-zinc-500">{timestamp}</span> : null}
    </div>
  );
}

export default function ReceiptCard({
  receipt,
  currentHeight,
  onRefresh,
}: ReceiptCardProps) {
  const [resolveStatus, setResolveStatus] = useState<
    "idle" | "submitting" | "broadcasted" | "error"
  >("idle");
  const [resolveNotice, setResolveNotice] = useState<{
    variant: "success" | "error" | "info";
    title: string;
    description?: string;
  } | null>(null);
  const [resolveTxId, setResolveTxId] = useState<string | null>(null);

  const contractAddress = getStacksContractAddress();
  const contractName = getStacksContractName();
  const networkName = getStacksNetworkName();

  const choicesLabel = useMemo(() => {
    if (!receipt.choices.length) {
      return "—";
    }
    return receipt.choices.map((digit) => toHexDigit(digit).toUpperCase()).join(" ");
  }, [receipt.choices]);

  const readiness = useMemo(() => {
    if (receipt.resolved) {
      return "Resolved";
    }
    if (currentHeight === null || receipt.targetHeight === null) {
      return "Pending";
    }
    if (currentHeight < Number(receipt.targetHeight)) {
      return "Pending";
    }
    return "Ready";
  }, [receipt, currentHeight]);

  const canResolve =
    receipt.betId !== null &&
    !receipt.resolved &&
    currentHeight !== null &&
    receipt.targetHeight !== null &&
    currentHeight >= Number(receipt.targetHeight);

  const onResolve = async () => {
    if (receipt.betId === null || !contractAddress || !contractName) {
      return;
    }
    setResolveNotice(null);
    setResolveStatus("submitting");
    try {
      const { openContractCall } = await import("@stacks/connect");
      openContractCall({
        contractAddress,
        contractName,
        functionName: "resolve",
        functionArgs: [uintCV(receipt.betId)],
        network: getStacksNetwork(),
        onFinish: async (data) => {
          setResolveTxId(data.txId);
          setResolveStatus("broadcasted");
          setResolveNotice({
            variant: "success",
            title: "Resolve submitted.",
            description: "Transaction broadcasted successfully.",
          });
          onRefresh();
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

  return (
    <div className="space-y-4 rounded-lg border border-zinc-800/70 bg-zinc-900/30 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold text-zinc-100">
            Bet {receipt.betId !== null ? `#${receipt.betId.toString()}` : "Unknown ID"}
          </h3>
          <p className="text-xs text-zinc-500">
            Network: {networkName}
          </p>
        </div>
        <div className="flex flex-col items-end text-xs text-zinc-400">
          <span>Current height: {currentHeight ?? "—"}</span>
          <span>Target height: {formatHeight(receipt.targetHeight)}</span>
        </div>
      </div>
      <StatusBadge
        variant={readiness === "Resolved" ? "resolved" : readiness === "Ready" ? "ready" : "pending"}
        label={readiness}
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1 text-xs text-zinc-400">
          <p>Selected digits</p>
          <p className="text-sm text-zinc-100">{choicesLabel}</p>
        </div>
        <div className="space-y-1 text-xs text-zinc-400">
          <p>Stake per character</p>
          <p className="text-sm text-zinc-100">{formatStxWithUstx(receipt.stakePerCharUstx)}</p>
        </div>
        <div className="space-y-1 text-xs text-zinc-400">
          <p>Total stake</p>
          <p className="text-sm text-zinc-100">{formatStx(receipt.totalStakeUstx)}</p>
        </div>
        <div className="space-y-1 text-xs text-zinc-400">
          <p>Fee</p>
          <p className="text-sm text-zinc-100">{formatStx(receipt.feeUstx)}</p>
        </div>
        <div className="space-y-1 text-xs text-zinc-400">
          <p>Placed height</p>
          <p className="text-sm text-zinc-100">{formatHeight(receipt.placedHeight)}</p>
        </div>
        <div className="space-y-1 text-xs text-zinc-400">
          <p>Target height</p>
          <p className="text-sm text-zinc-100">{formatHeight(receipt.targetHeight)}</p>
        </div>
        <div className="space-y-1 text-xs text-zinc-400">
          <p>Outcome</p>
          <p className="text-sm text-zinc-100">
            {receipt.outcomeDigit === null
              ? "—"
              : toHexDigit(receipt.outcomeDigit).toUpperCase()}
          </p>
        </div>
        <div className="space-y-1 text-xs text-zinc-400">
          <p>Result</p>
          <p className="text-sm text-zinc-100">
            {receipt.won === null ? "—" : receipt.won ? "Win" : "Loss"}
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <h4 className="text-xs uppercase tracking-wide text-zinc-400">Timeline</h4>
        <TxRow
          label="Place bet"
          txid={receipt.placeTx.txid}
          confirmed={receipt.placeTx.confirmed}
          timestamp={receipt.placeTx.timestamp}
        />
        {receipt.resolveTx ? (
          <TxRow
            label="Resolve"
            txid={receipt.resolveTx.txid}
            confirmed={receipt.resolveTx.confirmed}
            timestamp={receipt.resolveTx.timestamp}
          />
        ) : null}
        {receipt.resolved && !receipt.resolveTx ? (
          <p className="text-xs text-zinc-400">
            Resolved on-chain; resolve tx not found in wallet history (likely resolved by someone else).
            {receipt.resolvedHeight ? ` Resolved height: ${receipt.resolvedHeight.toString()}.` : ""}
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {receipt.betId === null || receipt.resolved ? null : (
          <button
            type="button"
            disabled={!canResolve || resolveStatus === "submitting"}
            onClick={onResolve}
            className="rounded-md border border-zinc-700 px-3 py-2 text-xs text-zinc-200 disabled:cursor-not-allowed disabled:opacity-60 hover:border-zinc-500">
            {canResolve ? "Resolve now" : "Waiting for target block"}
          </button>
        )}
        {resolveNotice ? (
          <Notice
            variant={resolveNotice.variant}
            title={resolveNotice.title}
            description={resolveNotice.description}
            actionLabel={resolveTxId ? "View resolve tx" : undefined}
            actionHref={resolveTxId ? getExplorerTxUrl(resolveTxId, networkName) : undefined}
          />
        ) : null}
      </div>
    </div>
  );
}
