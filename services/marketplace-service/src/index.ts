import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const app = express();
const port = process.env.PORT || 4006;

app.use(cors());
app.use(express.json());

// Supabase Setup
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// --- Contract Watcher Setup ---
import { ethers } from 'ethers';

// Helper to handle BigInt serialization for JSON
(BigInt.prototype as any).toJSON = function () { return this.toString(); };

const RPC_URL = process.env.VITE_ALCHEMY_URL || 'https://eth-sepolia.g.alchemy.com/v2/aAXCymUE_AGvFG7TT9dZh'; // Fallback to a known public one if env missing
const MARKETPLACE_ADDRESS = process.env.MARKETPLACE_ADDRESS || '';

const MARKETPLACE_ABI = [
    "event ItemListed(uint256 indexed listingId, address indexed seller, address indexed tokenAddress, uint256 tokenId, uint256 startPrice, uint256 endPrice, uint256 startTime, uint256 duration)",
    "event ItemSold(uint256 indexed listingId, address indexed buyer, address indexed tokenAddress, uint256 tokenId, uint256 price)",
    "event ItemCanceled(uint256 indexed listingId)"
];

const provider = new ethers.JsonRpcProvider(RPC_URL);
const contract = new ethers.Contract(MARKETPLACE_ADDRESS, MARKETPLACE_ABI, provider);

console.log(`Starting Contract Watcher on ${MARKETPLACE_ADDRESS} via ${RPC_URL}`);

// Listen for ItemListed
contract.on('ItemListed', async (listingId, seller, tokenAddress, tokenId, startPrice, endPrice, startTime, duration, event) => {
    console.log(`[Event] ItemListed: #${listingId} Token #${tokenId}`);

    // Check if exists to avoid duplicates
    const { data: existing } = await supabase.from('market_listings').select('listing_id').eq('on_chain_id', listingId.toString()).single();
    if (existing) return;

    // We need artwork_id. We can find it by token_id (assuming 1:1 for now or querying artworks table)
    // For now, let's try to query artworks table by token_id
    // But wait, token_id in artworks table might not be indexed or unique globally if we had multiple contracts.
    // Assuming 1 contract for now.

    const { data: artwork } = await supabase.from('artworks')
        .select('id')
        .eq('token_id', tokenId.toString())
        .limit(1)
        .single();

    if (!artwork) {
        console.error(`[Watcher] Artwork not found for Token ID ${tokenId}`);
        return;
    }

    const startsAtNum = Number(startTime);
    const durationNum = Number(duration);

    const { error } = await supabase.from('market_listings').insert([{
        on_chain_id: listingId.toString(),
        artwork_id: artwork.id,
        seller_wallet: seller,
        price_start: startPrice.toString(),
        price_end: endPrice.toString(),
        starts_at: startsAtNum,
        duration: durationNum,
        status: 'ACTIVE',
        tx_hash: event.log.transactionHash
    }]);

    if (error) console.error('[Watcher] Failed to insert listing:', error);
    else console.log('[Watcher] Listing synced to DB');
});

// Listen for ItemSold
contract.on('ItemSold', async (listingId, buyer, tokenAddress, tokenId, price, event) => {
    console.log(`[Event] ItemSold: #${listingId} sold to ${buyer}`);

    const { error } = await supabase
        .from('market_listings')
        .update({
            status: 'SOLD',
            buyer_wallet: buyer,
            tx_hash: event.log.transactionHash  // Store the sale transaction hash
        })
        .eq('on_chain_id', listingId.toString());

    if (error) console.error('[Watcher] Failed to update sold status:', error);
    else console.log('[Watcher] Marked as SOLD in DB with buyer and tx_hash');

    // Also update artwork owner?
    // Ideally yes, but let's stick to listing status first.
});

// Listen for ItemCanceled
contract.on('ItemCanceled', async (listingId, event) => {
    console.log(`[Event] ItemCanceled: #${listingId}`);

    const { error } = await supabase
        .from('market_listings')
        .update({ status: 'CANCELLED' })
        .eq('on_chain_id', listingId.toString());

    if (error) console.error('[Watcher] Failed to update cancel status:', error);
    else console.log('[Watcher] Marked as CANCELLED in DB');
});


// Health Check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'marketplace-service' });
});

// GET /listings - Get all listings (manual join to avoid FK issues)
app.get('/listings', async (req, res) => {
    // 1. Fetch listings
    const { data: listings, error: listingError } = await supabase
        .from('market_listings')
        .select('*')
        .eq('status', 'ACTIVE')
        .order('created_at', { ascending: false });

    if (listingError) {
        return res.status(500).json({ error: listingError.message });
    }

    if (!listings || listings.length === 0) {
        return res.json([]);
    }

    // 2. Fetch associated artworks
    const artworkIds = listings.map(l => l.artwork_id);
    const { data: artworks, error: artworkError } = await supabase
        .from('artworks')
        .select('*')
        .in('id', artworkIds);

    if (artworkError) {
        return res.status(500).json({ error: artworkError.message });
    }

    // 3. Merge data
    const merged = listings.map(listing => {
        const art = artworks?.find(a => a.id === listing.artwork_id);
        return {
            ...listing,
            artworks: art // Embed as 'artworks' property to match expected frontend schema
        };
    });

    res.json(merged);
});

