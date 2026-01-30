"use client";
import { useEffect, useState } from "react";
import { getStacksNetworkName } from "@/lib/stacks-config";
import { fetchStacksTipHeight } from "@/lib/stacks-api";

export function useStacksTipHeight(pollMs = 15000) {
  const networkName = getStacksNetworkName();
  const [height, setHeight] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    let interval: NodeJS.Timeout | null = null;

    const load = async () => {
      const result = await fetchStacksTipHeight(networkName);
      if (!mounted) {
        return;
      }
      if (result === null) {
        setError("Unable to load current block height.");
        return;
      }
      setError(null);
      setHeight(result);
    };

    load();
    interval = setInterval(load, pollMs);

    return () => {
      mounted = false;
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [networkName, pollMs]);

  return { height, error, networkName };
}
