"use client";
import { useState } from "react";

export default function HowItWorksPanel() {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-lg border border-zinc-800/70 bg-zinc-900/30 p-4">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between text-sm text-zinc-200">
        <span className="font-semibold">How it works</span>
        <span className="text-xs text-zinc-400">{open ? "Hide" : "Show"}</span>
      </button>
      {open ? (
        <div className="mt-3 space-y-2 text-xs text-zinc-400">
          <p>You pick 0–9/A–F. Contract checks the next+2 block’s last hex digit.</p>
          <p>Fee is taken at bet time. Gas is paid by your wallet when you place/resolve.</p>
          <p>Anyone can resolve a bet after it’s ready.</p>
        </div>
      ) : null}
    </div>
  );
}
