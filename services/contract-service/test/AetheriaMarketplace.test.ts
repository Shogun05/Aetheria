import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("AetheriaMarketplace", function () {
    let nft: any;
    let marketplace: any;
    let owner: any;
    let seller: any;
    let buyer: any;

    beforeEach(async function () {
        [owner, seller, buyer] = await ethers.getSigners();

        // Deploy NFT
        const NFT = await ethers.getContractFactory("AetheriaExhibitNFT");
        nft = await NFT.deploy();
        await nft.waitForDeployment();

        // Deploy Marketplace
        const Marketplace = await ethers.getContractFactory("AetheriaMarketplace");
        marketplace = await Marketplace.deploy();
        await marketplace.waitForDeployment();

        // Mint NFT to seller
        await nft.connect(owner).mintArtwork(seller.address, "ipfs://metadata");
    });

    it("Should list an item successfully", async function () {
        // Approve marketplace
        await nft.connect(seller).approve(await marketplace.getAddress(), 1);

        await expect(
            marketplace.connect(seller).list(
                await nft.getAddress(),
                1,
                ethers.parseEther("1"), // Start Price
                ethers.parseEther("0.5"), // End Price
                3600 // Duration
            )
        ).to.emit(marketplace, "ItemListed");

        const listing = await marketplace.listings(1);
        expect(listing.active).to.equal(true);
        expect(listing.seller).to.equal(seller.address);
    });

    it("Should lower price over time (Dutch Auction)", async function () {
        await nft.connect(seller).approve(await marketplace.getAddress(), 1);
        const startPrice = ethers.parseEther("1");
        const endPrice = ethers.parseEther("0.5");
        const duration = 3600;

        await marketplace.connect(seller).list(
            await nft.getAddress(),
            1,
            startPrice,
            endPrice,
            duration
        );

        // Initial Price
        expect(await marketplace.getCurrentPrice(1)).to.equal(startPrice);

        // Advance time by 50%
        await time.increase(duration / 2);

        // Price should be approx halfway (0.75 ETH)
        const midPrice = await marketplace.getCurrentPrice(1);
        expect(midPrice).to.be.closeTo(ethers.parseEther("0.75"), ethers.parseEther("0.01"));

        // Advance time to end
        await time.increase(duration / 2);
        expect(await marketplace.getCurrentPrice(1)).to.equal(endPrice);
    });

    it("Should allow buying at current price", async function () {
        await nft.connect(seller).approve(await marketplace.getAddress(), 1);
        const startPrice = ethers.parseEther("1");

        await marketplace.connect(seller).list(
            await nft.getAddress(),
            1,
            startPrice,
            startPrice, // Fixed price
            3600
        );

        // Buyer buys
        await expect(
            marketplace.connect(buyer).buy(1, { value: startPrice })
        ).to.emit(marketplace, "ItemSold");

        // Owner should change
        expect(await nft.ownerOf(1)).to.equal(buyer.address);

        // Listing inactive
        const listing = await marketplace.listings(1);
        expect(listing.active).to.equal(false);
    });
});
