"use client";
import { useCallback, useState } from "react";
import { getStacksNetworkName } from "@/lib/stacks-config";

export type StacksWalletState = {
  status: "disconnected" | "connecting" | "connected";
  address: string | null;
  error: string | null;
  errorDetail: string | null;
  lastResponseKeys: string[] | null;
  lastResultKeys: string[] | null;
  lastStack: string | null;
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
    LeatherProvider?: WalletProvider;
  };
  return w.LeatherProvider ?? null;
}

type LeatherAddressEntry = {
  symbol?: string;
  address?: string;
};

function parseLeatherAddress(
  response: unknown,
): { address: string; responseKeys: string[]; resultKeys: string[] } {
  if (!response || typeof response !== "object") {
    throw new Error("No response received from Leather.");
  }
  const record = response as Record<string, unknown>;
  const responseKeys = Object.keys(record);
  const result =
    (record.result as Record<string, unknown> | undefined) ?? record;
  const resultKeys = Object.keys(result);
  const addresses = (result as Record<string, unknown>).addresses;
  if (!Array.isArray(addresses)) {
    throw new Error("Leather response missing addresses array.");
  }
  const entries = addresses as LeatherAddressEntry[];
  const stxEntry =
    entries.find((entry) => entry?.symbol === "STX") ??
    entries.find(
      (entry) =>
        typeof entry?.address === "string" &&
        (entry.address.startsWith("SP") || entry.address.startsWith("ST")),
    );
  if (!stxEntry?.address) {
    throw new Error("No STX address returned by Leather.");
  }
  return { address: stxEntry.address, responseKeys, resultKeys };
}

async function requestWalletAddress(
  provider: WalletProvider,
): Promise<{ address: string; responseKeys: string[]; resultKeys: string[] }> {
  if (!provider.request) {
    throw new Error("Wallet provider is unavailable.");
  }
  const response = await provider.request("getAddresses");
  return parseLeatherAddress(response);
}

export function useStacksWallet() {
  const networkName = getStacksNetworkName();
  const [isConnecting, setIsConnecting] = useState(false);
  const [state, setState] = useState<StacksWalletState>(() => ({
    status: "disconnected",
    address: null,
    error: null,
    errorDetail: null,
    lastResponseKeys: null,
    lastResultKeys: null,
    lastStack: null,
    networkName,
  }));

  const connect = useCallback(() => {
    if (isConnecting) {
      return;
    }
    setIsConnecting(true);
    setState((prev) => ({
      ...prev,
      status: "connecting",
      error: null,
      errorDetail: null,
      lastResponseKeys: null,
      lastResultKeys: null,
      lastStack: null,
    }));
    const provider = getLeatherProvider();
    if (!provider) {
      setState((prev) => ({
        ...prev,
        status: "disconnected",
        error:
          "LeatherProvider not detected (check extension site access).",
        errorDetail: null,
        lastResponseKeys: null,
        lastResultKeys: null,
        lastStack: null,
      }));
      setIsConnecting(false);
      return;
    }
    requestWalletAddress(provider)
      .then(({ address, responseKeys, resultKeys }) => {
        setState((prev) => ({
          ...prev,
          status: "connected",
          address,
          error: null,
          errorDetail: null,
          lastResponseKeys: responseKeys,
          lastResultKeys: resultKeys,
          lastStack: null,
        }));
      })
      .catch((error) => {
        setState((prev) => ({
          ...prev,
          status: "disconnected",
          error:
            "Wallet connection failed. Check pop-up blocking and Leather testnet settings.",
          errorDetail: error instanceof Error ? error.message : String(error),
          lastResponseKeys: null,
          lastResultKeys: null,
          lastStack: error instanceof Error ? error.stack ?? null : null,
        }));
      })
      .finally(() => {
        setIsConnecting(false);
      });
  }, [isConnecting]);

  const disconnect = useCallback(() => {
    setState({
      status: "disconnected",
      address: null,
      error: null,
      errorDetail: null,
      lastResponseKeys: null,
      lastResultKeys: null,
      lastStack: null,
      networkName,
    });
  }, [networkName]);

  return {
    ...state,
    connect,
    disconnect,
  };
}
