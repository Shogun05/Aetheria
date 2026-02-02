#!/bin/bash
# Install dependencies for all services
cd services/auth-service && npm install &
cd services/upload-service && npm install &
cd services/metadata-service && npm install &
cd services/mint-service && npm install &
cd services/voting-service && npm install &
cd services/marketplace-service && npm install &
wait
echo "All dependencies installed."
