export const AETHERIA_NFT_ADDRESS = '0x85a4cE9d57188F598A8A8f708D4e9C12c51B6d74';
export const AETHERIA_MARKETPLACE_ADDRESS = '0x4094E5C4E238F81c25d048427Ac6DbA8Ef93Cdee';

export const AETHERIA_NFT_ABI = [
    {
        "inputs": [
            { "internalType": "address", "name": "to", "type": "address" },
            { "internalType": "uint256", "name": "tokenId", "type": "uint256" }
        ],
        "name": "approve",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            { "internalType": "uint256", "name": "tokenId", "type": "uint256" }
        ],
        "name": "ownerOf",
        "outputs": [
            { "internalType": "address", "name": "", "type": "address" }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            { "internalType": "uint256", "name": "tokenId", "type": "uint256" }
        ],
        "name": "getApproved",
        "outputs": [
            { "internalType": "address", "name": "", "type": "address" }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            { "internalType": "address", "name": "owner", "type": "address" },
            { "internalType": "address", "name": "operator", "type": "address" }
        ],
        "name": "isApprovedForAll",
        "outputs": [
            { "internalType": "bool", "name": "", "type": "bool" }
        ],
        "stateMutability": "view",
        "type": "function"
    }
] as const;

export const AETHERIA_MARKETPLACE_ABI = [
    {
        "inputs": [
            { "internalType": "address", "name": "tokenAddress", "type": "address" },
            { "internalType": "uint256", "name": "tokenId", "type": "uint256" },
            { "internalType": "uint256", "name": "startPrice", "type": "uint256" },
            { "internalType": "uint256", "name": "endPrice", "type": "uint256" },
            { "internalType": "uint256", "name": "duration", "type": "uint256" }
        ],
        "name": "list",
        "outputs": [
            { "internalType": "uint256", "name": "", "type": "uint256" }
        ],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            { "internalType": "uint256", "name": "listingId", "type": "uint256" }
        ],
        "name": "buy",
        "outputs": [],
        "stateMutability": "payable",
        "type": "function"
    },
    {
        "inputs": [
            { "internalType": "uint256", "name": "listingId", "type": "uint256" }
        ],
        "name": "getCurrentPrice",
        "outputs": [
            { "internalType": "uint256", "name": "", "type": "uint256" }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "anonymous": false,
        "inputs": [
            { "indexed": true, "internalType": "uint256", "name": "listingId", "type": "uint256" },
            { "indexed": true, "internalType": "address", "name": "seller", "type": "address" },
            { "indexed": true, "internalType": "address", "name": "tokenAddress", "type": "address" },
            { "indexed": false, "internalType": "uint256", "name": "tokenId", "type": "uint256" },
            { "indexed": false, "internalType": "uint256", "name": "startPrice", "type": "uint256" },
            { "indexed": false, "internalType": "uint256", "name": "endPrice", "type": "uint256" },
            { "indexed": false, "internalType": "uint256", "name": "startTime", "type": "uint256" },
            { "indexed": false, "internalType": "uint256", "name": "duration", "type": "uint256" }
        ],
        "name": "ItemListed",
        "type": "event"
    }
] as const;
