import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { ethers } from 'ethers';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4004;

// Middleware
app.use(cors());
app.use(express.json());

// Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Initialize ethers provider and signer
const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);

// Contract ABI (minimal)
const CONTRACT_ABI = [
  'function mintArtwork(address creator, string calldata tokenURI) external returns (uint256)',
  'event Minted(address indexed creator, uint256 tokenId, string tokenURI)'
];

/**
 * GET /
 * Root endpoint with service information
 */
app.get('/', (_req: Request, res: Response) => {
  res.json({
    service: 'mint-service',
    status: 'running',
    version: '1.0.0',
    endpoints: {
      health: 'GET /health',
      mint: 'POST /mint (requires creator wallet auth)'
    },
    timestamp: new Date().toISOString()
  });
});

/**
 * GET /health
 * Health check endpoint
 */
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'mint-service',
    timestamp: new Date().toISOString()
  });
});

/**
 * POST /mint
 * Mint an NFT for an artwork
 * Requires: User must be the creator and artwork must have 3+ votes
 */
app.post('/mint', async (req: Request, res: Response) => {
  try {
    // Get wallet from Authorization header
    const authHeader = req.headers['authorization'] || '';
    const token = Array.isArray(authHeader) ? authHeader[0] : authHeader;
    const bearer = token.startsWith('Bearer ') ? token.slice(7) : '';

    if (!bearer) {
      return res.status(401).json({ error: 'Unauthorized: missing auth token' });
    }

    // Check if bearer is a valid wallet address or MINTER_AUTH_TOKEN
    const isSecretToken = bearer === process.env.MINTER_AUTH_TOKEN;
    const normalizedBearer = bearer.toLowerCase();
    const isWalletAddress = normalizedBearer.startsWith('0x') && ethers.isAddress(normalizedBearer);

    if (!isSecretToken && !isWalletAddress) {
      return res.status(401).json({ error: 'Unauthorized: invalid authentication token' });
    }

    const creatorWallet: string | null = isWalletAddress ? normalizedBearer : null;

    const { artworkId } = req.body;

    if (!artworkId) {
      return res.status(400).json({ error: 'Missing artworkId' });
    }

    if (!process.env.CONTRACT_ADDRESS) {
      return res.status(500).json({ error: 'Contract not deployed' });
    }

    // Fetch artwork
    let { data: artwork, error: fetchError } = await supabase
      .from('artworks')
      .select('*')
      .eq('id', artworkId)
      .single();

    if (fetchError || !artwork) {
      return res.status(404).json({ error: 'Artwork not found' });
    }

    if (artwork.minted) {
      return res.status(400).json({
        error: 'Artwork already minted',
        token_id: artwork.token_id,
        tx_hash: artwork.tx_hash
      });
    }

    // If metadata_uri doesn't exist, create it via metadata service
    if (!artwork.metadata_uri) {
      console.log(`Metadata not found for artwork ${artworkId}, creating it via metadata service...`);

      try {
        // Call metadata service to create and pin metadata to IPFS
        const metadataServiceUrl = process.env.METADATA_SERVICE_URL || 'http://metadata-service:4003';
        const metadataResponse = await fetch(`${metadataServiceUrl}/metadata`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ artworkId }),
        });

        if (!metadataResponse.ok) {
          const errorText = await metadataResponse.text();
          console.error('Metadata service error:', errorText);
          // Fallback to mock URI if metadata service fails
          const metadata_uri = `ipfs://QmMock${artworkId.replace(/-/g, '')}`;
          await supabase
            .from('artworks')
            .update({ metadata_uri })
            .eq('id', artworkId);
          console.warn(`⚠️  Using fallback mock URI: ${metadata_uri}`);
        } else {
          const metadataData = await metadataResponse.json() as { metadata_uri?: string };
          if (metadataData.metadata_uri) {
            console.log(`✅ Metadata created and pinned to IPFS: ${metadataData.metadata_uri}`);
          }
        }

        // Refresh artwork data with new metadata_uri
        const { data: updatedArtwork, error: refreshError } = await supabase
          .from('artworks')
          .select('*')
          .eq('id', artworkId)
          .single();

        if (refreshError || !updatedArtwork) {
          return res.status(500).json({ error: 'Failed to refresh artwork data' });
        }

        artwork = updatedArtwork;

        // If still no metadata_uri after calling service, use fallback
        if (!artwork.metadata_uri) {
          const metadata_uri = `ipfs://QmMock${artworkId.replace(/-/g, '')}`;
          await supabase
            .from('artworks')
            .update({ metadata_uri })
            .eq('id', artworkId);
          const { data: fallbackArtwork } = await supabase
            .from('artworks')
            .select('*')
            .eq('id', artworkId)
            .single();
          if (fallbackArtwork) artwork = fallbackArtwork;
        }
      } catch (metadataError: any) {
        console.error('Error calling metadata service:', metadataError);
        // Fallback to mock URI
        const metadata_uri = `ipfs://QmMock${artworkId.replace(/-/g, '')}`;
        await supabase
          .from('artworks')
          .update({ metadata_uri })
          .eq('id', artworkId);
        const { data: fallbackArtwork } = await supabase
          .from('artworks')
          .select('*')
          .eq('id', artworkId)
          .single();
        if (fallbackArtwork) artwork = fallbackArtwork;
        console.warn(`⚠️  Using fallback mock URI: ${metadata_uri}`);
      }
    }

    // Verify user is the creator (unless using MINTER_AUTH_TOKEN)
    if (creatorWallet) {
      if (artwork.creator_wallet?.toLowerCase() !== creatorWallet) {
        return res.status(403).json({
          error: 'Forbidden: Only the artwork creator can mint this NFT'
        });
      }
    } else if (bearer !== process.env.MINTER_AUTH_TOKEN) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Verify artwork has at least 3 votes
    if (artwork.vote_count < 3) {
      return res.status(400).json({
        error: `Artwork needs at least 3 votes to be minted. Current votes: ${artwork.vote_count}`
      });
    }

    // Create contract instance
    const contract = new ethers.Contract(
      process.env.CONTRACT_ADDRESS,
      CONTRACT_ABI,
      wallet
    );

    // Mint NFT
    console.log(`Minting NFT for artwork ${artworkId}`);
    const tx = await contract.mintArtwork(artwork.creator_wallet, artwork.metadata_uri);

    console.log(`Transaction sent: ${tx.hash}`);

    // Get token ID from the transaction return value (more reliable than parsing events)
    let tokenId: number | null = null;
    try {
      // The mintArtwork function returns the tokenId directly
      const receipt = await tx.wait();

      // Try to parse from event first, fallback to contract query
      const mintEvent = receipt?.logs?.find(
        (log: any) => log.topics && log.topics[0] === ethers.id('Minted(address,uint256,string)')
      );

      if (mintEvent && mintEvent.topics && mintEvent.topics[2]) {
        tokenId = Number(BigInt(mintEvent.topics[2]));
        console.log(`✅ Parsed token ID from event: ${tokenId}`);
      } else {
        // Fallback: query the contract for the latest token
        console.log('⚠️ Event parsing failed, querying totalSupply...');
        const totalSupply = await contract.totalSupply();
        tokenId = Number(totalSupply);
        console.log(`✅ Got token ID from totalSupply: ${tokenId}`);
      }
    } catch (parseError: any) {
      console.error('Error parsing transaction:', parseError);
      // Last resort: use totalSupply
      try {
        const totalSupply = await contract.totalSupply();
        tokenId = Number(totalSupply);
        console.log(`✅ Got token ID from totalSupply (fallback): ${tokenId}`);
      } catch (supplyError: any) {
        console.error('Failed to get totalSupply:', supplyError);
        // DO NOT save token_id = 0, this causes listing bugs!
        tokenId = null;
      }
    }

    // Validate token ID before saving - contract starts at 1
    if (tokenId === null || tokenId < 1) {
      console.error(`❌ Invalid token ID: ${tokenId}. Cannot save to database.`);
      return res.status(500).json({
        error: 'Minting succeeded but failed to retrieve token ID. Please check transaction manually.',
        tx_hash: tx.hash
      });
    }

    // Update artwork record
    const { error: updateError } = await supabase
      .from('artworks')
      .update({
        token_id: Number(tokenId),
        tx_hash: tx.hash,
        minted: true
      })
      .eq('id', artworkId);

    if (updateError) {
      console.error('Error updating artwork:', updateError);
      return res.status(500).json({ error: 'Failed to update artwork record' });
    }

    res.json({
      success: true,
      tx_hash: tx.hash,
      token_id: Number(tokenId),
      artwork_id: artworkId
    });
  } catch (error) {
    console.error('Error minting NFT:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(PORT, () => {
  console.log(`🎨 Mint service running on port ${PORT}`);
  console.log(`Connected wallet: ${wallet.address}`);
  console.log(`Contract: ${process.env.CONTRACT_ADDRESS || 'Not deployed'}`);
});

export default app;

