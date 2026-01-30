# Release Draft — v0.1.0

## Tag

`v0.1.0`

## Deployment (Vercel)

1) Import the GitHub repo in Vercel.
2) Framework preset: Next.js.
3) Build command: `pnpm build`
4) Output: `.next`
5) Environment variables (Public):
   - `NEXT_PUBLIC_STACKS_NETWORK=testnet`
   - `NEXT_PUBLIC_CONTRACT_ADDRESS=ST29ECHHQ6F9344SGGGRGDPTPFPTXA3GHXGMKMRG1`
   - `NEXT_PUBLIC_CONTRACT_NAME=guess-the-hash`
   - `NEXT_PUBLIC_FEE_BPS=100`
   - `NEXT_PUBLIC_RESOLVER_TIP_USTX=1000`

## Release Notes

- Wallet connect and read-only contract status.
- Stacks testnet contract deployment wiring.
- Place bet flow with digit picker and staking calculator.
- Permissionless resolve with resolver tip.
- Stats + leaderboard via on-chain history.
- Bet receipts + history timeline.
- UX polish, error mapping, and “How it works” panels.
