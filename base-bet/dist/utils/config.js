"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
exports.config = {
    // Twitter
    twitter: {
        bearerToken: process.env.TWITTER_BEARER_TOKEN,
        apiKey: process.env.TWITTER_API_KEY,
        apiSecret: process.env.TWITTER_API_SECRET,
        accessToken: process.env.TWITTER_ACCESS_TOKEN,
        accessSecret: process.env.TWITTER_ACCESS_SECRET,
        botUsername: process.env.TWITTER_BOT_USERNAME,
    },
    // Blockchain
    blockchain: {
        network: process.env.NETWORK || 'base-sepolia',
        contractAddress: process.env.CONTRACT_ADDRESS,
    },
    // AgentKit
    agentkit: {
        apiKeyName: process.env.CDP_API_KEY_NAME,
        privateKey: process.env.CDP_API_KEY_PRIVATE_KEY,
    },
    // OpenRouter
    openai: {
        apiKey: process.env.OPENROUTER_API_KEY,
    },
    // Bot Settings
    bot: {
        pollInterval: parseInt(process.env.POLL_INTERVAL || '60000'),
        maxBetAmount: parseFloat(process.env.MAX_BET_AMOUNT || '1.0'),
        minBetAmount: parseFloat(process.env.MIN_BET_AMOUNT || '0.01'),
        defaultMarketDuration: parseInt(process.env.DEFAULT_MARKET_DURATION || '30'),
    }
};
// Validation
const requiredEnvVars = [
    'CDP_API_KEY_NAME',
    'CDP_API_KEY_PRIVATE_KEY',
    'OPENROUTER_API_KEY',
    'TWITTER_BEARER_TOKEN',
    'TWITTER_API_KEY',
    'TWITTER_API_SECRET',
    'TWITTER_ACCESS_TOKEN',
    'TWITTER_ACCESS_SECRET',
    'TWITTER_BOT_USERNAME'
];
for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
        throw new Error(`Missing required environment variable: ${envVar}`);
    }
}
