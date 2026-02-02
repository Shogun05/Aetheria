import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '../../infra/.env' });

const supabaseUrl = process.env.SUPABASE_URL || 'https://vmrfhvxbbxpknohglgym.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZtcmZodnhiYnhwa25vaGdsZ3ltIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTYyNTc4MywiZXhwIjoyMDc3MjAxNzgzfQ.KvbMEDXcO5BZdNN9ltvsXzFGbxnVU3Xk47ZhDzpeTq0';

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    console.log('Resetting minted status for artworks...');

    // Reset all artworks to minted=false, token_id=null, tx_hash=null
    // Ideally, we should only do this for artworks that have invalid token_ids (e.g. on old contract)
    // But given we just switched contracts, it's safer to reset all for this dev environment.

    const { data, error } = await supabase
        .from('artworks')
        .update({
            minted: false,
            token_id: null,
            tx_hash: null
        })
        .neq('id', 0) // Update all
        .select();

    if (error) {
        console.error('Error resetting artworks:', error);
    } else {
        console.log(`Successfully reset ${data.length} artworks.`);
    }
}

main();
