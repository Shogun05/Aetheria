import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: './infra/.env' });

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    console.log('Creating MARKET_LISTINGS table via Supabase...');

    // Since we can't run raw SQL directly via the JS client,
    // we need to use the SQL Editor in Supabase Dashboard or run via psql.
    // However, we CAN create a simple table by inserting a dummy row and let Supabase auto-create?
    // Actually, no. Supabase requires explicit table creation.

    // The best approach is to run this SQL directly in Supabase SQL Editor:
    const sql = `
CREATE TABLE IF NOT EXISTS MARKET_LISTINGS (
    listing_id SERIAL PRIMARY KEY,
    artwork_id UUID NOT NULL,
    seller_wallet VARCHAR(100) NOT NULL,
    price_start NUMERIC(28, 0) NOT NULL,
    price_end NUMERIC(28, 0) NOT NULL,
    starts_at BIGINT NOT NULL,
    duration INT NOT NULL,
    status VARCHAR(20) DEFAULT 'ACTIVE',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    on_chain_id INT,
    tx_hash VARCHAR(100)
);

-- Enable RLS
ALTER TABLE MARKET_LISTINGS ENABLE ROW LEVEL SECURITY;

-- Allow public read
CREATE POLICY "Allow public read" ON MARKET_LISTINGS FOR SELECT USING (true);

-- Allow insert from service role
CREATE POLICY "Allow service insert" ON MARKET_LISTINGS FOR INSERT WITH CHECK (true);
`;

    console.log('Please run the following SQL in your Supabase SQL Editor:');
    console.log('---');
    console.log(sql);
    console.log('---');

    // Try to use rpc to execute (if such function exists)
    // Most Supabase setups don't expose raw SQL execution via API for security.
    // The user needs to run this manually or we use the Management API.

    console.log('\nAlternatively, I will try to create a minimal version by using the REST API...');

    // Workaround: Try to insert and see if it guides us
    const { data, error } = await supabase.from('MARKET_LISTINGS').select('*').limit(1);

    if (error && error.message.includes('does not exist')) {
        console.log('\n⚠️  Table does not exist. Please create it manually in Supabase SQL Editor.');
        console.log('Go to: https://supabase.com/dashboard/project/vmrfhvxbbxpknohglgym/sql/new');
        console.log('Paste the SQL above and click "Run".');
    } else if (error) {
        console.error('Error:', error.message);
    } else {
        console.log('✅ Table already exists!');
    }
}

main();
