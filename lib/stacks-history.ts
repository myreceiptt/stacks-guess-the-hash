import type { StacksNetworkName } from "./stacks-config";
import { getStacksContractPrincipal } from "./stacks-config";
import { fetchGuessTheHashBet, fetchGuessTheHashConfig } from "./stacks-readonly";
import {
  fetchAddressTransactions,
  filterGuessTheHashCalls,
  type StacksTx,
} from "./stacks-transactions";

export type BetReceipt = {
  betId: bigint | null;
  placeTx: {
    txid: string;
    blockHeight: number | null;
    timestamp: string | null;
    confirmed: boolean;
  };
  resolveTx: {
    txid: string;
    blockHeight: number | null;
    timestamp: string | null;
    confirmed: boolean;
  } | null;
  choices: number[];
  stakePerCharUstx: bigint | null;
  totalStakeUstx: bigint | null;
  feeUstx: bigint | null;
  placedHeight: bigint | null;
  targetHeight: bigint | null;
  resolved: boolean;
  resolvedHeight: bigint | null;
  outcomeDigit: number | null;
  won: boolean | null;
};

type ReceiptCacheEntry = {
  fetchedAt: number;
  receipts: BetReceipt[];
};

const receiptCache = new Map<string, ReceiptCacheEntry>();
const CACHE_TTL_MS = 20_000;

function cacheKey(address: string, networkName: StacksNetworkName) {
  return `${networkName}:${address}`;
}

function requireContractPrincipal(): string {
  const principal = getStacksContractPrincipal();
  if (!principal) {
    throw new Error("Contract principal is missing.");
  }
  return principal;
}

function parseUintFromRepr(repr?: string): bigint | null {
  if (!repr) {
    return null;
  }
  const match = repr.match(/u(\d+)/);
  if (!match) {
    return null;
  }
  try {
    return BigInt(match[1]);
  } catch {
    return null;
  }
}

function parseListUintFromRepr(repr?: string): number[] {
  if (!repr) {
    return [];
  }
  const matches = repr.match(/u(\d+)/g);
  if (!matches) {
    return [];
  }
  return matches
    .map((entry) => entry.replace("u", ""))
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value));
}

function getArgRepr(tx: StacksTx, name: string): string | undefined {
  return tx.contract_call?.function_args?.find((arg) => arg.name === name)?.repr;
}

function toReceiptTx(tx: StacksTx) {
  return {
    txid: tx.tx_id,
    blockHeight: tx.block_height ?? null,
    timestamp: tx.block_time_iso ?? null,
    confirmed: tx.tx_status === "success",
  };
}

function sortByNewest(a: StacksTx, b: StacksTx): number {
  const heightA = a.block_height ?? 0;
  const heightB = b.block_height ?? 0;
  if (heightA !== heightB) {
    return heightB - heightA;
  }
  const timeA = a.block_time_iso ? Date.parse(a.block_time_iso) : 0;
  const timeB = b.block_time_iso ? Date.parse(b.block_time_iso) : 0;
  return timeB - timeA;
}

export async function fetchBetReceiptsForAddress(
  address: string,
  networkName: StacksNetworkName,
  options: { force?: boolean } = {},
): Promise<BetReceipt[]> {
  const key = cacheKey(address, networkName);
  const cached = receiptCache.get(key);
  if (!options.force && cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.receipts;
  }

  const txs = await fetchAddressTransactions(address, networkName);
  const contractId = requireContractPrincipal();
  const grouped = filterGuessTheHashCalls(txs, contractId).sort(sortByNewest);
  const placeCalls = grouped.filter(
    (tx) => tx.contract_call?.function_name === "place-bet",
  );
  const resolveCalls = grouped.filter(
    (tx) => tx.contract_call?.function_name === "resolve",
  );

  const config = await fetchGuessTheHashConfig(address).catch(() => null);

  const resolveByBetId = new Map<string, StacksTx>();
  resolveCalls.forEach((tx) => {
    const betId = parseUintFromRepr(getArgRepr(tx, "bet-id"));
    if (betId !== null) {
      resolveByBetId.set(betId.toString(), tx);
    }
  });

  const receipts: BetReceipt[] = [];
  for (const tx of placeCalls) {
    const betId = parseUintFromRepr(tx.tx_result?.repr);
    const choices = parseListUintFromRepr(getArgRepr(tx, "choices"));
    const stakePerCharUstx = parseUintFromRepr(
      getArgRepr(tx, "stake-per-char-ustx"),
    );
    const totalStakeUstx =
      stakePerCharUstx !== null ? stakePerCharUstx * BigInt(choices.length) : null;
    const feeUstx =
      config && totalStakeUstx !== null
        ? (totalStakeUstx * config.feeBps) / 10000n
        : null;
    const placeTx = toReceiptTx(tx);

    let resolved = false;
    let resolvedHeight: bigint | null = null;
    let outcomeDigit: number | null = null;
    let won: boolean | null = null;
    let placedHeight: bigint | null = placeTx.blockHeight
      ? BigInt(placeTx.blockHeight)
      : null;
    let targetHeight: bigint | null = placedHeight ? placedHeight + 2n : null;
    let betStakePerChar = stakePerCharUstx;
    let betTotalStake = totalStakeUstx;
    let betFee = feeUstx;
    let betChoices = choices;

    if (betId !== null) {
      const bet = await fetchGuessTheHashBet(betId, address).catch(() => null);
      if (bet) {
        resolved = bet.resolved;
        resolvedHeight = bet.resolvedHeight;
        outcomeDigit = bet.outcomeDigit;
        won = bet.won;
        placedHeight = bet.placedHeight;
        targetHeight = bet.targetHeight;
        betStakePerChar = bet.stakePerCharUstx;
        betTotalStake = bet.totalStakeUstx;
        betFee = bet.feeUstx;
        betChoices = [];
        for (let i = 0; i < 16; i += 1) {
          if ((bet.choiceBitmap & (1n << BigInt(i))) !== 0n) {
            betChoices.push(i);
          }
        }
      }
    }

    const resolveTx =
      betId !== null ? resolveByBetId.get(betId.toString()) ?? null : null;

    receipts.push({
      betId,
      placeTx,
      resolveTx: resolveTx ? toReceiptTx(resolveTx) : null,
      choices: betChoices,
      stakePerCharUstx: betStakePerChar,
      totalStakeUstx: betTotalStake,
      feeUstx: betFee,
      placedHeight,
      targetHeight,
      resolved,
      resolvedHeight,
      outcomeDigit,
      won,
    });
  }

  receiptCache.set(key, { fetchedAt: Date.now(), receipts });
  return receipts;
}

export function clearBetReceiptCache(address?: string, networkName?: StacksNetworkName) {
  if (!address || !networkName) {
    receiptCache.clear();
    return;
  }
  receiptCache.delete(cacheKey(address, networkName));
}
