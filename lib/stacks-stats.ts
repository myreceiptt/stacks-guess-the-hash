import type { StacksNetworkName } from "./stacks-config";
import { getStacksContractPrincipal, getStacksContractAddress } from "./stacks-config";
import { fetchGuessTheHashBet } from "./stacks-readonly";
import {
  fetchAddressTransactions,
  fetchContractTransactions,
  filterGuessTheHashCalls,
  type StacksTx,
} from "./stacks-transactions";

export type WalletStats = {
  totalBets: number;
  totalResolved: number;
  wins: number;
  losses: number;
  totalStakedUstx: bigint;
  totalPayoutsUstx: bigint;
  netUstx: bigint;
  scannedBets: number;
};

export type LeaderboardEntry = {
  address: string;
  wins: number;
  totalBets: number;
  winRate: number;
  totalStakedUstx: bigint;
  totalPayoutsUstx: bigint;
  netUstx: bigint;
};

type ParsedPlaceBet = {
  betId: bigint | null;
  choicesCount: number;
  stakePerCharUstx: bigint | null;
};

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

function parseListUintFromRepr(repr?: string): bigint[] {
  if (!repr) {
    return [];
  }
  const matches = repr.match(/u(\d+)/g);
  if (!matches) {
    return [];
  }
  return matches
    .map((entry) => entry.replace("u", ""))
    .map((value) => {
      try {
        return BigInt(value);
      } catch {
        return null;
      }
    })
    .filter((value): value is bigint => value !== null);
}

function getArgRepr(tx: StacksTx, name: string): string | undefined {
  return tx.contract_call?.function_args?.find((arg) => arg.name === name)?.repr;
}

function parsePlaceBet(tx: StacksTx): ParsedPlaceBet {
  const choicesRepr = getArgRepr(tx, "choices");
  const stakeRepr = getArgRepr(tx, "stake-per-char-ustx");
  const betId = parseUintFromRepr(tx.tx_result?.repr);
  const choices = parseListUintFromRepr(choicesRepr);
  const stakePerCharUstx = parseUintFromRepr(stakeRepr);
  return {
    betId,
    choicesCount: choices.length,
    stakePerCharUstx,
  };
}

function isSuccess(tx: StacksTx): boolean {
  return tx.tx_status === "success";
}

function requireContractPrincipal(): string {
  const principal = getStacksContractPrincipal();
  if (!principal) {
    throw new Error("Contract principal is missing.");
  }
  return principal;
}

function requireFallbackSender(): string {
  const address = getStacksContractAddress();
  if (!address) {
    throw new Error("Contract address is missing.");
  }
  return address;
}

export async function buildWalletStats(
  address: string,
  networkName: StacksNetworkName,
): Promise<WalletStats> {
  const contractId = requireContractPrincipal();
  const txs = await fetchAddressTransactions(address, networkName);
  const calls = filterGuessTheHashCalls(txs, contractId).filter(isSuccess);
  const placeBets = calls.filter(
    (tx) => tx.contract_call?.function_name === "place-bet",
  );
  const betIds: bigint[] = [];
  placeBets.forEach((tx) => {
    const parsed = parsePlaceBet(tx);
    if (parsed.betId !== null) {
      betIds.push(parsed.betId);
    }
  });

  let totalResolved = 0;
  let wins = 0;
  let losses = 0;
  let totalStakedUstx = 0n;
  let totalPayoutsUstx = 0n;

  for (const betId of betIds) {
    const bet = await fetchGuessTheHashBet(betId, address);
    if (!bet) {
      continue;
    }
    totalStakedUstx += bet.totalStakeUstx;
    if (bet.resolved) {
      totalResolved += 1;
      if (bet.won) {
        wins += 1;
        totalPayoutsUstx += 2n * bet.stakePerCharUstx;
      } else {
        losses += 1;
      }
    }
  }

  const totalBets = betIds.length;
  const netUstx = totalPayoutsUstx - totalStakedUstx;
  return {
    totalBets,
    totalResolved,
    wins,
    losses,
    totalStakedUstx,
    totalPayoutsUstx,
    netUstx,
    scannedBets: betIds.length,
  };
}

export async function buildLeaderboard(
  networkName: StacksNetworkName,
  topN = 20,
): Promise<{ entries: LeaderboardEntry[]; scannedBets: number }> {
  const contractId = requireContractPrincipal();
  const fallbackSender = requireFallbackSender();
  const txs = await fetchContractTransactions(contractId, networkName);
  const calls = filterGuessTheHashCalls(txs, contractId).filter(isSuccess);
  const placeBets = calls.filter(
    (tx) => tx.contract_call?.function_name === "place-bet",
  );
  const betsById = new Map<bigint, string>();
  placeBets.forEach((tx) => {
    const parsed = parsePlaceBet(tx);
    if (parsed.betId !== null) {
      betsById.set(parsed.betId, tx.sender_address);
    }
  });

  const statsByAddress = new Map<string, LeaderboardEntry>();
  for (const [betId, bettor] of betsById) {
    const bet = await fetchGuessTheHashBet(betId, fallbackSender);
    if (!bet) {
      continue;
    }
    const entry = statsByAddress.get(bettor) ?? {
      address: bettor,
      wins: 0,
      totalBets: 0,
      winRate: 0,
      totalStakedUstx: 0n,
      totalPayoutsUstx: 0n,
      netUstx: 0n,
    };
    entry.totalBets += 1;
    entry.totalStakedUstx += bet.totalStakeUstx;
    if (bet.resolved && bet.won) {
      entry.wins += 1;
      entry.totalPayoutsUstx += 2n * bet.stakePerCharUstx;
    }
    entry.netUstx = entry.totalPayoutsUstx - entry.totalStakedUstx;
    entry.winRate = entry.totalBets > 0 ? entry.wins / entry.totalBets : 0;
    statsByAddress.set(bettor, entry);
  }

  const entries = Array.from(statsByAddress.values()).sort((a, b) => {
    if (a.netUstx === b.netUstx) {
      return b.wins - a.wins;
    }
    return a.netUstx > b.netUstx ? -1 : 1;
  });

  return { entries: entries.slice(0, topN), scannedBets: betsById.size };
}
