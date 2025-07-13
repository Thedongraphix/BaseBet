"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const twitter_bot_1 = require("./bot/twitter-bot");
const config_1 = require("./utils/config");
async function main() {
    console.log('🎲 Prediction Betting Bot Starting...');
    console.log(`📍 Network: ${config_1.config.blockchain.network}`);
    console.log(`🤖 Bot: @${config_1.config.twitter.botUsername}`);
    console.log(`📊 Contract: ${config_1.config.blockchain.contractAddress}`);
    const bot = new twitter_bot_1.TwitterBot();
    // Graceful shutdown
    process.on('SIGINT', async () => {
        console.log('\n🛑 Received SIGINT, shutting down gracefully...');
        await bot.stop();
        process.exit(0);
    });
    process.on('SIGTERM', async () => {
        console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
        await bot.stop();
        process.exit(0);
    });
    try {
        await bot.start();
    }
    catch (error) {
        console.error('💥 Bot crashed:', error);
        process.exit(1);
    }
}
main().catch(console.error);
