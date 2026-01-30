"use client";
import { useCallback, useEffect, useState } from "react";
import type { UserData } from "@stacks/auth";
import {
  getStacksAddressFromUserData,
  getStacksNetworkName,
} from "@/lib/stacks-config";
import { getStacksNetwork } from "@/lib/stacks-network";
import { stacksUserSession } from "@/lib/stacks-session";
import { getShowConnect } from "@/lib/stacks-connect";
import {
  getHumanReadableConnectError,
  getKnownErrorByKey,
} from "@/lib/stacks-errors";

export type StacksWalletState = {
  status: "disconnected" | "connecting" | "connected";
  address: string | null;
  userData: UserData | null;
  error: string | null;
  errorDetail: string | null;
  networkName: "testnet" | "mainnet";
};

export function useStacksWallet() {
  const networkName = getStacksNetworkName();
  const getSessionState = useCallback((): StacksWalletState => {
    if (!stacksUserSession.isUserSignedIn()) {
      return {
        status: "disconnected",
        address: null,
        userData: null,
        error: null,
        errorDetail: null,
        networkName,
      };
    }
    const userData = stacksUserSession.loadUserData();
    return {
      status: "connected",
      address: getStacksAddressFromUserData(userData, networkName),
      userData,
      error: null,
      errorDetail: null,
      networkName,
    };
  }, [networkName]);

  const [state, setState] = useState<StacksWalletState>(() =>
    getSessionState(),
  );

  const refresh = useCallback(() => {
    setState(getSessionState());
  }, [getSessionState]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    if (stacksUserSession.isSignInPending()) {
      setState((prev) => ({
        ...prev,
        status: "connecting",
        error: null,
        errorDetail: null,
      }));
      stacksUserSession
        .handlePendingSignIn()
        .then(() => {
          refresh();
        })
        .catch((error) => {
          const message = getHumanReadableConnectError(error);
          setState((prev) => ({
            ...prev,
            status: "disconnected",
            error: `${message.title} ${message.detail}`,
            errorDetail:
              error instanceof Error ? error.message : String(error),
          }));
        });
    }
  }, [refresh]);

  const connect = useCallback(() => {
    setState((prev) => ({
      ...prev,
      status: "connecting",
      error: null,
      errorDetail: null,
    }));
    if (typeof window === "undefined") {
      setState((prev) => ({
        ...prev,
        status: "disconnected",
        error: "Wallet connect is only available in the browser.",
        errorDetail: null,
      }));
      return;
    }
    const connectOptions = {
      appDetails: {
        name: "Guess The Hash",
        icon: "/icon.svg",
      },
      userSession: stacksUserSession as unknown as any,
      network: getStacksNetwork(),
      manifestPath: "/manifest.json",
      authOptions: {
        appDetails: {
          name: "Guess The Hash",
          icon: "/icon.svg",
        },
        userSession: stacksUserSession as unknown as any,
        onFinish: () => {
          refresh();
        },
        onCancel: () => {
          const message = getKnownErrorByKey("connectCancelled");
          setState((prev) => ({
            ...prev,
            status: "disconnected",
            error: `${message.title} ${message.detail}`,
            errorDetail: null,
          }));
        },
      },
      onFinish: () => {
        refresh();
      },
      onCancel: () => {
        const message = getKnownErrorByKey("connectCancelled");
        setState((prev) => ({
          ...prev,
          status: "disconnected",
          error: `${message.title} ${message.detail}`,
          errorDetail: null,
        }));
      },
    };
    getShowConnect()
      .then((showConnectFn) => {
        showConnectFn(connectOptions);
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
  }, [refresh]);

  const disconnect = useCallback(() => {
    stacksUserSession.signUserOut("/");
    setState({
      status: "disconnected",
      address: null,
      userData: null,
      error: null,
      errorDetail: null,
      networkName,
    });
  }, [networkName]);

  return {
    ...state,
    connect,
    disconnect,
    refresh,
  };
}
