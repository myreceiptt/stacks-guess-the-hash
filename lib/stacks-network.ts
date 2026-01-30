import { STACKS_MAINNET, STACKS_TESTNET, createNetwork } from "@stacks/network";
import { getStacksNetworkName } from "./stacks-config";

export function getStacksNetwork() {
  const networkName = getStacksNetworkName();
  if (networkName === "mainnet") {
    return createNetwork(STACKS_MAINNET);
  }
  return createNetwork(STACKS_TESTNET);
}
