import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '../../infra/.env' });

const supabaseUrl = process.env.SUPABASE_URL || 'https://vmrfhvxbbxpknohglgym.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZtcmZodnhiYnhwa25vaGdsZ3ltIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTYyNTc4MywiZXhwIjoyMDc3MjAxNzgzfQ.KvbMEDXcO5BZdNN9ltvsXzFGbxnVU3Xk47ZhDzpeTq0';

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    console.log('Checking artworks in DB...');

    const { data, error } = await supabase
        .from('artworks')
        .select('id, title, minted, token_id, tx_hash, creator_wallet')
        .neq('id', 0); // Get all

    if (error) {
        console.error('Error fetching artworks:', error);
    } else {
        console.table(data);
    }
}

main();
