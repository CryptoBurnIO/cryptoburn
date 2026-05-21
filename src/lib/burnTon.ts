// lib/burnTon.ts
// Burns TON Jettons (tokens) and NFTs using TON Connect

import { toNano, Address, beginCell } from '@ton/ton';
import { FEE_RECIPIENT_TON } from './fees';

// TON burn address (zero address) - must be in friendly bounceable format
const TON_BURN_ADDRESS = 'EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c';
const TON_NULL_ADDRESS = 'UQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAJKZ';

// TON/USD approximate rate
const TON_RATE_USD = 5;

export interface TonBurnResult {
  success: boolean;
  txHash?: string;
  explorerUrl?: string;
  error?: string;
}

export interface TonAsset {
  id: string;
  name: string;
  symbol: string;
  type: 'token' | 'nft';
  balance: string;
  contractAddress: string;
  decimals: number;
}

/**
 * Send service fee in TON to CryptoBurn wallet
 */
function buildFeeTransaction(feeUsd: number) {
  const feeInTon = feeUsd / TON_RATE_USD;
  return {
    address: Address.parse(FEE_RECIPIENT_TON).toString(),
    amount: toNano(Math.max(feeInTon, 0.001).toFixed(9)).toString(),
    payload: beginCell()
      .storeUint(0, 32)
      .storeStringTail('CryptoBurn service fee')
      .endCell()
      .toBoc()
      .toString('base64'),
  };
}

/**
 * Build Jetton transfer transaction (burns by sending to zero address)
 */
function buildJettonBurnTransaction(jettonWalletAddress: string, amount: bigint) {
  // Jetton transfer op code
  const payload = beginCell()
    .storeUint(0x0f8a7ea5, 32) // transfer op
    .storeUint(0, 64)           // query_id
    .storeCoins(amount)          // amount
    .storeAddress(Address.parse(TON_NULL_ADDRESS)) // destination (burn)
    .storeAddress(Address.parse(TON_NULL_ADDRESS)) // response_destination
    .storeBit(0)                 // no custom payload
    .storeCoins(toNano('0.001')) // forward_ton_amount
    .storeBit(0)                 // no forward payload
    .endCell()
    .toBoc()
    .toString('base64');

  return {
    address: Address.parse(jettonWalletAddress).toString(),
    amount: toNano('0.05').toString(), // gas for transfer
    payload,
  };
}

/**
 * Build NFT transfer transaction (burns by sending to zero address)
 */
function buildNFTBurnTransaction(nftAddress: string) {
  const payload = beginCell()
    .storeUint(0x5fcc3d14, 32) // transfer op
    .storeUint(0, 64)           // query_id
    .storeAddress(Address.parse(TON_NULL_ADDRESS)) // new owner (burn address)
    .storeAddress(Address.parse(TON_NULL_ADDRESS)) // response destination
    .storeBit(0)                 // no custom payload
    .storeCoins(toNano('0.001')) // forward amount
    .storeBit(0)                 // no forward payload
    .endCell()
    .toBoc()
    .toString('base64');

  return {
    address: Address.parse(nftAddress).toString(),
    amount: toNano('0.05').toString(), // gas for transfer
    payload,
  };
}

/**
 * Build a batch burn transaction for TON assets
 * Returns array of messages to send via TON Connect
 */
export function buildTonBurnMessages(
  assets: TonAsset[],
  feeUsd: number
): Array<{ address: string; amount: string; payload?: string }> {
  const messages = [];

  // Service fee first
  if (feeUsd > 0) {
    messages.push(buildFeeTransaction(feeUsd));
  }

  // Burn each asset
  for (const asset of assets) {
    if (asset.type === 'nft') {
      messages.push(buildNFTBurnTransaction(asset.contractAddress));
    } else {
      // For Jettons we need the jetton wallet address
      messages.push(buildJettonBurnTransaction(asset.contractAddress, BigInt(asset.balance)));
    }
  }

  return messages;
}
