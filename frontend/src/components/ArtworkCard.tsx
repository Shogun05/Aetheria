import { motion } from 'framer-motion';
import { useState } from 'react';
import { formatWallet } from '../lib/auth';
import { useAccount, useReadContract } from 'wagmi';
import { AETHERIA_NFT_ABI, AETHERIA_NFT_ADDRESS } from '../lib/contracts';

type Props = {
  id: string | number;
  title: string;
  imageUrl: string;
  votes: number;
  creatorWallet?: string;
  minted?: boolean;
  tokenId?: number;
  onVote?: (id: string | number) => void;
  onOpen?: (id: string | number) => void;
};

export default function ArtworkCard({ id, title, imageUrl, votes, creatorWallet, minted, tokenId, onVote, onOpen }: Props) {
  const isEligibleForMint = votes >= 3 && !minted;
  const [hasVoted, setHasVoted] = useState(false);

  const { address: userAddress } = useAccount();
  const { data: ownerAddress } = useReadContract({
    address: AETHERIA_NFT_ADDRESS,
    abi: AETHERIA_NFT_ABI,
    functionName: 'ownerOf',
    args: tokenId ? [BigInt(tokenId)] : undefined,
    query: {
      enabled: !!minted && !!tokenId,
      refetchInterval: 10000
    }
  });

  const isOwner = userAddress && ownerAddress && userAddress.toLowerCase() === ownerAddress.toLowerCase();

  const handleVote = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!hasVoted) {
      setHasVoted(true);
      onVote?.(id);
    }
  };

  return (
    <motion.article
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -8, scale: 1.02 }}
      transition={{ duration: 0.3 }}
      className="group relative overflow-hidden rounded-xl border border-white/10 bg-card hover:border-accent/50 cursor-pointer shadow-lg hover:shadow-[0_10px_40px_rgba(124,247,240,0.3)] focus-ring"
      tabIndex={0}
      onClick={() => onOpen?.(id)}
      onKeyDown={(e) => e.key === 'Enter' && onOpen?.(id)}
    >
      {/* Image with overlay effect */}
      <div className="relative overflow-hidden">
        <motion.img
          src={imageUrl}
          alt={title}
          className="h-64 w-full object-cover transition-transform duration-500 group-hover:scale-110"
          loading="lazy"
        />
        {/* Gradient overlay on hover */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

        {/* Accent glow effect */}
        <div className="absolute inset-0 bg-accent/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 mix-blend-overlay" />

        {/* Status Badges */}
        <div className="absolute top-3 right-3 flex flex-col gap-2">
          {minted && (
            <div className="px-3 py-1 bg-gradient-to-r from-accent to-highlight text-black text-xs font-bold rounded-full shadow-lg">
              🪙 Minted
            </div>
          )}
          {isEligibleForMint && (
            <div className="px-3 py-1 bg-highlight text-black text-xs font-bold rounded-full shadow-lg">
              ✅ Eligible
            </div>
          )}
          {isOwner && (
            <div className="px-3 py-1 bg-gradient-to-r from-purple-500 to-indigo-600 text-white text-xs font-bold rounded-full shadow-lg border border-white/20 flex items-center gap-1">
              <span>👑</span> Owned
            </div>
          )}
        </div>
      </div>

      <div className="p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold truncate mr-2 group-hover:text-accent transition-colors duration-200">{title}</h3>
          <motion.button
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-300 ${hasVoted
                ? 'bg-accent/50 text-white border border-accent'
                : 'bg-accent text-black hover:bg-highlight hover:scale-110 hover:shadow-[0_0_20px_rgba(124,247,240,0.5)]'
              }`}
            onClick={handleVote}
            disabled={hasVoted}
            whileTap={{ scale: 0.9 }}
            aria-label={`Vote for ${title}`}
          >
            <motion.span
              animate={hasVoted ? { scale: [1, 1.2, 1] } : {}}
              transition={{ duration: 0.3 }}
            >
              ▲ {votes}
            </motion.span>
          </motion.button>
        </div>
        {creatorWallet && (
          <p className="text-xs text-gray-400 truncate">
            by {creatorWallet === '0x' ? 'Anonymous' : formatWallet(creatorWallet)}
          </p>
        )}
      </div>
    </motion.article>
  );
}

