import type { StacksNetworkName } from "./stacks-config";

export function getStacksApiBase(networkName: StacksNetworkName): string {
  if (networkName === "mainnet") {
    return "https://api.hiro.so";
  }
  return "https://api.testnet.hiro.so";
}

export async function fetchStacksTipHeight(
  networkName: StacksNetworkName,
): Promise<number | null> {
  try {
    const response = await fetch(`${getStacksApiBase(networkName)}/v2/info`, {
      cache: "no-store",
    });
    if (!response.ok) {
      return null;
    }
    const data = (await response.json()) as {
      stacks_tip_height?: number;
    };
    if (typeof data.stacks_tip_height === "number") {
      return data.stacks_tip_height;
    }
    return null;
  } catch {
    return null;
  }
}
