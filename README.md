# Arc Bridge MVP

Simple premium UI for:
- swapping ETH to USDC on Sepolia with a direct Uniswap route
- bridging native USDC between Ethereum Sepolia and Arc Testnet
- automatic wallet network switching
- balance detection for Sepolia and Arc

## What is wired

- Wallet connection with RainbowKit / wagmi
- Auto switch between Sepolia and Arc Testnet
- USDC balance read on both chains
- Bridge flow scaffolded around Circle Bridge Kit
- Footer credit linked to `@Rubensbrandao1`
- Logo and banner in `.webp`

## Important

This project was written as a fast MVP package and was not built in this environment, because external npm installs are unavailable here.
Before deploying, run:

```bash
npm install
npm run dev
```

If Circle's current adapter helper signature changed, adjust the adapter creation in `src/App.tsx` to match the latest `@circle-fin/adapter-viem-v2` sample app.

## Official references used

- Arc docs: bridge USDC to Arc
- Arc docs: connect to Arc
- Circle docs: USDC contract addresses
- Circle / Arc App Kit quickstart for bridging between EVM chains
- Circle sample wallet-connect bridge app
- Uniswap support page confirming Sepolia support in the interface
