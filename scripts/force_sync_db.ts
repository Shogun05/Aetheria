import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '../../infra/.env' });

const supabaseUrl = process.env.SUPABASE_URL || 'https://vmrfhvxbbxpknohglgym.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZtcmZodnhiYnhwa25vaGdsZ3ltIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTYyNTc4MywiZXhwIjoyMDc3MjAxNzgzfQ.KvbMEDXcO5BZdNN9ltvsXzFGbxnVU3Xk47ZhDzpeTq0';

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    console.log('Force updating DB state to match on-chain...');

    // We know Token ID 1 exists on chain and belongs to the user.
    // We need to find the latest artwork (likely the one the user just minted) and set its token_id to 1.

    // 1. Find the artwork that was likely just minted (minted=true but maybe token_id is wrong or 0)
    // or just take the most recent one.

    const { data: artworks, error } = await supabase
        .from('artworks')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1);

    if (error || !artworks || artworks.length === 0) {
        console.error('Error finding artwork:', error);
        return;
    }

    const artwork = artworks[0];
    console.log('Found latest artwork:', { id: artwork.id, title: artwork.title, current_token_id: artwork.token_id });

    // 2. Update to Token ID 1
    const { error: updateError } = await supabase
        .from('artworks')
        .update({
            minted: true,
            token_id: 1,
            // We can't easily get the tx_hash without Etherscan api, but it's less critical for the frontend flow than token_id
        })
        .eq('id', artwork.id);

    if (updateError) {
        console.error('Failed to update:', updateError);
    } else {
        console.log(`✅ Successfully updated artwork ${artwork.id} to Token ID 1`);
    }
}

main();
