# Aetheria - DBMS Lab SEE Report

---

## 1. Abstract / Introduction

### Abstract

Aetheria is a decentralized art museum platform built on microservices architecture that enables artists to upload digital artwork, gain community validation through voting, mint NFTs (Non-Fungible Tokens) on the Ethereum Sepolia testnet, and trade artworks on an integrated marketplace. The platform addresses the problem of art curation and provenance by implementing a community-driven validation model where artworks require a minimum of three votes before becoming eligible for minting. The system utilizes Supabase PostgreSQL as the primary database for storing artwork metadata, user records, votes, and marketplace listings, while leveraging blockchain technology for immutable ownership records and transparent transactions. The marketplace implements a Dutch Auction pricing mechanism allowing sellers to set dynamic, time-decaying prices for their NFTs.

### Introduction

The emergence of blockchain technology has revolutionized digital art ownership through NFTs, yet most platforms lack community curation and transparent validation mechanisms. Aetheria addresses this gap by creating a decentralized art museum where the community acts as curators. The platform implements a voting-based eligibility system that ensures only community-approved artworks can be minted as NFTs, reducing low-quality submissions. The integrated marketplace enables secondary sales with full provenance tracking, storing every listing and sale event in the database while mirroring ownership records on-chain.

---

## 2. Objectives

1. **Implement a Community-Driven Curation System** – Design and develop a voting mechanism where registered users with a minimum ETH balance (≥0.01 SepoliaETH) can vote for artworks, with a threshold of 3 votes required for mint eligibility.

2. **Build a Microservices-Based Backend Architecture** – Develop independent, scalable services for authentication, artwork upload, metadata generation, NFT minting, voting, and marketplace operations.

3. **Integrate Blockchain for Immutable Ownership** – Deploy ERC-721 smart contracts on Sepolia testnet to handle NFT minting and ownership transfers, with a marketplace contract supporting Dutch Auction pricing.

4. **Design a Relational Database Schema** – Create a normalized PostgreSQL database schema using Supabase to store users, artworks, votes, tags, comments, and marketplace listings with proper foreign key relationships.

5. **Implement Artwork Provenance Tracking** – Record complete transaction history (listings, sales, ownership transfers) in the database with links to on-chain transaction hashes for verification.

6. **Develop a Responsive Frontend Application** – Build a modern React-based single-page application with wallet connectivity, real-time data fetching, and interactive UI components.

---

## 3. Innovative Component

1. **Dutch Auction Marketplace** – Unlike fixed-price marketplaces, Aetheria implements a Dutch Auction mechanism where the NFT price decreases linearly from a start price to an end price over a specified duration. This is calculated on-chain using the formula:
   ```
   currentPrice = startPrice - ((startPrice - endPrice) * timeElapsed / duration)
   ```

2. **Sybil-Resistant Voting** – The voting system queries the Ethereum blockchain in real-time to verify that voters hold a minimum balance of 0.01 ETH, preventing vote manipulation from empty or bot wallets.

3. **Hybrid On-Chain/Off-Chain Architecture** – Critical ownership data is stored on-chain for immutability, while metadata, vote counts, and provenance history are maintained in the relational database for efficient querying and display.

4. **Event-Driven Database Synchronization** – The marketplace service runs an event watcher that listens to blockchain events (`ItemListed`, `ItemSold`, `ItemCanceled`) and automatically synchronizes the database, ensuring consistency between on-chain and off-chain data.

5. **Automatic Stale Listing Cleanup** – The system detects ownership changes and automatically marks old marketplace listings as expired when the seller is no longer the NFT owner.

---

## 4. Outcome of the Project

1. **Functional Decentralized Art Museum** – Successfully deployed a fully operational platform where users can upload artworks, vote for community favorites, and mint validated artworks as ERC-721 NFTs on Sepolia testnet.

2. **Integrated NFT Marketplace** – Implemented a working marketplace where users can list, buy, and resell NFTs with complete transaction history preserved in both the database and blockchain.

3. **Scalable Microservices Architecture** – Delivered 7 independent backend services that can be deployed, scaled, and maintained separately, demonstrating enterprise-grade architecture patterns.

