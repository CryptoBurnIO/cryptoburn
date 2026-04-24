import type { Metadata } from 'next';
import { Bebas_Neue, Space_Mono, DM_Sans } from 'next/font/google';
import { Providers } from '@/components/Providers';
import './globals.css';

const bebasNeue = Bebas_Neue({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-bebas',
});

const spaceMono = Space_Mono({
  weight: ['400', '700'],
  subsets: ['latin'],
  variable: '--font-mono',
});

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
});

export const metadata: Metadata = {
  title: 'CryptoBurn — Burn What You Don\'t Need',
  description: 'Permanently destroy unwanted tokens and NFTs across Ethereum, Base, Polygon, BNB, Arbitrum, Optimism, Avalanche and Solana. Non-custodial. Open source. Free.',
  keywords: 'burn crypto, burn nft, burn tokens, ethereum burn, solana burn, crypto cleaner',
  openGraph: {
    title: 'CryptoBurn',
    description: 'Burn unwanted tokens and NFTs with one click',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${bebasNeue.variable} ${spaceMono.variable} ${dmSans.variable}`}>
      <head>
        <script async src="https://www.googletagmanager.com/gtag/js?id=G-SHLTY152WQ" />
        <script dangerouslySetInnerHTML={{
          __html: `
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-SHLTY152WQ');
          `
        }} />
      </head>
      <body className="bg-gray-950 text-white antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
