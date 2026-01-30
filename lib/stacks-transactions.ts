import type { StacksNetworkName } from "./stacks-config";
import { getStacksApiBase } from "./stacks-api";

export type StacksTx = {
  tx_id: string;
  sender_address: string;
  tx_type: string;
  tx_status: string;
  block_height?: number;
  block_time_iso?: string;
  contract_call?: {
    contract_id: string;
    function_name: string;
    function_args: Array<{
      name: string;
      type: string;
      repr: string;
    }>;
  };
  tx_result?: {
    repr?: string;
  };
};

type TxResponse = {
  results: StacksTx[];
  total: number;
  limit: number;
  offset: number;
};

async function fetchTxPage(url: string): Promise<TxResponse | null> {
  try {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) {
      return null;
    }
    return (await response.json()) as TxResponse;
  } catch {
    return null;
  }
}

export async function fetchContractTransactions(
  contractId: string,
  networkName: StacksNetworkName,
  limit = 50,
  maxPages = 5,
): Promise<StacksTx[]> {
  const base = getStacksApiBase(networkName);
  const txs: StacksTx[] = [];
  let offset = 0;
  for (let page = 0; page < maxPages; page += 1) {
    const url = `${base}/extended/v1/contract/${contractId}/transactions?limit=${limit}&offset=${offset}`;
    const response = await fetchTxPage(url);
    if (!response?.results?.length) {
      break;
    }
    txs.push(...response.results);
    offset += response.results.length;
    if (offset >= response.total) {
      break;
    }
  }
  return txs;
}

export async function fetchAddressTransactions(
  address: string,
  networkName: StacksNetworkName,
  limit = 50,
  maxPages = 5,
): Promise<StacksTx[]> {
  const base = getStacksApiBase(networkName);
  const txs: StacksTx[] = [];
  let offset = 0;
  for (let page = 0; page < maxPages; page += 1) {
    const url = `${base}/extended/v1/address/${address}/transactions?limit=${limit}&offset=${offset}`;
    const response = await fetchTxPage(url);
    if (!response?.results?.length) {
      break;
    }
    txs.push(...response.results);
    offset += response.results.length;
    if (offset >= response.total) {
      break;
    }
  }
  return txs;
}

export function filterGuessTheHashCalls(
  txs: StacksTx[],
  contractId: string,
): StacksTx[] {
  return txs.filter((tx) => {
    if (tx.tx_type !== "contract_call" || !tx.contract_call) {
      return false;
    }
    if (tx.contract_call.contract_id !== contractId) {
      return false;
    }
    const name = tx.contract_call.function_name;
    return name === "place-bet" || name === "resolve";
  });
}
