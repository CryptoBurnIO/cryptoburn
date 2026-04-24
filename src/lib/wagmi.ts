// lib/wagmi.ts
import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import {
  mainnet,
  base,
  polygon,
  bsc,
  arbitrum,
  optimism,
  avalanche,
  zksync,
  linea,
  scroll,
  polygonZkEvm,
  mantle,
  blast,
  fantom,
  cronos,
  gnosis,
  celo,
  metis,
  moonbeam,
  kava,
} from 'wagmi/chains';

export const ALL_EVM_CHAINS = [
  // Tier 1 — Largest
  mainnet,
  bsc,
  polygon,
  avalanche,
  // Tier 2 — ETH L2s
  arbitrum,
  optimism,
  base,
  zksync,
  linea,
  scroll,
  polygonZkEvm,
  mantle,
  blast,
  // Tier 3 — Alt L1s
  fantom,
  cronos,
  gnosis,
  celo,
  metis,
  moonbeam,
  kava,
] as const;

export const wagmiConfig = getDefaultConfig({
  appName: 'CryptoBurn',
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'YOUR_WALLETCONNECT_PROJECT_ID',
  chains: ALL_EVM_CHAINS,
  ssr: true,
});
