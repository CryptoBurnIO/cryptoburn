// lib/fees.ts
// CryptoBurn fee structure
// Fees are collected in the native token of the chain (ETH, BNB, MATIC etc)
// and sent to the owner wallet on every burn transaction

// YOUR wallet address — fees go here
export const FEE_RECIPIENT = '0x4B80D92Cb1e8263f5c6ff81Ec012A99ff49BE0d5' as const;

export const FEE_RECIPIENT_SOLANA = 'E9tPpXUc4avuP42RZ5kk5fJGkiKCXgiTDrpHhcxf9qB7' as const;

// Fee tiers in USD
export const FEE_STRUCTURE = {
  TOKEN: 0.10,        // $0.10 per token burn transaction
  NFT_1_5: 0.25,      // $0.25 flat for 1-5 NFTs
  NFT_6_20: 0.50,     // $0.50 flat for 6-20 NFTs
  NFT_21_PLUS: 1.00,  // $1.00 flat cap for 21+ NFTs
} as const;

export interface FeeBreakdown {
  usdAmount: number;
  description: string;
  tokenCount: number;
  nftCount: number;
  totalUsd: number;
}

/**
 * Calculate the fee for a given set of assets
 */
export function calculateFee(assets: Array<{ type: 'token' | 'nft' }>): FeeBreakdown {
  const tokens = assets.filter((a) => a.type === 'token');
  const nfts = assets.filter((a) => a.type === 'nft');

  // Token fee — $0.10 per transaction (flat, regardless of how many tokens)
  const tokenFee = tokens.length > 0 ? FEE_STRUCTURE.TOKEN : 0;

  // NFT fee — tiered flat rate
  let nftFee = 0;
  if (nfts.length >= 21) {
    nftFee = FEE_STRUCTURE.NFT_21_PLUS;
  } else if (nfts.length >= 6) {
    nftFee = FEE_STRUCTURE.NFT_6_20;
  } else if (nfts.length >= 1) {
    nftFee = FEE_STRUCTURE.NFT_1_5;
  }

  const totalUsd = tokenFee + nftFee;

  // Build human readable description
  const parts = [];
  if (tokens.length > 0) {
    parts.push(`${tokens.length} token${tokens.length > 1 ? 's' : ''} ($${tokenFee.toFixed(2)})`);
  }
  if (nfts.length > 0) {
    parts.push(`${nfts.length} NFT${nfts.length > 1 ? 's' : ''} ($${nftFee.toFixed(2)} flat)`);
  }

  return {
    usdAmount: totalUsd,
    description: parts.join(' + '),
    tokenCount: tokens.length,
    nftCount: nfts.length,
    totalUsd,
  };
}

/**
 * Get a friendly description of the fee structure for display
 */
export function getFeeDescription(assets: Array<{ type: 'token' | 'nft' }>): string {
  const fee = calculateFee(assets);
  if (fee.totalUsd === 0) return 'No fee';
  return `$${fee.totalUsd.toFixed(2)} service fee`;
}
