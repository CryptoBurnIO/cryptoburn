# 🔥 CryptoBurn

> Permanently destroy unwanted tokens and NFTs across 8 chains. Non-custodial. Open source. Free.

**Live site:** [cryptoburn.xyz](https://cryptoburn.xyz) *(deploy to Vercel)* 


---

## 🚀 Quick Start (5 minutes)

### 1. Clone & Install

```bash
git clone https://github.com/your-org/cryptoburn.git
cd cryptoburn
npm install
```

### 2. Get Your Free API Keys

You need **2 free API keys**:

| Service | Purpose | Get it |
|---|---|---|
| **WalletConnect** | Wallet connection (MetaMask, Phantom, etc.) | [cloud.walletconnect.com](https://cloud.walletconnect.com) |
| **Moralis** | Scan wallet for tokens + NFTs | [moralis.io](https://moralis.io) |

### 3. Configure Environment

```bash
cp .env.example .env.local
```

Edit `.env.local`:
```
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_wc_project_id
NEXT_PUBLIC_MORALIS_API_KEY=your_moralis_key
```

### 4. Run Locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### 5. Deploy to Vercel

```bash
npx vercel
```

Add your env vars in Vercel dashboard → Settings → Environment Variables.

---

## ⛓️ Supported Chains

| Chain | Burn Address | Type |
|---|---|---|
| Ethereum | `0x000...dEaD` | EVM |
| Base | `0x000...dEaD` | EVM |
| Polygon | `0x000...dEaD` | EVM |
| BNB Chain | `0x000...dEaD` | EVM |
| Arbitrum | `0x000...dEaD` | EVM |
| Optimism | `0x000...dEaD` | EVM |
| Avalanche | `0x000...dEaD` | EVM |
| Solana | `1nc1nerator...` | SPL |

---

## 🔒 Security Architecture

**Why this site can't scam you:**

1. **No token approvals** — Burns are direct transfers, not contract interactions requiring approve()
2. **Hardcoded burn addresses** — Never dynamic, never user-controlled, never changeable
3. **Non-custodial** — WalletConnect/RainbowKit, your keys never leave your device
4. **Open source** — Every line of code is publicly auditable
5. **Typed confirmation** — User must type "BURN" before any transaction fires
6. **On-chain proof** — Every burn links to block explorer

---

## 🏗️ Tech Stack

- **Frontend**: Next.js 14 + TypeScript + Tailwind CSS
- **EVM Wallet**: RainbowKit + Wagmi + Viem
- **Solana Wallet**: @solana/wallet-adapter
- **Asset Scanning**: Moralis API
- **Hosting**: Vercel (free tier works)

---

## 📁 Project Structure

```
src/
├── app/
│   ├── page.tsx          # Homepage + hero
│   ├── layout.tsx        # Fonts, metadata, providers
│   └── globals.css       # Global styles
├── components/
│   ├── Providers.tsx     # WagmiProvider + RainbowKit
│   ├── BurnInterface.tsx # Main burn UI
│   ├── ChainSelector.tsx # Chain switcher
│   ├── AssetRow.tsx      # Individual asset item
│   ├── BurnModal.tsx     # Confirmation modal
│   └── BurnReceipt.tsx   # Success/failure receipt
├── hooks/
│   └── useEvmAssets.ts   # Fetch wallet assets via Moralis
└── lib/
    ├── chains.ts          # Chain config + burn addresses
    ├── wagmi.ts           # Wagmi + RainbowKit config
    ├── burnEvm.ts         # ERC-20, ERC-721, ERC-1155 burn logic
    └── burnSolana.ts      # SPL token + NFT burn logic
```

---

## 🛣️ Roadmap

- [x] Phase 1 — EVM burn (ETH, Base, Polygon, BNB, Arbitrum, Optimism, Avalanche)
- [x] Phase 1 — Solana SPL burn
- [x] Phase 1 — Non-custodial wallet connect
- [x] Phase 1 — Typed confirmation gate
- [x] Phase 1 — On-chain receipt
- [ ] Phase 2 — Solana NFT (Metaplex) full support
- [ ] Phase 2 — Batch multi-asset burns in one tx
- [ ] Phase 2 — Burn leaderboard
- [ ] Phase 3 — Auto social posting on burn

---

## 📜 License

MIT — free to use, fork, and build on.
