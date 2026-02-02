-- =====================================================
-- AETHERIA DATABASE SCHEMA
-- (Fully aligned with Normalization Diagram | 3NF)
-- =====================================================

-- =========================
-- USERS TABLE
-- =========================
CREATE TABLE USERS (
    user_id SERIAL PRIMARY KEY,
    username VARCHAR(50) NOT NULL,
    wallet_address VARCHAR(100) UNIQUE NOT NULL,
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =========================
-- ARTWORKS TABLE
-- =========================
CREATE TABLE ARTWORKS (
    artwork_id SERIAL PRIMARY KEY,
    prompt_hash CHAR(64) NOT NULL,
    prompt TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ai_model VARCHAR(100),
    title VARCHAR(150),
    description TEXT,
    image_url TEXT NOT NULL,
    metadata_hash CHAR(64) NOT NULL,
    metadata_url TEXT,
    token_id INT,
    tx_hash VARCHAR(100),
    creator_hash CHAR(64),
    creator_wallet VARCHAR(100) NOT NULL,
    featured BOOLEAN DEFAULT FALSE,
    user_id INT NOT NULL,

    FOREIGN KEY (user_id)
        REFERENCES USERS(user_id)
        ON DELETE CASCADE
);

-- =========================
-- VOTES TABLE
-- =========================
CREATE TABLE VOTES (
    vote_id SERIAL PRIMARY KEY,
    user_id INT NOT NULL,
    artwork_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    vote_count INT DEFAULT 1,

    FOREIGN KEY (user_id)
        REFERENCES USERS(user_id)
        ON DELETE CASCADE,

    FOREIGN KEY (artwork_id)
        REFERENCES ARTWORKS(artwork_id)
        ON DELETE CASCADE,

    UNIQUE (user_id, artwork_id)
);

-- =====================================================
-- COMMENTS (3NF DECOMPOSITION)
-- =====================================================

-- COMMENTS_A : reply_id → artwork_id
CREATE TABLE COMMENTS_A (
    reply_id INT PRIMARY KEY,
    artwork_id INT NOT NULL,

    FOREIGN KEY (artwork_id)
        REFERENCES ARTWORKS(artwork_id)
        ON DELETE CASCADE
);

-- COMMENTS_B : comment details
CREATE TABLE COMMENTS_B (
    comment_id SERIAL PRIMARY KEY,
    edited_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    body TEXT NOT NULL,
    reply_id INT,
    user_id INT NOT NULL,

    FOREIGN KEY (reply_id)
        REFERENCES COMMENTS_A(reply_id)
        ON DELETE CASCADE,

    FOREIGN KEY (user_id)
        REFERENCES USERS(user_id)
        ON DELETE CASCADE
);

-- =====================================================
-- MINTS (3NF DECOMPOSITION)
-- =====================================================

-- MINTS_MAP : Mint_Id → tx_hash
CREATE TABLE MINTS_MAP (
    mint_id SERIAL PRIMARY KEY,
    tx_hash VARCHAR(100) UNIQUE NOT NULL
);

-- MINTS_B : tx_hash → mint attributes
CREATE TABLE MINTS_B (
    tx_hash VARCHAR(100) PRIMARY KEY,
    owner_wallet VARCHAR(100) NOT NULL,
    contact_address TEXT,
    token_id INT UNIQUE NOT NULL,
    royalties_bps INT,
    minted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    artwork_id INT NOT NULL,

    FOREIGN KEY (tx_hash)
        REFERENCES MINTS_MAP(tx_hash)
        ON DELETE CASCADE,

    FOREIGN KEY (artwork_id)
        REFERENCES ARTWORKS(artwork_id)
        ON DELETE CASCADE
);

-- =====================================================
-- MARKETPLACE
-- =====================================================

CREATE TABLE MARKET_LISTINGS (
    listing_id SERIAL PRIMARY KEY,
    artwork_id INT NOT NULL,
    seller_wallet VARCHAR(100) NOT NULL,
    price_start NUMERIC(20, 0) NOT NULL, -- Stored in Wei
    price_end NUMERIC(20, 0) NOT NULL, -- Stored in Wei
    starts_at TIMESTAMP NOT NULL,
    ends_at TIMESTAMP NOT NULL,
    duration INT NOT NULL, -- Seconds
    status VARCHAR(20) DEFAULT 'ACTIVE', -- ACTIVE, SOLD, CANCELLED
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    on_chain_id INT, -- ID from Smart Contract

    FOREIGN KEY (artwork_id)
        REFERENCES ARTWORKS(artwork_id)
        ON DELETE CASCADE
);