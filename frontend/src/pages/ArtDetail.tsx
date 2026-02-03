import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { useAccount, useWriteContract, useReadContract, usePublicClient } from 'wagmi';
import { formatEther } from 'ethers';
import { AETHERIA_MARKETPLACE_ABI, AETHERIA_MARKETPLACE_ADDRESS, AETHERIA_NFT_ABI, AETHERIA_NFT_ADDRESS } from '../lib/contracts';
import { votingGet, mintPost, votingPost, marketplaceGet, marketplacePost } from '../lib/api';
import { formatWallet, getLoggedInWallet, isLoggedIn } from '../lib/auth';
import { fadeInUp } from '../lib/animations';
import Comments from '../components/Comments';
import ShareButtons from '../components/ShareButtons';
import ListingModal from '../components/ListingModal';

type Artwork = {
  id: number;
  title: string;
  description: string;
  image_url: string;
  creator_wallet: string;
  vote_count: number;
  minted: boolean;
  token_id?: number;
  tx_hash?: string;
  metadata_hash: string;
  created_at: string;
};

export default function ArtDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [minting, setMinting] = useState(false);
  const qc = useQueryClient();
  const [voteLoading, setVoteLoading] = useState(false);
  const [voteCount, setVoteCount] = useState<number | null>(null);
  const [hasVoted, setHasVoted] = useState(false);
  const [isListingModalOpen, setIsListingModalOpen] = useState(false);
  const [isBuying, setIsBuying] = useState(false);
  const [showAllHistory, setShowAllHistory] = useState(false);

  const creatorWallet = getLoggedInWallet();
  const publicClient = usePublicClient();
  const { data: artwork, isLoading, error } = useQuery({
    queryKey: ['artwork', id],
    queryFn: async () => {
      const response = await votingGet<{ artwork: Artwork }>(`/artwork/${id}`);
      if (!response.artwork) throw new Error('Artwork not found');
      return response.artwork;
    },
    enabled: !!id,
    retry: 1,
    retryDelay: 2000,
    staleTime: 30000,
  });

  // Fetch ALL listings for this artwork (for provenance history)
  // First verify on-chain status to ensure DB is in sync
  const { data: listings = [], refetch: refetchListings } = useQuery({
    queryKey: ['listings', id],
    queryFn: async () => {
      if (!id) return [];
      // First trigger verification to sync DB with on-chain state
      try {
        await marketplaceGet(`/listings/${id}/verify`);
      } catch (e) {
        console.warn('[ArtDetail] Verify endpoint failed, continuing with cached data');
      }
      // Then fetch the (now synced) listings
      return marketplaceGet<any[]>(`/listings/${id}`).catch(() => []);
    },
    enabled: !!id,
    staleTime: 10000 // Cache for 10 seconds to avoid excessive on-chain calls
  });

  // Active listing is the first one with status ACTIVE (most recent)
  const activeListing = listings.find((l: any) => l.status === 'ACTIVE');
  // For backwards compatibility, use activeListing for buy/price logic
  const listing = activeListing;

  // Buy Hooks
  // Safely derive arguments to avoid render crashes
  const listingId = listing?.on_chain_id ? BigInt(listing.on_chain_id) : undefined;

  const { data: currentPriceOnChain } = useReadContract({
    address: AETHERIA_MARKETPLACE_ADDRESS,
    abi: AETHERIA_MARKETPLACE_ABI,
    functionName: 'getCurrentPrice',
    args: listingId !== undefined ? [listingId] : undefined,
    query: {
      enabled: listingId !== undefined,
      refetchInterval: 10000,
    }
  });

  // Owner Check Hook
  const { address: userAddress } = useAccount();
  const { data: onChainOwner } = useReadContract({
    address: AETHERIA_NFT_ADDRESS,
    abi: AETHERIA_NFT_ABI,
    functionName: 'ownerOf',
    args: artwork?.token_id ? [BigInt(artwork.token_id)] : undefined,
    query: {
      enabled: !!artwork?.token_id && artwork.minted,
      refetchInterval: 5000
    }
  });

  // Determine the effective owner:
  // - For minted NFTs: use on-chain ownerOf()
  // - For unminted artworks: creator_wallet is the owner
  const ownerAddress = artwork?.minted && onChainOwner
    ? onChainOwner
    : artwork?.creator_wallet;

  const isOwner = userAddress && ownerAddress && userAddress.toLowerCase() === ownerAddress.toLowerCase();

  // Debug logging for owner badge
  useEffect(() => {
    if (artwork?.minted) {
      console.log('[Owner Debug]', {
        userAddress,
        ownerAddress,
        tokenId: artwork?.token_id,
        minted: artwork?.minted,
        isOwner
      });
    }
  }, [userAddress, ownerAddress, artwork?.token_id, artwork?.minted, isOwner]);

  // Auto-cleanup stale listings when owner is detected
  useEffect(() => {
    const cleanupStaleListing = async () => {
      // Only run if user is owner and there's an active listing from someone else
      if (isOwner && listing && listing.status === 'ACTIVE' && userAddress) {
        // Check if seller is different from current owner
        if (listing.seller_wallet.toLowerCase() !== userAddress.toLowerCase()) {
          console.log('[Auto-Cleanup] Detected stale listing, cleaning up...');
          try {
            await marketplacePost(`/listings/${id}/cleanup`, { ownerWallet: userAddress });
            console.log('[Auto-Cleanup] Stale listing cleaned up successfully');
            refetchListings();
          } catch (err: any) {
            console.error('[Auto-Cleanup] Failed to clean up stale listing:', err.message);
          }
        }
      }
    };

    cleanupStaleListing();
  }, [isOwner, listing, userAddress, id, refetchListings]);

  const currentPriceFormatted = (() => {
    try {
      if (currentPriceOnChain) return formatEther(currentPriceOnChain);
      if (listing && listing.price_start) return formatEther(listing.price_start.toString());
      return '0';
    } catch (e) {
      console.error('Error formatting price:', e);
      return '0';
    }
  })();

  const { writeContractAsync: buyContract } = useWriteContract();

  const handleBuy = async () => {
    if (!listing || !isLoggedIn()) {
      navigate('/login', { state: { from: location.pathname } });
      return;
    }
    setIsBuying(true);
    try {
      const price = currentPriceOnChain || BigInt(listing.price_start);
      console.log('Buying listing:', listing.on_chain_id, 'Price:', price);

      const hash = await buyContract({
        address: AETHERIA_MARKETPLACE_ADDRESS,
        abi: AETHERIA_MARKETPLACE_ABI,
        functionName: 'buy',
        args: [BigInt(listing.on_chain_id)],
        value: price
      });

      window.dispatchEvent(new CustomEvent('aetheria:toast', { detail: `Transaction sent: ${hash.slice(0, 10)}... Waiting for confirmation.` } as any));

      if (publicClient) {
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        if (receipt.status === 'success') {
          window.dispatchEvent(new CustomEvent('aetheria:toast', { detail: 'Purchase Successful! Updating database...' } as any));

          // Directly update the listing to SOLD in the database (don't rely on event watcher)
          try {
            await marketplacePost('/listings/mark-sold', {
              listingId: listing.on_chain_id,
              buyerWallet: userAddress,
              txHash: hash
            });
            console.log('[Purchase] Listing marked as SOLD in database');
          } catch (dbErr: any) {
            console.error('[Purchase] Failed to update DB directly:', dbErr.message);
          }

          // Refresh the page to show updated state
          setTimeout(() => {
            window.location.reload();
          }, 1000);
        } else {
          throw new Error('Transaction reverted');
        }
      }

    } catch (err: any) {
      console.error(err);
      window.dispatchEvent(new CustomEvent('aetheria:toast', { detail: `Purchase failed: ${err.message || 'Unknown error'}` } as any));
      setIsBuying(false);
    }
  };





  useEffect(() => {
    if (!artwork) return;
    setVoteCount(artwork.vote_count);
    if (!creatorWallet) { setHasVoted(false); return; }
    (async () => {
      try {
        const params = new URLSearchParams({
          artwork: String(artwork.id),
          wallet: creatorWallet
        });
        const response = await votingGet<{ hasVoted: boolean }>(`/has-voted?${params.toString()}`);
        setHasVoted(!!response.hasVoted);
      } catch {
        setHasVoted(false);
      }
    })();
  }, [artwork?.id, creatorWallet]);

  const isEligibleForMint = artwork && artwork.vote_count >= 3 && !artwork.minted;
  const canMint = creatorWallet && creatorWallet.toLowerCase() === artwork?.creator_wallet?.toLowerCase();

  const vote = useMutation({
    mutationFn: async () => {
      if (!creatorWallet || creatorWallet === '0x') throw new Error('Please log in or connect your wallet');
      setVoteLoading(true);
      if (!artwork) return;
      const response = await votingPost<{ action: string }>('/vote', { artworkId: artwork.id, voterWallet: creatorWallet });

      setVoteLoading(false);
      return response;
    },
    onError: (error: any) => {
      setVoteLoading(false);
      let msg: string;
      try { msg = error?.message || error?.error || String(error); } catch { msg = 'Unknown voting error'; }

      // If user already voted, update hasVoted state
      if (msg.includes('already voted') || error?.hasVoted) {
        setHasVoted(true);
      }

      window.dispatchEvent(new CustomEvent('aetheria:toast', { detail: `Voting failed: ${msg}` } as any));
    },
    onSuccess: (response) => {
      // Handle both vote addition and removal
      if ((response as any).action === 'added') {

        setHasVoted(true);
        setVoteCount(c => (typeof c === 'number' ? c + 1 : 1));
      } else if ((response as any).action === 'removed') {

        setHasVoted(false);
        setVoteCount(c => Math.max(0, (typeof c === 'number' ? c - 1 : 0)));
      }
      qc.invalidateQueries({ queryKey: ['artwork', id] });

    },
  });

  const handleMint = async () => {
    if (!artwork || !canMint) return;

    setMinting(true);
    try {
      // Note: This requires MINTER_AUTH_TOKEN - for MVP, this could be a user-initiated action
      // For production, backend should handle auth check
      const response = await mintPost<{ success: boolean; tx_hash: string; token_id: number }>('/mint', {
        artworkId: artwork.id
      });

      if (response.success) {
        window.dispatchEvent(new CustomEvent('aetheria:toast', {
          detail: `NFT minted! Token ID: ${response.token_id}`
        } as any));
        // Refresh artwork data
        window.location.reload();
      }
    } catch (error: any) {
      window.dispatchEvent(new CustomEvent('aetheria:toast', {
        detail: `Minting failed: ${error.message || 'Unknown error'}`
      } as any));
    } finally {
      setMinting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-accent mb-4"></div>
          <p className="text-gray-400">Loading artwork...</p>
        </div>
      </div>
    );
  }

  if (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const isConnectionError = errorMessage.toLowerCase().includes('timeout') ||
      errorMessage.toLowerCase().includes('network') ||
      errorMessage.toLowerCase().includes('invalid api url');

    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center max-w-md">
          <p className="text-red-400 text-lg mb-2">Failed to load artwork</p>
          <p className="text-gray-400 text-sm mb-4">{errorMessage}</p>
          {isConnectionError && (
            <div className="bg-white/5 rounded-lg p-4 mb-4 text-left">
              <p className="text-yellow-400 text-sm font-semibold mb-2">Possible issues:</p>
              <ul className="text-gray-400 text-xs space-y-1 list-disc list-inside">
                <li>Voting service is not running</li>
                <li>Check VITE_API_VOTING_BASE environment variable</li>
                <li>Verify service is accessible at the configured URL</li>
              </ul>
            </div>
          )}
          <div className="flex gap-4 justify-center">
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-accent text-black rounded-lg font-medium hover:bg-highlight transition-colors duration-200"
            >
              Retry
            </button>
            <Link
              to="/gallery"
              className="px-4 py-2 bg-white/10 text-white rounded-lg font-medium hover:bg-white/20 transition-colors duration-200"
            >
              Back to Gallery
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!artwork) {
    return (
      <div className="text-center py-20">
        <h1 className="text-2xl font-bold mb-4">Artwork Not Found</h1>
        <Link to="/gallery" className="text-accent hover:underline">
          Return to Gallery
        </Link>
      </div>
    );
  }

  const etherscanUrl = artwork.tx_hash
    ? `https://sepolia.etherscan.io/tx/${artwork.tx_hash}`
    : null;

  return (
    <div className="max-w-6xl mx-auto grid gap-8 md:grid-cols-2">
      {/* Artwork Image */}
      <motion.div
        variants={fadeInUp}
        initial="hidden"
        animate="visible"
        className="relative"
      >
        <img
          src={artwork.image_url}
          alt={artwork.title}
          className="w-full rounded-xl border border-white/10 object-contain bg-card/30"
        />
        {isOwner && (
          <div className="absolute top-4 left-4 z-20">
            <div className="px-4 py-2 bg-gradient-to-r from-purple-500 to-indigo-600 text-white font-bold rounded-full shadow-lg border border-white/20 flex items-center gap-2">
              <span>👑</span>
              <span>You Own This</span>
            </div>
          </div>
        )}
        {(artwork.minted || isEligibleForMint) && (
          <div className="absolute top-4 right-4">
            {artwork.minted && (
              <div className="px-4 py-2 bg-gradient-to-r from-accent to-highlight text-black font-bold rounded-full shadow-lg">
                🪙 Minted NFT
              </div>
            )}
            {isEligibleForMint && (
              <div className="px-4 py-2 bg-highlight text-black font-bold rounded-full shadow-lg mt-2">
                ✅ Eligible for Mint
              </div>
            )}
          </div>
        )}
      </motion.div>

      {/* Artwork Details */}
      <motion.div
        variants={fadeInUp}
        initial="hidden"
        animate="visible"
        className="grid gap-6"
      >
        <div>
          <h1 className="text-4xl font-bold mb-4">{artwork.title}</h1>
          <p className="text-gray-300 leading-relaxed mb-4">{artwork.description}</p>

          {/* Dynamic ownership display */}
          {ownerAddress ? (
            <div className="flex flex-col gap-2 mb-6">
              <div className="flex items-center gap-2 text-gray-400">
                <span>Created by</span>
                <span className="font-mono text-gray-500">
                  {artwork.creator_wallet === '0x' ? 'Anonymous' : formatWallet(artwork.creator_wallet)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-purple-400 font-semibold">
                  {artwork.minted ? 'Current Owner:' : 'Owner (Creator):'}
                </span>
                <span className="font-mono text-accent">
                  {formatWallet(ownerAddress as string)}
                </span>
                {isOwner && (
                  <span className="px-2 py-0.5 bg-gradient-to-r from-purple-500 to-indigo-600 text-white text-xs font-bold rounded-full">
                    👑 You
                  </span>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-gray-400 mb-6">
              <span>by</span>
              <span className="font-mono text-accent">
                {artwork.creator_wallet === '0x' ? 'Anonymous' : formatWallet(artwork.creator_wallet)}
              </span>
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 p-4 bg-card/30 rounded-xl border border-white/10 backdrop-blur-sm">
          <div>
            <div className="text-sm text-gray-400 mb-1">Votes</div>
            <div className="text-2xl font-bold text-accent">{voteCount ?? artwork.vote_count}</div>
          </div>
          <div>
            <div className="text-sm text-gray-400 mb-1">Status</div>
            <div className="text-lg font-semibold">
              {artwork.minted ? (
                <span className="text-highlight">Minted</span>
              ) : artwork.vote_count >= 3 ? (
                <span className="text-accent">Eligible</span>
              ) : (
                <span className="text-gray-400">Pending Review</span>
              )}
            </div>
          </div>
        </div>

        {creatorWallet && (
          <motion.button
            whileTap={{ scale: 0.93 }}
            className="w-full px-4 py-2 mt-4 bg-accent text-black rounded-lg font-bold disabled:opacity-70 disabled:cursor-not-allowed"
            disabled={voteLoading}
            onClick={() => {
              if (!isLoggedIn()) {
                navigate('/login', { state: { from: location.pathname } });
                return;
              }
              vote.mutate();
            }}
          >
            {voteLoading
              ? (hasVoted ? 'Unvoting...' : 'Voting...')
              : (!isLoggedIn())
                ? 'Login to Vote'
                : hasVoted ? 'Unvote' : 'Vote for this Artwork'}
          </motion.button>
        )}

        {/* Mint Button */}
        {isEligibleForMint && canMint && (
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleMint}
            disabled={minting}
            className="w-full px-6 py-4 bg-gradient-to-r from-accent to-highlight text-black font-bold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-[0_0_30px_rgba(124,247,240,0.5)] transition-all"
          >
            {minting ? 'Minting...' : 'Mint as NFT'}
          </motion.button>
        )}

        {/* List for Sale Button (Owner only, if minted and not currently listed active) */}
        {artwork.minted && isOwner && (!listing || listing.status !== 'ACTIVE') && (
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setIsListingModalOpen(true)}
            className="w-full px-6 py-4 mt-2 bg-gradient-to-r from-green-400 to-emerald-500 text-black font-bold rounded-xl hover:shadow-[0_0_30px_rgba(74,222,128,0.5)] transition-all"
          >
            List for Sale
          </motion.button>
        )}

        {/* Buy Button (If listed) */}
        {/* Buy Button (If listed and active and user is NOT the owner) */}
        {listing && listing.status === 'ACTIVE' && !isOwner && (
          <div className="p-4 mt-4 border border-white/10 rounded-xl bg-card/30">
            <div className="text-sm text-gray-400 mb-1">Current Price</div>
            <div className="text-3xl font-bold text-highlight mb-4">
              {currentPriceFormatted} ETH
              {listing.price_start !== listing.price_end && (
                <span className="text-sm text-gray-500 ml-2">(Dutch Auction)</span>
              )}
            </div>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleBuy}
              disabled={isBuying}
              className="w-full px-6 py-3 bg-white text-black font-bold rounded-lg hover:shadow-[0_0_20px_rgba(255,255,255,0.3)] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {isBuying ? 'Processing Purchase...' : 'Buy Now'}
            </motion.button>
          </div>
        )}

        {/* Auto-cleanup indicator (cleanup happens automatically in useEffect) */}
        {listing && listing.status === 'ACTIVE' && isOwner && listing.seller_wallet.toLowerCase() !== userAddress?.toLowerCase() && (
          <div className="p-4 mt-4 border border-blue-500/30 rounded-xl bg-blue-500/10">
            <div className="text-blue-400 font-semibold flex items-center gap-2">
              🔄 Cleaning up stale listing...
            </div>
            <p className="text-sm text-gray-400 mt-2">
              Found an old listing from a previous owner. Automatically updating database...
            </p>
          </div>
        )}

        <ListingModal
          isOpen={isListingModalOpen}
          onClose={() => setIsListingModalOpen(false)}
          artworkId={artwork.id}
          tokenAddress={AETHERIA_NFT_ADDRESS}
          tokenId={artwork.token_id ?? -1}
          onSuccess={() => {
            qc.invalidateQueries({ queryKey: ['listing', id] });

            window.dispatchEvent(new CustomEvent('aetheria:toast', { detail: 'Item listed successfully!' } as any));
          }}
        />

        {/* Share Section */}
        <ShareButtons
          title={artwork.title}
          imageUrl={artwork.image_url}
          artworkId={artwork.id}
        />

        {/* Provenance Timeline */}
        <div className="p-6 bg-card/30 rounded-xl border border-white/10 backdrop-blur-sm">
          <h2 className="text-xl font-bold mb-4">Provenance Timeline</h2>
          <div className="space-y-4 relative">
            {/* Timeline line */}
            <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-accent/20" />
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
              className="flex gap-4 relative z-10"
            >
              <div className="flex flex-col items-center">
                <div className="w-4 h-4 rounded-full bg-accent shadow-lg shadow-accent/50" />
                <div className="w-0.5 h-full bg-accent/30 mt-2" />
              </div>
              <div className="flex-1 pb-6">
                <div className="font-semibold text-accent mb-1 flex items-center gap-2">
                  <span>📤</span>
                  <span>Uploaded</span>
                </div>
                <div className="text-sm text-gray-400">
                  {new Date(artwork.created_at).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </div>
                <div className="text-xs text-gray-500 mt-1 font-mono">
                  Hash: {artwork.metadata_hash.slice(0, 16)}...
                </div>
              </div>
            </motion.div>

            {/* Vote milestones */}
            {artwork.vote_count >= 1 && (
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
                className="flex gap-4 relative z-10"
              >
                <div className="flex flex-col items-center">
                  <div className={`w-4 h-4 rounded-full ${artwork.vote_count >= 3 ? 'bg-highlight shadow-lg shadow-highlight/50' : 'bg-highlight/50'}`} />
                  <div className={`w-0.5 h-full ${artwork.minted ? 'bg-highlight/30' : 'bg-gray-700'} mt-2`} />
                </div>
                <div className="flex-1 pb-6">
                  <div className="font-semibold text-highlight mb-1 flex items-center gap-2">
                    <span>🗳️</span>
                    <span>Community Votes</span>
                  </div>
                  <div className="text-sm text-gray-400">
                    {artwork.vote_count} {artwork.vote_count === 1 ? 'vote' : 'votes'} received
                  </div>
                  {artwork.vote_count >= 1 && artwork.vote_count < 3 && (
                    <div className="text-xs text-highlight mt-1">→ {3 - artwork.vote_count} more needed for mint</div>
                  )}
                  {isEligibleForMint && (
                    <div className="text-xs text-accent mt-1">✓ Eligible for minting (3+ votes)</div>
                  )}
                </div>
              </motion.div>
            )}

            {artwork.minted ? (
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 }}
                className="flex gap-4 relative z-10"
              >
                <div className="flex flex-col items-center">
                  <div className="w-4 h-4 rounded-full bg-gradient-to-r from-accent to-highlight shadow-lg" />
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-gradient bg-gradient-to-r from-accent to-highlight bg-clip-text text-transparent mb-1 flex items-center gap-2">
                    <span>🪙</span>
                    <span>Minted as NFT</span>
                  </div>
                  <div className="text-sm text-gray-400 mb-2">
                    Token ID: #{artwork.token_id}
                  </div>
                  {etherscanUrl && (
                    <a
                      href={etherscanUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-accent hover:underline inline-flex items-center gap-1"
                    >
                      View on Etherscan ↗
                    </a>
                  )}
                </div>
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 }}
                className="flex gap-4 opacity-50 relative z-10"
              >
                <div className="flex flex-col items-center">
                  <div className="w-4 h-4 rounded-full bg-gray-600" />
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-gray-500 mb-1">Not Minted</div>
                  <div className="text-sm text-gray-600">
                    Requires 3+ votes to mint
                  </div>
                </div>
              </motion.div>
            )}

            {/* Marketplace History - All Listings */}
            {listings.length > 0 && (
              <>
                {/* Show first (most recent) listing always */}
                {(() => {
                  // Reverse to show oldest first in timeline order
                  const orderedListings = [...listings].reverse();
                  const visibleListings = showAllHistory ? orderedListings : orderedListings.slice(-2);
                  const hiddenCount = orderedListings.length - 2;

                  return (
                    <>
                      {/* Show More Toggle */}
                      {hiddenCount > 0 && !showAllHistory && (
                        <motion.button
                          onClick={() => setShowAllHistory(true)}
                          className="text-sm text-accent hover:underline mb-4 flex items-center gap-2"
                          whileHover={{ scale: 1.02 }}
                        >
                          <span>📜</span>
                          <span>Show {hiddenCount} earlier transaction{hiddenCount > 1 ? 's' : ''}...</span>
                        </motion.button>
                      )}

                      <AnimatePresence>
                        {visibleListings.map((historyListing: any, index: number) => (
                          <motion.div
                            key={historyListing.listing_id || index}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ delay: 0.1 * index }}
                            className="relative z-10"
                          >
                            {/* Listed Event */}
                            <div className="flex gap-4">
                              <div className="flex flex-col items-center">
                                <div className="w-4 h-4 rounded-full bg-blue-500 shadow-lg" />
                                <div className={`w-0.5 h-full ${historyListing.status === 'SOLD' ? 'bg-green-500/30' : 'bg-gray-700'} mt-2`} />
                              </div>
                              <div className="flex-1 pb-4">
                                <div className="font-semibold text-blue-400 mb-1 flex items-center gap-2">
                                  <span>🏷️</span>
                                  <span>Listed for Sale</span>
                                  {historyListing.status === 'ACTIVE' && (
                                    <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full">Active</span>
                                  )}
                                </div>
                                <div className="text-sm text-gray-400">
                                  {new Date(historyListing.created_at).toLocaleDateString('en-US', {
                                    year: 'numeric', month: 'long', day: 'numeric'
                                  })}
                                </div>
                                <div className="text-xs text-gray-500 mt-1">
                                  Price: {formatEther(historyListing.price_start.toString())} ETH
                                </div>
                                <div className="text-xs text-gray-500 mt-1 font-mono">
                                  Seller: {formatWallet(historyListing.seller_wallet)}
                                </div>
                              </div>
                            </div>

                            {/* Sold Event (if applicable) */}
                            {historyListing.status === 'SOLD' && (
                              <div className="flex gap-4 mt-2">
                                <div className="flex flex-col items-center">
                                  <div className="w-4 h-4 rounded-full bg-green-500 shadow-lg" />
                                  {index < visibleListings.length - 1 && (
                                    <div className="w-0.5 h-full bg-gray-700 mt-2" />
                                  )}
                                </div>
                                <div className="flex-1 pb-4">
                                  <div className="font-semibold text-green-400 mb-1 flex items-center gap-2">
                                    <span>🤝</span>
                                    <span>Sold to Collector</span>
                                  </div>
                                  <div className="text-sm text-gray-400">
                                    Purchased on Marketplace
                                  </div>
                                  {historyListing.buyer_wallet && (
                                    <div className="text-xs text-gray-500 mt-1 font-mono">
                                      Buyer: {formatWallet(historyListing.buyer_wallet)}
                                    </div>
                                  )}
                                  {historyListing.tx_hash && (
                                    <a
                                      href={`https://sepolia.etherscan.io/tx/${historyListing.tx_hash}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-xs text-green-400 hover:underline mt-2 inline-flex items-center gap-1"
                                    >
                                      View on Etherscan ↗
                                    </a>
                                  )}
                                </div>
                              </div>
                            )}
                          </motion.div>
                        ))}
                      </AnimatePresence>

                      {/* Collapse Button */}
                      {showAllHistory && hiddenCount > 0 && (
                        <motion.button
                          onClick={() => setShowAllHistory(false)}
                          className="text-sm text-gray-500 hover:text-accent mb-4 flex items-center gap-2"
                          whileHover={{ scale: 1.02 }}
                        >
                          <span>▲</span>
                          <span>Show less</span>
                        </motion.button>
                      )}
                    </>
                  );
                })()}
              </>
            )}
          </div>
        </div>

        {/* Back Button */}
        <Link
          to="/gallery"
          className="text-center px-4 py-2 text-accent hover:underline block mt-4"
        >
          ← Back to Gallery
        </Link>
      </motion.div>

      {/* Comments Section */}
      <motion.div
        variants={fadeInUp}
        initial="hidden"
        animate="visible"
        transition={{ delay: 0.2 }}
        className="md:col-span-2 mt-8"
      >
        <Comments artworkId={id!} />
      </motion.div>
    </div>
  );
}