// GET /listings/:artworkId - Get ALL listings for artwork (for provenance history)
app.get('/listings/:artworkId', async (req, res) => {
    const { artworkId } = req.params;
    const { data, error } = await supabase
        .from('market_listings')
        .select('*')
        .eq('artwork_id', artworkId)
        .order('created_at', { ascending: false }); // Most recent first

    if (error && error.code !== 'PGRST116') { // PGRST116 is "No rows found"
        return res.status(500).json({ error: error.message });
    }

    // Return array of listings (empty array if none)
    res.json(data || []);
});

// POST /listings - Webhook/Indexer endpoint (simulated for now, would be called by watcher or on-chain event)
app.post('/sync/listing', async (req, res) => {
    const { listingId, artworkId, seller, startPrice, endPrice, startsAt, duration } = req.body;

    const { data, error } = await supabase
        .from('market_listings')
        .insert([
            {
                on_chain_id: listingId,
                artwork_id: artworkId,
                seller_wallet: seller,
                price_start: startPrice,
                price_end: endPrice,
                starts_at: startsAt,
                duration,
                status: 'ACTIVE'
            }
        ])
        .select();

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

// POST /listings/mark-sold - Direct update to SOLD (called by frontend after successful purchase)
app.post('/listings/mark-sold', async (req, res) => {
    const { listingId, buyerWallet, txHash } = req.body;

    if (!listingId) {
        return res.status(400).json({ error: 'listingId is required' });
    }

    console.log(`[Direct Sold Update] Marking listing ${listingId} as SOLD by ${buyerWallet}`);

    const { data, error } = await supabase
        .from('market_listings')
        .update({
            status: 'SOLD',
            buyer_wallet: buyerWallet || null,
            tx_hash: txHash || null
        })
        .eq('on_chain_id', listingId.toString())
        .eq('status', 'ACTIVE')  // Only update if currently ACTIVE
        .select();

    if (error) {
        console.error('[Direct Sold Update] Error:', error);
        return res.status(500).json({ error: error.message });
    }

    if (!data || data.length === 0) {
        console.log('[Direct Sold Update] No active listing found with on_chain_id:', listingId);
        return res.json({ updated: false, message: 'No active listing found or already sold' });
    }

    console.log('[Direct Sold Update] Successfully marked as SOLD:', data);
    res.json({ updated: true, listing: data[0] });
});

// Extended ABI for reading listing status
const FULL_MARKETPLACE_ABI = [
    ...MARKETPLACE_ABI,
    "function listings(uint256) view returns (uint256 listingId, address seller, address tokenAddress, uint256 tokenId, uint256 startPrice, uint256 endPrice, uint256 startTime, uint256 duration, bool active)"
];
const fullContract = new ethers.Contract(MARKETPLACE_ADDRESS, FULL_MARKETPLACE_ABI, provider);

// GET /listings/:artworkId/verify - Verify and sync listing status from on-chain
app.get('/listings/:artworkId/verify', async (req, res) => {
    const { artworkId } = req.params;

    try {
        // Get all active listings for this artwork from DB
        const { data: listings, error } = await supabase
            .from('market_listings')
            .select('*')
            .eq('artwork_id', artworkId)
            .eq('status', 'ACTIVE');

        if (error) return res.status(500).json({ error: error.message });

        const updates: any[] = [];

        for (const listing of listings || []) {
            if (!listing.on_chain_id) continue;

            try {
                // Query on-chain listing status
                const onChainListing = await fullContract.listings(listing.on_chain_id);
                const isActive = onChainListing.active;

                // If on-chain says not active, update DB
                if (!isActive && listing.status === 'ACTIVE') {
                    console.log(`[Verify] Listing ${listing.on_chain_id} is NOT active on-chain, updating DB...`);
                    const { error: updateError } = await supabase
                        .from('market_listings')
                        .update({ status: 'SOLD' })
                        .eq('listing_id', listing.listing_id);

                    if (!updateError) {
                        updates.push({ listing_id: listing.listing_id, old_status: 'ACTIVE', new_status: 'SOLD' });
                    }
                }
            } catch (contractErr: any) {
                console.error(`[Verify] Error checking listing ${listing.on_chain_id}:`, contractErr.message);
            }
        }

        res.json({ verified: true, updates });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// POST /listings/:artworkId/cleanup - Mark stale listings as EXPIRED (owner-initiated)
app.post('/listings/:artworkId/cleanup', async (req, res) => {
    const { artworkId } = req.params;
    const { ownerWallet } = req.body; // The wallet claiming to be the owner

    if (!ownerWallet) {
        return res.status(400).json({ error: 'ownerWallet is required' });
    }

    try {
        // Get all active listings for this artwork
        const { data: listings, error } = await supabase
            .from('market_listings')
            .select('*')
            .eq('artwork_id', artworkId)
            .eq('status', 'ACTIVE');

        if (error) return res.status(500).json({ error: error.message });

        const cleaned: any[] = [];

        for (const listing of listings || []) {
            // Mark as EXPIRED if seller is not the owner anymore
            if (listing.seller_wallet.toLowerCase() !== ownerWallet.toLowerCase()) {
                const { error: updateError } = await supabase
                    .from('market_listings')
                    .update({ status: 'EXPIRED' })
                    .eq('listing_id', listing.listing_id);

                if (!updateError) {
                    cleaned.push({ listing_id: listing.listing_id, old_status: 'ACTIVE', new_status: 'EXPIRED' });
                    console.log(`[Cleanup] Marked listing ${listing.listing_id} as EXPIRED (seller ${listing.seller_wallet} != owner ${ownerWallet})`);
                }
            }
        }

        res.json({ success: true, cleaned });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

app.listen(port, () => {
    console.log(`Marketplace Service running on port ${port}`);
});
