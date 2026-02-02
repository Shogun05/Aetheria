// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title AetheriaMarketplace
 * @dev Handles buying and selling of Aetheria NFTs with Dynamic Pricing (Dutch Auction) support
 */
contract AetheriaMarketplace is ReentrancyGuard, Ownable {
    struct Listing {
        uint256 listingId;
        address seller;
        address tokenAddress;
        uint256 tokenId;
        uint256 startPrice;
        uint256 endPrice;
        uint256 startTime;
        uint256 duration;
        bool active;
    }

    uint256 public nextListingId;
    mapping(uint256 => Listing) public listings;
    // Map (tokenAddress + tokenId) to active listingId for easy lookup (optional helper)
    // For simplicity, we'll rely on listingId or off-chain indexers.

    event ItemListed(
        uint256 indexed listingId,
        address indexed seller,
        address indexed tokenAddress,
        uint256 tokenId,
        uint256 startPrice,
        uint256 endPrice,
        uint256 startTime,
        uint256 duration
    );

    event ItemSold(
        uint256 indexed listingId,
        address indexed buyer,
        address indexed tokenAddress,
        uint256 tokenId,
        uint256 price
    );

    event ItemCanceled(uint256 indexed listingId);

    constructor() Ownable(msg.sender) {
        nextListingId = 1;
    }

    /**
     * @dev Create a new listing. For fixed price, set startPrice == endPrice.
     *      For Dutch Auction, set startPrice > endPrice.
     *      Requires seller to have approved this contract.
     */
    function list(
        address tokenAddress,
        uint256 tokenId,
        uint256 startPrice,
        uint256 endPrice,
        uint256 duration
    ) external nonReentrant returns (uint256) {
        require(startPrice > 0, "Price must be > 0");
        require(startPrice >= endPrice, "Start price must be >= End price");
        require(duration > 0, "Duration must be > 0");
        
        IERC721 token = IERC721(tokenAddress);
        require(token.ownerOf(tokenId) == msg.sender, "Not token owner");
        require(
            token.isApprovedForAll(msg.sender, address(this)) || 
            token.getApproved(tokenId) == address(this),
            "Marketplace not approved"
        );

        uint256 listingId = nextListingId++;

        listings[listingId] = Listing({
            listingId: listingId,
            seller: msg.sender,
            tokenAddress: tokenAddress,
            tokenId: tokenId,
            startPrice: startPrice,
            endPrice: endPrice,
            startTime: block.timestamp,
            duration: duration,
            active: true
        });

        emit ItemListed(
            listingId,
            msg.sender,
            tokenAddress,
            tokenId,
            startPrice,
            endPrice,
            block.timestamp,
            duration
        );

        return listingId;
    }

    /**
     * @dev Buy a listed item. Price depends on current block timestamp.
     */
    function buy(uint256 listingId) external payable nonReentrant {
        Listing storage listing = listings[listingId];
        require(listing.active, "Listing not active");
        
        uint256 price = getCurrentPrice(listingId);
        require(msg.value >= price, "Insufficient funds sent");

        listing.active = false;
        IERC721(listing.tokenAddress).safeTransferFrom(listing.seller, msg.sender, listing.tokenId);

        // Disburse funds to seller
        (bool success, ) = payable(listing.seller).call{value: price}("");
        require(success, "Transfer failed");

        // Refund excess
        if (msg.value > price) {
            (bool refundSuccess, ) = payable(msg.sender).call{value: msg.value - price}("");
            require(refundSuccess, "Refund failed");
        }

        emit ItemSold(listingId, msg.sender, listing.tokenAddress, listing.tokenId, price);
    }

    /**
     * @dev Cancel a listing. Only seller can cancel.
     */
    function cancel(uint256 listingId) external nonReentrant {
        Listing storage listing = listings[listingId];
        require(listing.active, "Listing not active");
        require(listing.seller == msg.sender, "Not seller");

        listing.active = false;
        emit ItemCanceled(listingId);
    }

    /**
     * @dev Calculate current price based on Dutch Auction logic
     */
    function getCurrentPrice(uint256 listingId) public view returns (uint256) {
        Listing memory listing = listings[listingId];
        if (!listing.active) return 0;

        if (block.timestamp >= listing.startTime + listing.duration) {
            return listing.endPrice;
        }

        uint256 timeElapsed = block.timestamp - listing.startTime;
        uint256 priceDiff = listing.startPrice - listing.endPrice;
        uint256 discount = (priceDiff * timeElapsed) / listing.duration;

        return listing.startPrice - discount;
    }
}
