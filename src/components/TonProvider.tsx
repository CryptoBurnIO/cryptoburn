'use client';
import { TonConnectUIProvider } from '@tonconnect/ui-react';

// Manifest URL tells TON wallets about your app
const MANIFEST_URL = 'https://www.cryptoburn.io/tonconnect-manifest.json';

export function TonProvider({ children }: { children: React.ReactNode }) {
  return (
    <TonConnectUIProvider manifestUrl={MANIFEST_URL}>
      {children}
    </TonConnectUIProvider>
  );
}
