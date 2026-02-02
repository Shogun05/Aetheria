#!/bin/bash
# Start all services with environment variables from infra/.env
# Note: This assumes infra/.env has all necessary vars (or we might need to load them)

export $(grep -v '^#' infra/.env | xargs)

echo "Starting Auth Service..."
cd services/auth-service && PORT=4001 npm run dev &

echo "Starting Upload Service..."
cd services/upload-service && PORT=4002 npm run dev &

echo "Starting Metadata Service..."
cd services/metadata-service && PORT=4003 npm run dev &

echo "Starting Mint Service..."
cd services/mint-service && PORT=4004 npm run dev &

echo "Starting Voting Service..."
cd services/voting-service && PORT=4005 npm run dev &

echo "Starting Marketplace Service..."
cd services/marketplace-service && PORT=4006 npm run dev &

wait
