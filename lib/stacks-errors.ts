export type HumanErrorMessage = {
  title: string;
  detail: string;
};

const MESSAGES = {
  tooEarly: {
    title: "Too early.",
    detail: "Wait until target block is reached.",
  },
  cancelled: {
    title: "Transaction cancelled.",
    detail: "Transaction cancelled in wallet.",
  },
  networkMismatch: {
    title: "Wrong network.",
    detail: "Switch your wallet to Stacks Testnet.",
  },
  insufficientStx: {
    title: "Not enough STX.",
    detail: "Not enough STX to cover stake + fees.",
  },
  generic: {
    title: "Transaction failed.",
    detail: "Transaction failed. See explorer for details.",
  },
};

function normalizeErrorMessage(error: unknown): string {
  if (!error) {
    return "";
  }
  if (typeof error === "string") {
    return error;
  }
  if (error instanceof Error) {
    return error.message;
  }
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

export function getHumanReadableError(
  error: unknown,
  overrides?: Partial<HumanErrorMessage>,
): HumanErrorMessage {
  const message = normalizeErrorMessage(error).toLowerCase();
  if (message.includes("u425") || message.includes("err_too_early") || message.includes("too early")) {
    return { ...MESSAGES.tooEarly, ...overrides };
  }
  if (
    message.includes("cancel") ||
    message.includes("user rejected") ||
    message.includes("denied") ||
    message.includes("aborted")
  ) {
    return { ...MESSAGES.cancelled, ...overrides };
  }
  if (message.includes("network") && message.includes("testnet")) {
    return { ...MESSAGES.networkMismatch, ...overrides };
  }
  if (
    message.includes("insufficient") ||
    message.includes("not enough stx") ||
    message.includes("balance")
  ) {
    return { ...MESSAGES.insufficientStx, ...overrides };
  }
  return { ...MESSAGES.generic, ...overrides };
}

export function getKnownErrorByKey(
  key: keyof typeof MESSAGES,
): HumanErrorMessage {
  return MESSAGES[key];
}
