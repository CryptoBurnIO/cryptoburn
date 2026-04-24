import { BurnInterface } from '@/components/BurnInterface';
import Link from 'next/link';

// Fire particle component (server-rendered positions, animated via CSS)
function FireParticles() {
  const particles = Array.from({ length: 30 }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: Math.random() * 4,
    duration: Math.random() * 3 + 2,
    size: Math.random() * 10 + 4,
  }));

  return (
    <div className="fixed bottom-0 left-0 right-0 h-64 pointer-events-none z-0 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-t from-orange-950/20 to-transparent" />
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute bottom-0 rounded-full opacity-0"
          style={{
            left: `${p.left}%`,
            width: `${p.size}px`,
            height: `${p.size * 1.5}px`,
            background: ['#ff4400', '#ff6600', '#ff8800', '#ffaa00'][Math.floor(Math.random() * 4)],
            animation: `rise ${p.duration}s ${p.delay}s linear infinite`,
            filter: 'blur(1px)',
          }}
        />
      ))}
    </div>
  );
}

export default function Home() {
  return (
    <main className="min-h-screen relative">
      <FireParticles />

      {/* NAV */}
      <nav className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-8 py-5 bg-gradient-to-b from-gray-950/90 to-transparent backdrop-blur-sm">
        <div className="font-bebas text-2xl tracking-widest text-fire">
          Crypto<span className="text-orange-500">Burn</span>
        </div>
        <div className="flex items-center gap-8">
          <Link href="#burn" className="font-mono text-xs text-gray-400 hover:text-orange-400 transition-colors tracking-widest uppercase">
            Burn
          </Link>
          <Link href="#safety" className="font-mono text-xs text-gray-400 hover:text-orange-400 transition-colors tracking-widest uppercase">
            Security
          </Link>
          <Link href="#faq" className="font-mono text-xs text-gray-400 hover:text-orange-400 transition-colors tracking-widest uppercase">
            FAQ
          </Link>
          <a
            href="https://github.com/CryptoBurnIO/cryptoburn"
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-xs text-gray-400 hover:text-orange-400 transition-colors tracking-widest uppercase"
          >
            GitHub
          </a>
        </div>
      </nav>

      {/* HERO */}
      <section className="relative z-10 min-h-screen flex flex-col items-center justify-center text-center px-4 pt-20 pb-16">
        <p className="font-mono text-xs text-orange-400 tracking-widest uppercase mb-6 animate-pulse">
          ✦ Non-Custodial · Open Source · On-Chain Verified ✦
        </p>

        <h1 className="font-bebas leading-none tracking-wider mb-6" style={{ fontSize: 'clamp(5rem, 18vw, 14rem)' }}>
          BURN
          <span className="block text-fire">WHAT YOU</span>
          DON'T NEED
        </h1>

        <p className="text-gray-400 max-w-lg text-lg leading-relaxed mb-10">
          Permanently destroy unwanted tokens and NFTs across 21 chains.
          Non-custodial. Open source. Low service fee per burn — tokens from $0.10, NFTs from $0.25.
        </p>

        <div className="flex flex-wrap gap-4 justify-center">
          <Link
            href="#burn"
            className="bg-gradient-to-r from-orange-600 to-orange-500 text-black px-10 py-4 font-bebas text-xl tracking-widest rounded-sm hover:opacity-90 hover:shadow-fire transition-all hover:-translate-y-0.5"
          >
            🔥 Start Burning
          </Link>
          <a
            href="#how"
            className="border border-gray-700 text-gray-300 px-10 py-4 font-bebas text-xl tracking-widest rounded-sm hover:border-gray-400 transition-all"
          >
            How It Works
          </a>
        </div>
      </section>

      {/* TRUST STRIP */}
      <div className="relative z-10 bg-gray-900/80 border-y border-gray-800 py-4">
        <div className="flex flex-wrap justify-center gap-8 px-4">
          {[
            'We never hold your keys',
            'Zero token approvals',
            'Verified burn addresses only',
            'Open source code',
            'Tokens $0.10 · NFTs from $0.25',
          ].map((text) => (
            <div key={text} className="flex items-center gap-2 font-mono text-xs text-gray-400">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 shadow-[0_0_6px_#00e676]" />
              {text}
            </div>
          ))}
        </div>
      </div>

      {/* BURN INTERFACE */}
      <section id="burn" className="relative z-10 py-16">
        <div className="text-center mb-10 px-4">
          <p className="font-mono text-xs text-orange-400 tracking-widest uppercase mb-3">Interface</p>
          <h2 className="font-bebas text-5xl tracking-widest">CONNECT & BURN</h2>
        </div>
        <BurnInterface />
      </section>

      {/* HOW IT WORKS */}
      <section id="how" className="relative z-10 py-20 px-4 max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <p className="font-mono text-xs text-orange-400 tracking-widest uppercase mb-3">Process</p>
          <h2 className="font-bebas text-5xl tracking-widest">THREE STEPS TO THE VOID</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-px bg-gray-800">
          {[
            { num: '01', icon: '🔗', title: 'Connect Wallet', desc: 'Use MetaMask, Phantom, WalletConnect or 100+ other wallets. Your keys never leave your device.' },
            { num: '02', icon: '🎯', title: 'Select Assets', desc: 'We scan your wallet and show all tokens and NFTs. Pick one, pick many — your choice.' },
            { num: '03', icon: '🔥', title: 'Burn It', desc: 'Confirm with a typed "BURN" gate. Assets sent to the verified null address. Permanently gone.' },
            { num: '04', icon: '📜', title: 'Get Proof', desc: 'Receive a transaction hash. On-chain proof of your burn, publicly verifiable forever on the explorer.' },
          ].map((step) => (
            <div key={step.num} className="bg-gray-900 p-8 hover:bg-gray-900/80 transition-colors">
              <span className="font-bebas text-7xl text-orange-900/40 block leading-none mb-4">{step.num}</span>
              <span className="text-3xl block mb-4">{step.icon}</span>
              <h3 className="font-bebas text-xl tracking-widest mb-3 text-white">{step.title}</h3>
              <p className="text-gray-500 text-sm leading-relaxed">{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* SECURITY */}
      <section id="safety" className="relative z-10 py-20 px-4 max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <p className="font-mono text-xs text-orange-400 tracking-widest uppercase mb-3">Security First</p>
          <h2 className="font-bebas text-5xl tracking-widest">BUILT TO NEVER SCAM YOU</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            { icon: '🔒', title: 'Non-Custodial', desc: 'Your private keys never leave your wallet. We use WalletConnect and RainbowKit — the same standard used by Uniswap.' },
            { icon: '🚫', title: 'Zero Approvals', desc: 'We never ask for token approvals or allowances. Every burn is a direct transfer. No contract can drain your wallet.' },
            { icon: '📖', title: 'Open Source', desc: 'The entire codebase is public on GitHub. Anyone can inspect, fork, or audit every line. Nothing hidden.' },
            { icon: '✅', title: 'Verified Addresses', desc: 'Only hardcoded, verified burn addresses per chain. You can cross-check every address against official docs.' },
            { icon: '🛡️', title: 'Confirmation Gate', desc: 'Every burn requires you to type "BURN" to confirm. No accidental burns. No tricks. Clear disclosure of what is happening.' },
            { icon: '🔍', title: 'On-Chain Proof', desc: 'Every burn produces a tx hash. Verify it on Etherscan, Solscan, or any block explorer. Full transparency, always.' },
          ].map((card) => (
            <div key={card.title} className="bg-gray-900 border-l-2 border-green-500 p-6 hover:bg-gray-900/80 transition-colors">
              <span className="text-2xl block mb-3">{card.icon}</span>
              <h3 className="font-bebas text-lg tracking-widest mb-2">{card.title}</h3>
              <p className="text-gray-500 text-sm leading-relaxed">{card.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="relative z-10 py-20 px-4 max-w-3xl mx-auto">
        <div className="text-center mb-12">
          <p className="font-mono text-xs text-orange-400 tracking-widest uppercase mb-3">Help</p>
          <h2 className="font-bebas text-5xl tracking-widest">FREQUENTLY ASKED QUESTIONS</h2>
        </div>
        <div className="space-y-3">
          {[
            {
              q: 'Why should I burn tokens or NFTs?',
              a: 'Unwanted tokens and NFTs clutter your wallet, can cause confusion, and in some cases spam NFTs are designed to trick you. Burning them permanently removes them from your wallet and from circulation — cleaning up your holdings and reducing on-chain noise.',
            },
            {
              q: 'Is it safe to use CryptoBurn?',
              a: 'Yes. CryptoBurn never holds your private keys, never asks for token approvals, and only ever sends assets to a verified hardcoded burn address. Every burn is a direct transfer from your wallet — no smart contract can drain your funds. The code is fully open source and auditable by anyone.',
            },
            {
              q: 'How much does it cost?',
              a: 'CryptoBurn charges a small service fee: $0.10 for token burns and from $0.25 flat for NFTs regardless of quantity (capped at $1.00 for 21+ NFTs). You also pay the blockchain\'s network gas fee which varies by chain. There are no hidden costs.',
            },
            {
              q: 'Why did my burn transaction fail?',
              a: 'Some tokens and NFTs — especially unsolicited or scam assets — are intentionally created to be non-transferable and non-burnable. Their smart contract rejects the transaction automatically. This is caused by the asset itself, not by CryptoBurn or your wallet. No funds are lost beyond the service fee for the attempt. These assets can simply be ignored or hidden in your wallet interface.',
            },
            {
              q: 'Which chains are supported?',
              a: 'CryptoBurn supports 21 EVM chains including Ethereum, BNB Chain, Polygon, Base, Arbitrum, Optimism, Avalanche, zkSync, Linea, Scroll, Fantom, and more. Solana and TON support are coming in Stage 2.',
            },
            {
              q: 'Are burns reversible?',
              a: 'No — burns are permanent and irreversible. Assets are sent to the verified null address (0x000...dEaD) which no one controls. Once burned, they are gone forever from the blockchain. Always double-check what you are burning before confirming.',
            },
            {
              q: 'Do I need to approve CryptoBurn to access my wallet?',
              a: 'No token approvals are ever requested. Each burn is a direct transfer initiated by you from your wallet. CryptoBurn never has any standing permission to move your assets — every transaction requires your explicit confirmation in MetaMask or your chosen wallet.',
            },
            {
              q: 'What happens to the service fee if a burn fails?',
              a: 'The service fee is collected once upfront for the whole batch before burns begin. If an individual asset fails due to a contract restriction, the fee is not refunded as the attempt was made. If you cancel the fee transaction yourself, no burns happen and no fee is charged.',
            },
          ].map((item, i) => (
            <details key={i} className="bg-gray-900 border border-gray-800 rounded-sm group">
              <summary className="px-6 py-4 cursor-pointer font-bebas text-lg tracking-widest text-gray-300 hover:text-white list-none flex justify-between items-center">
                {item.q}
                <span className="text-orange-400 text-xl group-open:rotate-45 transition-transform duration-200">+</span>
              </summary>
              <div className="px-6 pb-4">
                <p className="text-gray-500 text-sm leading-relaxed">{item.a}</p>
              </div>
            </details>
          ))}
        </div>
      </section>

      {/* FOOTER */}
      <footer className="relative z-10 border-t border-gray-800 py-10 px-8 flex flex-wrap items-center justify-between gap-6 bg-black/50">
        <div className="font-bebas text-xl tracking-widest text-fire">CryptoBurn</div>
        <p className="font-mono text-xs text-gray-600 max-w-sm leading-relaxed">
          Open-source burn tool. Low service fees — tokens $0.10, NFTs from $0.25 flat. You also pay network gas.{' '}
          Burns are irreversible. Always double-check before confirming.
        </p>
        <div className="font-mono text-xs text-gray-600">
          Built for the community.<br />Transparent fees. No hidden costs.
        </div>
      </footer>
    </main>
  );
}
