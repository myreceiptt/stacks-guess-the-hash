"use client";
import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16 space-y-6">
      <h1 className="text-3xl font-semibold">Guess The Hash</h1>
      <p className="text-sm text-zinc-400">
        Read-only UI for the Stacks testnet contract.
      </p>
      <div className="flex flex-col gap-3">
        <Link
          className="underline text-zinc-200 hover:text-white"
          href="/guess-the-hash">
          Contract Status
        </Link>
        <Link
          className="underline text-zinc-200 hover:text-white"
          href="/guess-the-hash/wallet">
          My Wallet
        </Link>
      </div>
    </main>
  );
}