4. **Database with 8+ Tables** – Designed and implemented a comprehensive relational database schema including:
   - `users` (wallet authentication)
   - `artworks` (metadata, minting status)
   - `votes` (user-artwork voting records)
   - `market_listings` (marketplace state)
   - `tags` and `artwork_tags` (categorization)
   - `comments` (user discussions)

5. **Complete Provenance Tracking** – Every artwork displays its full history from creation through all sales, with Etherscan links to verify on-chain transactions.

---

## 5. Front End and Backend Software Used

### Frontend Technologies

| Technology | Version | Purpose |
|------------|---------|---------|
| React | 18.x | UI component library for building the single-page application |
| Vite | 5.x | Fast build tool and development server |
| TypeScript | 5.x | Type-safe JavaScript for improved code quality |
| Wagmi | 2.x | React hooks library for Ethereum wallet integration |
| Viem | 2.x | TypeScript interface for Ethereum interactions |
| TanStack Query | 5.x | Data fetching and caching |
| Framer Motion | 11.x | Animation library for smooth UI transitions |
| React Router DOM | 6.x | Client-side routing |

### Backend Technologies

| Technology | Version | Purpose |
|------------|---------|---------|
| Node.js | 18+ | JavaScript runtime for backend services |
| Express.js | 4.x | Web framework for REST API development |
| TypeScript | 5.x | Type-safe backend development |
| Supabase | — | PostgreSQL database and object storage |
| Ethers.js | 6.x | Ethereum blockchain interaction library |
| Multer | 1.x | Multipart form-data handling for file uploads |
| Docker | — | Containerization for deployment |

### Database

| Technology | Purpose |
|------------|---------|
| PostgreSQL (via Supabase) | Primary relational database for all application data |
| Supabase Storage | Object storage for artwork images |

### Blockchain / Smart Contracts

| Technology | Version | Purpose |
|------------|---------|---------|
| Solidity | 0.8.20 | Smart contract programming language |
| Hardhat | 2.x | Ethereum development environment |
| OpenZeppelin | 5.x | Audited smart contract libraries (ERC-721, ReentrancyGuard) |
| Sepolia Testnet | — | Ethereum test network for deployment |
| Alchemy | — | RPC provider for blockchain connectivity |

---

## Database Schema

```sql
-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_address VARCHAR(42) UNIQUE NOT NULL,
    username VARCHAR(50),
    joined_at TIMESTAMP DEFAULT NOW()
);

-- Artworks table
CREATE TABLE artworks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(200) NOT NULL,
    description TEXT,
    image_url TEXT NOT NULL,
    creator_wallet VARCHAR(42) NOT NULL,
    metadata_hash VARCHAR(64),
    metadata_uri TEXT,
    minted BOOLEAN DEFAULT FALSE,
    token_id INTEGER,
    tx_hash VARCHAR(66),
    vote_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Votes table
CREATE TABLE votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    artwork_id UUID REFERENCES artworks(id),
    user_wallet VARCHAR(42) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(artwork_id, user_wallet)
);

-- Market Listings table
CREATE TABLE market_listings (
    listing_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    artwork_id UUID REFERENCES artworks(id),
    on_chain_id INTEGER,
    seller_wallet VARCHAR(42) NOT NULL,
    buyer_wallet VARCHAR(42),
    price_start NUMERIC,
    price_end NUMERIC,
    starts_at BIGINT,
    duration INTEGER,
    status VARCHAR(20) DEFAULT 'ACTIVE',
    tx_hash VARCHAR(66),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Tags table
CREATE TABLE tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(50) UNIQUE NOT NULL
);

-- Artwork Tags (Many-to-Many)
CREATE TABLE artwork_tags (
    artwork_id UUID REFERENCES artworks(id),
    tag_id UUID REFERENCES tags(id),
    PRIMARY KEY (artwork_id, tag_id)
);

-- Comments table
CREATE TABLE comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    artwork_id UUID REFERENCES artworks(id),
    user_wallet VARCHAR(42) NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);
```

---

wrjvnwskjvnb wrjbnvwjkn bv
jrb nwfjkb kw bwjnb 
wjb nwkj bnwkjn bjwn