# PredictGuard

> Confidential prediction markets built on Zama FHEVM

PredictGuard is a privacy‑first prediction market protocol. Using Fully Homomorphic Encryption (FHE) with Zama’s FHEVM, traders create and resolve markets while orders, positions, and strategies stay encrypted end‑to‑end. Outcomes remain publicly verifiable without leaking individual signals.

---

## Problem → Our Approach

- Exposure of orders/positions on-chain → Encrypt all intents client‑side
- Front‑running/copy‑trading → Hide prices/sizes until settlement
- Unverifiable privacy → On‑chain, verifiable FHEVM computation
- Centralized trust → Decentralized markets and resolution

---

## What Zama FHEVM Enables

FHEVM lets smart contracts operate on ciphertexts. PredictGuard performs matching, aggregation, and settlement without accessing plaintext.

```
Trader (client)
  └─ FHE Encrypt (order, price, size)
         └─ Encrypted Order → FHEVM Contracts
                              └─ Encrypted Matching/Aggregation
                                       └─ Encrypted Payouts → Verifiable Result
```

Properties
- No plaintext positions on-chain
- Markets remain auditable and disputable
- Outcomes are verifiable; individual trades stay private

---

## Quick Start

Prereqs: Node.js 18+, MetaMask, Sepolia ETH

Setup
```bash
git clone https://github.com/sneakerheadinthepast/PredictGuard
cd PredictGuard
npm install
cp .env.example .env.local
```

Deploy
```bash
npm run deploy:sepolia
```

Run
```bash
npm run dev
```

---

## Lifecycle

1) Create Market: define question, oracle, close time
2) Trade Privately: place/cancel encrypted orders
3) Resolve: oracle posts outcome; contracts compute encrypted settlement
4) Redeem: users claim payouts; trades remain confidential

Privacy Model
- Encrypted: orders, sizes, positions, fills
- Transparent: market metadata, resolution proofs, contract code

---

## Architecture

| Layer            | Tech                   | Role                                 |
|------------------|------------------------|--------------------------------------|
| Encryption       | Zama FHE               | Client‑side encryption of intents     |
| Contracts        | Solidity + FHEVM       | Encrypted matching/settlement         |
| Chain            | Ethereum Sepolia       | Execution + storage                   |
| Frontend         | React + TypeScript     | Trading UI + local crypto             |
| Tooling          | Hardhat, Ethers        | Build/test/deploy                     |

Core Contracts
- MarketFactory: market creation/registry
- EncryptedOrderBook/AMM: private trading logic
- Oracle/Resolver: outcome submission & validation

---

## Features

- 🔐 Encrypted orders & positions
- 📈 Market creation (sports, finance, events, governance)
- 🧮 Private AMM / orderbook aggregation
- 🧾 Verifiable resolution & payouts
- 🧰 SDK for client‑side FHE integrations

---

## Security & Best Practices

- No plaintext trading data on-chain
- Independent audits recommended for circuits and contracts
- Rotate FHE keys per market; minimize metadata
- Benchmark gas impact of FHE ops on target networks

---

## Roadmap

- v1: Core private markets, settlement, SDK
- v1.1: Encrypted LP positions, fee rebates
- v1.2: Cross‑market analytics (privacy‑preserving)
- v2: Mobile UI, cross‑chain, decentralized oracle sets

---

## Contributing

PRs welcome: performance, security, oracle design, UX. Please open issues for proposals.

---

## Resources

- Zama: https://www.zama.ai
- FHEVM Docs: https://docs.zama.ai/fhevm
- Sepolia Explorer: https://sepolia.etherscan.io

---

## License

MIT — see LICENSE.

Built with Zama FHEVM — private intent, fair settlement, public verification.
