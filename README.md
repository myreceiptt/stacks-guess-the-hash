# Guess The Hash (Stacks)

Design status: **DESIGN FINAL — EXECUTION ONLY**

## Overview

Guess The Hash is a simple on-chain betting game on Stacks:

- Each bet is independent.
- User selects 1+ hex digits (`0-9`, `a-f`).
- UI defines `stakePerChar`.
- Total stake = `stakePerChar × number of digits chosen`.
- Contract sets `targetHeight = block-height + 2`.
- Outcome = **last hex digit** of the block hash at `targetHeight`.
- Win if outcome ∈ chosen digits.
- Payout on win = `2 × stakePerChar`.
- Loss = no payout.
- Fee = **1%** deducted at place-bet.
- Settlement is permissionless via `resolve(betId)`.
- Resolver pays gas and receives a small resolver tip.

## Repo

- `contracts/` — Clarity contracts (Clarinet project)
- `tests/` — Clarinet SDK + Vitest tests
- `settings/` — Clarinet network settings

## Local dev

```bash
pnpm install
clarinet check
pnpm test
```

