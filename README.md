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
pnpm dev
```

Optional (contracts/tests):

```bash
clarinet check
pnpm test
```

## Testnet Deployment

- Network: testnet
- Contract principal: `ST29ECHHQ6F9344SGGGRGDPTPFPTXA3GHXGMKMRG1.guess-the-hash`
- Deployment tx: `7cc2f3f9a9081a8e848e46d76c655d3169cc0624836b0d828b14b4340d0302ab`
- Config txs:
  - set-fee-bps (100): `4cf6da03d400027b9d188ee48a7d81fc35689f38a1dba0ae1917593f7648c468`
  - set-fee-treasury (deployer): `d0814f7279b57e833232c508b80358128e90f838dd10d4a2ab38b9a1f4717b51`
  - set-resolver-tip-ustx (1000): `866eb5c5daa3de6e061f3052b36e2967a12c61253277c68419730278337dfad9`
- Sanity txs:
  - place-bet: `0cc2071a3b5cee1a518508fa18a7bd3c02383ff4e72ecc11a78f7d778420306f`
  - resolve (early, err u425): `22673093a1992df47a9e3b3b448afc140d7c9634f5fde3421aa3e940b0d2eb4e`
  - resolve (after target): `30dc3f5fd7592b4408eed45a0834d489f3711a7458308eb24b10e9e880bbd664`

### Explorer links

- Contract: https://explorer.stacks.co/address/ST29ECHHQ6F9344SGGGRGDPTPFPTXA3GHXGMKMRG1.guess-the-hash?chain=testnet
- Deployment tx: https://explorer.stacks.co/txid/7cc2f3f9a9081a8e848e46d76c655d3169cc0624836b0d828b14b4340d0302ab?chain=testnet
- Config txs:
  - https://explorer.stacks.co/txid/4cf6da03d400027b9d188ee48a7d81fc35689f38a1dba0ae1917593f7648c468?chain=testnet
  - https://explorer.stacks.co/txid/d0814f7279b57e833232c508b80358128e90f838dd10d4a2ab38b9a1f4717b51?chain=testnet
  - https://explorer.stacks.co/txid/866eb5c5daa3de6e061f3052b36e2967a12c61253277c68419730278337dfad9?chain=testnet

### Frontend calls

- place-bet:
  - `contract-call?` to `guess-the-hash::place-bet` with:
    - `choices` as `(list u0 u1 u10 ...)` (1..16 unique digits)
    - `stake-per-char-ustx` as `u<number>`
- resolve:
  - `contract-call?` to `guess-the-hash::resolve` with `u<bet-id>` after `target-height`

## Key routes

- `/guess-the-hash` — home + contract status
- `/guess-the-hash/place-bet` — place a bet
- `/guess-the-hash/history` — bet receipts + resolve
- `/guess-the-hash/stats` — leaderboard + my stats

## Smoke Test

- Connect wallet (testnet)
- Place bet with 1 digit
- Confirm tx link works
- Wait for ready
- Resolve
- Check History receipt updates
- Check Stats shows numbers
