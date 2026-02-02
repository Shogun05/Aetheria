import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import ArtworkCard from '../components/ArtworkCard';
import { marketplaceGet } from '../lib/api';
import { fadeInUp, staggerContainer } from '../lib/animations';

type Listing = {
    listing_id: number;
    price_start: string; // BigInt serialized as string
    seller_wallet: string;
    created_at: string;
    status: string;
    artworks: {
        id: number;
        title: string;
        image_url: string;
        vote_count: number;
        creator_wallet: string;
        minted: boolean;
        token_id: number;
    };
};

export default function Marketplace() {
    const navigate = useNavigate();

    const { data: listings, isLoading, error } = useQuery({
        queryKey: ['marketplace-listings'],
        queryFn: async () => {
            return marketplaceGet<Listing[]>('/listings');
        },
        refetchInterval: 10000,
    });

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="text-center">
                    <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-highlight mb-4"></div>
                    <p className="text-gray-400">Loading marketplace...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="text-center text-red-400">
                    <p>Failed to load listings.</p>
                    <button onClick={() => window.location.reload()} className="mt-4 px-4 py-2 bg-white/10 rounded-lg hover:bg-white/20">Retry</button>
                </div>
            </div>
        )
    }

    if (!listings || listings.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
                <h2 className="text-2xl font-bold mb-2">Marketplace is Empty</h2>
                <p className="text-gray-400 mb-6">No items are currently listed for sale.</p>
                <button
                    onClick={() => navigate('/gallery')}
                    className="px-6 py-3 bg-accent text-black font-bold rounded-xl hover:bg-highlight transition-all"
                >
                    Explore Gallery
                </button>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto">
            <div className="flex justify-between items-end mb-8">
                <div>
                    <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-highlight to-accent bg-clip-text text-transparent">
                        Marketplace
                    </h1>
                    <p className="text-gray-400">Collect exclusive digital artifacts.</p>
                </div>
                <div className="text-sm text-gray-500">
                    {listings.length} items listed
                </div>
            </div>

            <motion.div
                variants={staggerContainer}
                initial="hidden"
                animate="visible"
                className="grid gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4"
            >
                {listings.map((listing) => (
                    <ArtworkCard
                        key={listing.listing_id}
                        id={listing.artworks.id}
                        title={listing.artworks.title}
                        imageUrl={listing.artworks.image_url}
                        votes={listing.artworks.vote_count}
                        creatorWallet={listing.artworks.creator_wallet}
                        minted={true} // If it's listed, it must be minted
                        tokenId={listing.artworks.token_id}
                        onOpen={(id) => navigate(`/art/${id}`)}
                    // We pass a custom subtitle or badge for price here if ArtworkCard supported it,
                    // but for now the card shows standard info. Detailed price is on the detail page.
                    />
                ))}
            </motion.div>
        </div>
    );
}
