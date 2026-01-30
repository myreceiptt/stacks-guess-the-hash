export type StacksConnectModule = {
  showConnect?: (...args: any[]) => void;
  openContractCall?: (...args: any[]) => void;
  default?: {
    showConnect?: (...args: any[]) => void;
    openContractCall?: (...args: any[]) => void;
  };
};

export async function loadStacksConnect(): Promise<StacksConnectModule> {
  if (typeof window === "undefined") {
    throw new Error("Stacks Connect is only available in the browser.");
  }
  const mod = (await import("@stacks/connect")) as StacksConnectModule;
  return mod;
}

export async function getShowConnect(): Promise<(...args: any[]) => void> {
  const mod = await loadStacksConnect();
  const showConnectFn =
    mod.showConnect ?? mod.default?.showConnect ?? (mod.default as any);
  if (typeof showConnectFn !== "function") {
    throw new Error("Wallet connect is unavailable in this build.");
  }
  return showConnectFn;
}

export async function getOpenContractCall(): Promise<(...args: any[]) => void> {
  const mod = await loadStacksConnect();
  const openFn =
    mod.openContractCall ?? mod.default?.openContractCall ?? (mod.default as any);
  if (typeof openFn !== "function") {
    throw new Error("Contract call helper is unavailable in this build.");
  }
  return openFn;
}
