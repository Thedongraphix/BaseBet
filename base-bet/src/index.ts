import { TwitterBot } from './bot/twitter-bot';
import { config } from './utils/config';

async function main() {
  console.log('🎲 Prediction Betting Bot Starting...');
  console.log(`📍 Network: ${config.blockchain.network}`);
  console.log(`🤖 Bot: @${config.twitter.botUsername}`);
  console.log(`📊 Contract: ${config.blockchain.contractAddress}`);

  const bot = new TwitterBot();

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
  } catch (error) {
    console.error('💥 Bot crashed:', error);
    process.exit(1);
  }
}

main().catch(console.error); 