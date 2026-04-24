'use client';
import { useMemo } from 'react';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { PhantomWalletAdapter } from '@solana/wallet-adapter-phantom';
import { SolflareWalletAdapter } from '@solana/wallet-adapter-solflare';
import '@solana/wallet-adapter-react-ui/styles.css';

const HELIUS_API_KEY = '78198a01-1c06-4950-aa53-12920224316d';
const SOLANA_RPC = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;

export function SolanaProvider({ children }: { children: React.ReactNode }) {
  const wallets = useMemo(() => [
    new PhantomWalletAdapter(),
    new SolflareWalletAdapter(),
  ], []);

  // Cast to any to avoid React version type conflicts with Solana adapter
  const Conn = ConnectionProvider as any;
  const WalletProv = WalletProvider as any;
  const WalletModal = WalletModalProvider as any;

  return (
    <Conn endpoint={SOLANA_RPC}>
      <WalletProv wallets={wallets} autoConnect>
        <WalletModal>
          {children}
        </WalletModal>
      </WalletProv>
    </Conn>
  );
}
