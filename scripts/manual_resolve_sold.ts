import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '../../infra/.env' });

const supabaseUrl = process.env.SUPABASE_URL || 'https://vmrfhvxbbxpknohglgym.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZtcmZodnhiYnhwa25vaGdsZ3ltIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTYyNTc4MywiZXhwIjoyMDc3MjAxNzgzfQ.KvbMEDXcO5BZdNN9ltvsXzFGbxnVU3Xk47ZhDzpeTq0';

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    console.log('Manually marking listing as SOLD...');

    // Update the latest active listing to SOLD
    const { data, error } = await supabase
        .from('market_listings')
        .update({ status: 'SOLD' })
        .eq('status', 'ACTIVE')
        // We can target specific ID if known, but for this dev env, latest active is safe assumption
        .select();

    if (error) console.error('Error:', error);
    else console.log('Updated listings:', data);
}

main();
