import type { StacksNetworkName } from "./stacks-config";

export function shortenStacksAddress(address: string, size = 4): string {
  if (!address) {
    return "";
  }
  if (address.length <= size * 2 + 3) {
    return address;
  }
  return `${address.slice(0, size + 2)}...${address.slice(-size)}`;
}

export function getExplorerAddressUrl(
  principal: string,
  network: StacksNetworkName,
): string {
  return `https://explorer.hiro.so/address/${principal}?chain=${network}`;
}

export function getExplorerTxUrl(
  txid: string,
  network: StacksNetworkName,
): string {
  return `https://explorer.hiro.so/txid/${txid}?chain=${network}`;
}

export function toHexDigit(value: number): string {
  if (value >= 0 && value <= 9) {
    return value.toString(10);
  }
  if (value >= 10 && value <= 15) {
    return String.fromCharCode("a".charCodeAt(0) + (value - 10));
  }
  return value.toString(10);
}

export function hexCharToDigit(input: string): number | null {
  const value = input.trim().toLowerCase();
  if (value.length !== 1) {
    return null;
  }
  if (value >= "0" && value <= "9") {
    return Number(value);
  }
  if (value >= "a" && value <= "f") {
    return value.charCodeAt(0) - "a".charCodeAt(0) + 10;
  }
  return null;
}

export function bitmapToDigits(bitmap: bigint): number[] {
  const digits: number[] = [];
  for (let i = 0; i < 16; i += 1) {
    if ((bitmap & (1n << BigInt(i))) !== 0n) {
      digits.push(i);
    }
  }
  return digits;
}

export function parseStxToUstx(value: string): {
  ustx: bigint | null;
  rounded: boolean;
} {
  const trimmed = value.trim();
  if (!trimmed) {
    return { ustx: null, rounded: false };
  }
  if (!/^\d+(\.\d+)?$/.test(trimmed)) {
    return { ustx: null, rounded: false };
  }
  const [integerPart, fractionalRaw = ""] = trimmed.split(".");
  const rounded = fractionalRaw.length > 6;
  const fractional = fractionalRaw.slice(0, 6).padEnd(6, "0");
  const combined = `${integerPart}${fractional}`;
  try {
    const ustx = BigInt(combined);
    return { ustx, rounded };
  } catch {
    return { ustx: null, rounded: false };
  }
}

export function formatUstxToStx(ustx: bigint): string {
  const raw = ustx.toString();
  if (raw.length <= 6) {
    return `0.${raw.padStart(6, "0")}`.replace(/0+$/, "").replace(/\.$/, "");
  }
  const integerPart = raw.slice(0, -6);
  const fractionalPart = raw.slice(-6);
  const trimmed = fractionalPart.replace(/0+$/, "");
  return trimmed ? `${integerPart}.${trimmed}` : integerPart;
}
