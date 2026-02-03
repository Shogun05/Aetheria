/**
 * Script to fix token_id=0 in artworks table
 * Reads the actual token ID from the ERC-721 Transfer event on Sepolia
 * 
 * Usage: npx tsx scripts/fix_token_ids.ts
 * Requires: Root .env file with SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RPC_URL
 */

import { ethers } from 'ethers';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load from root .env
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const RPC_URL = process.env.RPC_URL;

// Validate environment variables
if (!SUPABASE_URL || !SUPABASE_KEY || !RPC_URL) {
    console.error('❌ Missing required environment variables in .env:');
    console.error('   - SUPABASE_URL:', SUPABASE_URL ? '✅' : '❌');
    console.error('   - SUPABASE_SERVICE_ROLE_KEY:', SUPABASE_KEY ? '✅' : '❌');
    console.error('   - RPC_URL:', RPC_URL ? '✅' : '❌');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const provider = new ethers.JsonRpcProvider(RPC_URL);

// ERC-721 Transfer event: Transfer(address indexed from, address indexed to, uint256 indexed tokenId)
// When minting, 'from' is zero address
const TRANSFER_EVENT_TOPIC = ethers.id('Transfer(address,address,uint256)');
const ZERO_ADDRESS_TOPIC = '0x0000000000000000000000000000000000000000000000000000000000000000';

async function fixTokenIds() {
    console.log('🔍 Finding artworks with token_id = 0...\n');

    // Get all minted artworks with token_id = 0
    const { data: artworks, error } = await supabase
        .from('artworks')
        .select('id, title, tx_hash, token_id')
        .eq('minted', true)
        .eq('token_id', 0);

    if (error) {
        console.error('❌ Error fetching artworks:', error);
        process.exit(1);
    }

    if (!artworks || artworks.length === 0) {
        console.log('✅ No artworks with token_id = 0 found! All good.');
        return;
    }

    console.log(`Found ${artworks.length} artworks to fix:\n`);

    let fixed = 0;
    let failed = 0;

    for (const artwork of artworks) {
        console.log(`📖 Processing: "${artwork.title}"`);
        console.log(`   TX: ${artwork.tx_hash}`);

        if (!artwork.tx_hash) {
            console.log(`   ⚠️  No transaction hash, skipping\n`);
            failed++;
            continue;
        }

        try {
            // Get transaction receipt from blockchain
            const receipt = await provider.getTransactionReceipt(artwork.tx_hash);

            if (!receipt) {
                console.log(`   ⚠️  Receipt not found on chain, skipping\n`);
                failed++;
                continue;
            }

            // Find ERC-721 Transfer event (mint = from zero address)
            // topics[0] = event signature
            // topics[1] = from (zero address for mint)
            // topics[2] = to
            // topics[3] = tokenId
            const transferLog = receipt.logs.find(
                log => log.topics[0] === TRANSFER_EVENT_TOPIC &&
                    log.topics[1] === ZERO_ADDRESS_TOPIC
            );

            if (!transferLog || !transferLog.topics[3]) {
                console.log(`   ⚠️  Transfer event not found in logs (${receipt.logs.length} logs checked)\n`);
                failed++;
                continue;
            }

            // Token ID is the fourth topic (topics[3])
            const tokenId = Number(BigInt(transferLog.topics[3]));

            if (tokenId < 1) {
                console.log(`   ⚠️  Invalid token ID parsed: ${tokenId}\n`);
                failed++;
                continue;
            }

            console.log(`   🎯 Found token_id: ${tokenId}`);

            // Update database
            const { error: updateError } = await supabase
                .from('artworks')
                .update({ token_id: tokenId })
                .eq('id', artwork.id);

            if (updateError) {
                console.log(`   ❌ Failed to update: ${updateError.message}\n`);
                failed++;
            } else {
                console.log(`   ✅ Updated successfully!\n`);
                fixed++;
            }

        } catch (err: any) {
            console.log(`   ❌ Error: ${err.message}\n`);
            failed++;
        }
    }

    console.log('\n────────────────────────────────');
    console.log(`🏁 Done! Fixed: ${fixed}, Failed: ${failed}`);
}

fixTokenIds();
