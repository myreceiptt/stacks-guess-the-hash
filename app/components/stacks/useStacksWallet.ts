"use client";
import { useCallback, useState } from "react";
import { getStacksNetworkName } from "@/lib/stacks-config";
import { getHumanReadableConnectError } from "@/lib/stacks-errors";

export type StacksWalletState = {
  status: "disconnected" | "connecting" | "connected";
  address: string | null;
  error: string | null;
  errorDetail: string | null;
  networkName: "testnet" | "mainnet";
};

type WalletProvider = {
  request?: (method: string, params?: unknown) => Promise<unknown>;
};

function getLeatherProvider(): WalletProvider | null {
  if (typeof window === "undefined") {
    return null;
  }
  const w = window as unknown as {
    StacksProvider?: WalletProvider;
    btc?: WalletProvider;
  };
  return w.StacksProvider ?? w.btc ?? null;
}

function extractAddress(
  response: unknown,
  networkName: "testnet" | "mainnet",
): string | null {
  if (!response) {
    return null;
  }
  if (Array.isArray(response)) {
    const first = response.find((value) => typeof value === "string");
    return typeof first === "string" ? first : null;
  }
  if (typeof response === "string") {
    return response;
  }
  const record = response as Record<string, unknown>;
  const addresses = record.addresses ?? record.result;
  if (Array.isArray(addresses)) {
    const first = addresses[0] as any;
    if (typeof first === "string") {
      return first;
    }
    if (first?.address && typeof first.address === "string") {
      return first.address;
    }
  }
  const networkAddresses = record[networkName];
  if (typeof networkAddresses === "string") {
    return networkAddresses;
  }
  if (record.address && typeof record.address === "string") {
    return record.address;
  }
  return null;
}

async function requestWalletAddress(
  provider: WalletProvider,
  networkName: "testnet" | "mainnet",
): Promise<string> {
  if (!provider.request) {
    throw new Error("Wallet provider is unavailable.");
  }
  const methods = [
    "stx_requestAccounts",
    "stx_getAccounts",
    "getAccounts",
    "requestAccounts",
  ];
  for (const method of methods) {
    try {
      const result = await provider.request(method);
      const address = extractAddress(result, networkName);
      if (address) {
        return address;
      }
    } catch {
      // try next method
    }
  }
  throw new Error("Unable to request wallet address.");
}

export function useStacksWallet() {
  const networkName = getStacksNetworkName();
  const [state, setState] = useState<StacksWalletState>(() => ({
    status: "disconnected",
    address: null,
    error: null,
    errorDetail: null,
    networkName,
  }));

  const connect = useCallback(() => {
    setState((prev) => ({
      ...prev,
      status: "connecting",
      error: null,
      errorDetail: null,
    }));
    const provider = getLeatherProvider();
    if (!provider) {
      setState((prev) => ({
        ...prev,
        status: "disconnected",
        error:
          "Leather wallet not detected. Make sure the extension is installed and unlocked.",
        errorDetail: null,
      }));
      return;
    }
    requestWalletAddress(provider, networkName)
      .then((address) => {
        setState((prev) => ({
          ...prev,
          status: "connected",
          address,
          error: null,
          errorDetail: null,
        }));
      })
      .catch((error) => {
        const message = getHumanReadableConnectError(error);
        setState((prev) => ({
          ...prev,
          status: "disconnected",
          error: `${message.title} ${message.detail}`,
          errorDetail: error instanceof Error ? error.message : String(error),
        }));
      });
  }, [networkName]);

  const disconnect = useCallback(() => {
    setState({
      status: "disconnected",
      address: null,
      error: null,
      errorDetail: null,
      networkName,
    });
  }, [networkName]);

  return {
    ...state,
    connect,
    disconnect,
  };
}
