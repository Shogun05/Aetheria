import { ethers } from 'hardhat';
import dotenv from 'dotenv';

dotenv.config();

const NFT_ADDRESS = process.env.CONTRACT_ADDRESS || '';
const NFT_ABI = [
    "function ownerOf(uint256 tokenId) view returns (address)",
    "function getApproved(uint256 tokenId) view returns (address)",
    "function isApprovedForAll(address owner, address operator) view returns (bool)",
    "function totalSupply() view returns (uint256)"
];

async function main() {
    const [signer] = await ethers.getSigners();
    console.log('Checking with account:', signer.address);

    const nft = new ethers.Contract(NFT_ADDRESS, NFT_ABI, signer);
    const totalSupply = await nft.totalSupply();
    console.log('Total Supply:', totalSupply.toString());
    const tokenId = 1;

    try {
        const owner = await nft.ownerOf(tokenId);
        console.log(`Token ID ${tokenId} Owner: ${owner}`);

        if (owner.toLowerCase() === signer.address.toLowerCase()) {
            console.log("✅ You own this token.");
        } else {
            console.log("❌ You DO NOT own this token.");
        }

        const approved = await nft.getApproved(tokenId);
        console.log(`Approved address for Token ${tokenId}: ${approved}`);

    } catch (error) {
        console.error("Error fetching token info:", error);
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
