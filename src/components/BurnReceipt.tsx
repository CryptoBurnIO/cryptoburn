'use client';
import { useState } from 'react';

interface BurnReceiptProps {
  results: Array<{
    assetName: string;
    txHash: string;
    explorerUrl: string;
    success: boolean;
    error?: string;
  }>;
  onDone: () => void;
}

function isUserCancelled(error?: string): boolean {
  if (!error) return false;
  const lower = error.toLowerCase();
  return (
    lower.includes('user rejected') ||
    lower.includes('user denied') ||
    lower.includes('rejected the request') ||
    lower.includes('cancelled')
  );
}

function isContractRevert(error?: string): boolean {
  if (!error) return false;
  if (isUserCancelled(error)) return false;
  const lower = error.toLowerCase();
  return (
    lower.includes('revert') ||
    lower.includes('execution reverted') ||
    lower.includes('transaction failed') ||
    lower.includes('always failing') ||
    lower.includes('cannot estimate') ||
    lower.includes('gas required exceeds')
  );
}

function friendlyError(error?: string): string {
  if (!error) return 'Unknown error';
  if (isUserCancelled(error)) return 'You cancelled this transaction.';
  if (isContractRevert(error)) return "This asset's smart contract does not allow transfers or burning. Unsolicited or scam assets are often designed this way. This is caused by the asset itself — not by this site or your wallet.";
  // Truncate long technical errors
  const clean = error.split('Request Arguments')[0].split('Contract Call')[0].trim();
  return clean.length > 120 ? clean.slice(0, 120) + '...' : clean;
}

export function BurnReceipt({ results, onDone }: BurnReceiptProps) {
  const [showFaq, setShowFaq] = useState(false);
  const successful = results.filter((r) => r.success);
  const failed = results.filter((r) => !r.success);
  const userCancelled = failed.every((r) => isUserCancelled(r.error));
  const hasContractFailures = failed.some((r) => isContractRevert(r.error));

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-gray-900 border border-green-600/50 rounded-sm max-w-lg w-full p-6 my-auto">

        <div className="text-4xl text-center mb-3">
          {failed.length === 0 ? '✅' : successful.length === 0 ? (userCancelled ? '↩️' : '❌') : '⚠️'}
        </div>

        <h2 className="font-bebas text-3xl tracking-widest text-center mb-2" style={{
          color: failed.length === 0 ? '#00e676' : successful.length === 0 ? (userCancelled ? '#aaaaaa' : '#ff4444') : '#ff8800'
        }}>
          {failed.length === 0 ? 'BURNED TO ASHES' : successful.length === 0 ? (userCancelled ? 'CANCELLED' : 'BURN FAILED') : 'PARTIAL BURN'}
        </h2>

        <p className="text-gray-400 text-sm text-center mb-4">
          {successful.length > 0 && `${successful.length} asset${successful.length !== 1 ? 's' : ''} permanently destroyed. `}
          {failed.length > 0 && !userCancelled && `${failed.length} could not be burned.`}
          {userCancelled && failed.length > 0 && 'Transaction cancelled — nothing was burned.'}
        </p>

        {/* Scrollable results */}
        <div className="space-y-2 mb-4 overflow-y-auto" style={{maxHeight: "280px"}}>

          {successful.map((r) => (
            <div key={r.txHash} className="bg-gray-950 border border-gray-800 rounded-sm p-3">
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm text-white truncate mr-2">{r.assetName}</span>
                <span className="text-xs text-green-400 font-mono flex-shrink-0">BURNED ✓</span>
              </div>
              <a href={r.explorerUrl} target="_blank" rel="noopener noreferrer"
                className="text-xs font-mono text-orange-400 hover:text-orange-300 break-all">
                {r.txHash.slice(0, 20)}...{r.txHash.slice(-8)} ↗
              </a>
            </div>
          ))}

          {failed.map((r, i) => (
            <div key={i} className={`rounded-sm p-3 ${isUserCancelled(r.error) ? 'bg-gray-950 border border-gray-700' : 'bg-red-950/20 border border-red-900/40'}`}>
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm text-white truncate mr-2">{r.assetName}</span>
                <span className={`text-xs font-mono flex-shrink-0 ${isUserCancelled(r.error) ? 'text-gray-400' : 'text-red-400'}`}>
                  {isUserCancelled(r.error) ? 'CANCELLED' : 'NOT BURNABLE ✗'}
                </span>
              </div>
              {!isUserCancelled(r.error) && (
                <p className="text-xs text-orange-400/80 font-mono mb-1">
                  Contract rejected the transaction (not burnable)
                </p>
              )}
              <p className="text-xs text-gray-500 leading-relaxed">
                {friendlyError(r.error)}
              </p>
            </div>
          ))}

        </div>

        {/* Contextual notice */}
        {failed.length > 0 && !userCancelled && (
          <div className="bg-gray-950 border border-gray-800 rounded-sm p-3 mb-4">
            <p className="text-xs text-green-400 font-mono mb-1">✓ Your wallet is safe</p>
            <p className="text-xs text-gray-500 leading-relaxed">
              No funds were lost beyond the service fee. Non-burnable assets can be hidden in your wallet interface instead.
            </p>
          </div>
        )}

        {userCancelled && failed.length > 0 && !successful.length && (
          <div className="bg-gray-950 border border-gray-800 rounded-sm p-3 mb-4">
            <p className="text-xs text-gray-400 leading-relaxed">
              You cancelled before any burns completed. No fee was charged and no assets were burned.
            </p>
          </div>
        )}

        {/* FAQ toggle — only for contract failures */}
        {hasContractFailures && (
          <div className="mb-4">
            <button onClick={() => setShowFaq(!showFaq)}
              className="font-mono text-xs text-orange-400 hover:text-orange-300 transition-colors">
              {showFaq ? '▲ Hide' : '▼ Why did my burn fail?'}
            </button>
            {showFaq && (
              <div className="mt-2 bg-gray-950 border border-gray-800 rounded-sm p-3">
                <p className="text-xs text-gray-400 leading-relaxed">
                  Some tokens and NFTs — especially unsolicited or scam assets — are intentionally
                  created to be non-transferable and non-burnable. When this happens, the blockchain
                  rejects the transaction automatically via the asset's own smart contract logic.
                  <br /><br />
                  This is not a failure of CryptoBurn, MetaMask, or your wallet. The asset itself
                  blocks the action at the contract level. These assets can simply be ignored or
                  hidden in your wallet interface.
                </p>
              </div>
            )}
          </div>
        )}

        {successful.length > 0 && (
          <p className="text-xs font-mono text-gray-600 text-center mb-4">
            On-chain proof is permanent and publicly verifiable forever.
          </p>
        )}

        <button onClick={onDone}
          className="w-full bg-gradient-to-r from-orange-600 to-orange-500 text-black py-3 font-bebas text-xl tracking-widest rounded-sm hover:opacity-90 transition-all">
          DONE
        </button>

      </div>
    </div>
  );
}
