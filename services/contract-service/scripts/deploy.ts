import { ethers } from 'hardhat';
import dotenv from 'dotenv';

dotenv.config();

async function main() {
  console.log('Deploying AetheriaExhibitNFT contract...');

  const [deployer] = await ethers.getSigners();
  console.log('Deploying contract with account:', deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log('Account balance:', ethers.formatEther(balance), 'MATIC');

  // Deploy NFT contract
  const AetheriaExhibitNFT = await ethers.getContractFactory('AetheriaExhibitNFT');
  const contract = await AetheriaExhibitNFT.deploy();

  await contract.waitForDeployment();
  const address = await contract.getAddress();
  console.log('✅ AetheriaExhibitNFT deployed to:', address);

  // Deploy Marketplace contract
  const AetheriaMarketplace = await ethers.getContractFactory('AetheriaMarketplace');
  const marketplace = await AetheriaMarketplace.deploy();

  await marketplace.waitForDeployment();
  const marketplaceAddress = await marketplace.getAddress();
  console.log('✅ AetheriaMarketplace deployed to:', marketplaceAddress);

  // Verify on Etherscan if API key is set
  if (process.env.ETHERSCAN_API_KEY) {
    console.log('Verifying contracts on Etherscan...');
    await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10s

    try {
      const { run } = await import('hardhat');
      await run('verify:verify', {
        address,
        constructorArguments: []
      });
      await run('verify:verify', {
        address: marketplaceAddress,
        constructorArguments: []
      });
      console.log('✅ Contracts verified on Etherscan');
    } catch (error) {
      console.error('Verification failed:', error);
    }
  }

  console.log('\n📝 Contract Deployment Summary:');
  console.log('NFT Contract Address:', address);
  console.log('Marketplace Contract Address:', marketplaceAddress);
  console.log('Network: sepolia');
  console.log('\n✨ Update your .env with:');
  console.log(`CONTRACT_ADDRESS=${address}`);
  console.log(`MARKETPLACE_ADDRESS=${marketplaceAddress}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

