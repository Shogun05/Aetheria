import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { formatEther } from 'ethers';

dotenv.config({ path: '../../infra/.env' });

const supabaseUrl = process.env.SUPABASE_URL || 'https://vmrfhvxbbxpknohglgym.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZtcmZodnhiYnhwa25vaGdsZ3ltIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTYyNTc4MywiZXhwIjoyMDc3MjAxNzgzfQ.KvbMEDXcO5BZdNN9ltvsXzFGbxnVU3Xk47ZhDzpeTq0';

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    console.log('Checking listings in DB...');

    const { data, error } = await supabase
        .from('market_listings')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);

    if (error) {
        console.error('Error fetching listings:', error);
    } else {
        console.log('Recent Listings:');
        data.forEach(l => {
            console.log(`- ID: ${l.listing_id} (Chain ID: ${l.on_chain_id}) | Status: ${l.status} | Price: ${l.price_start}`);
        });
    }
}

main();
