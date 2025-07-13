# Twitter Prediction Betting Bot

A Twitter bot that enables crypto prediction betting directly in threads using AgentKit and Base blockchain. Users can mention the bot to create and participate in PvP bets on any prediction tweet.

## Features

- 🐦 **Twitter Integration**: Respond to mentions and create betting markets
- 🔗 **Base Blockchain**: Built on Base Sepolia/Mainnet using AgentKit
- 💰 **Smart Contracts**: Decentralized betting with automatic payouts
- 🎯 **PvP Betting**: True vs False predictions with odds
- 📊 **Real-time Stats**: Market status and betting pool information
- 🛡️ **Secure**: Non-custodial betting with smart contract escrow

## Prerequisites

- Node.js 18+
- Twitter Developer Account (Basic plan minimum)
- Coinbase Developer Platform account
- Base Sepolia/Mainnet ETH for gas fees

## Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd prediction-betting-bot
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your API keys and configuration
   ```

4. **Build the project**
   ```bash
   npm run build
   ```

## Environment Variables

Create a `.env` file with the following variables:

```env
# Coinbase Developer Platform
CDP_API_KEY_NAME=your_cdp_api_key_name
CDP_API_KEY_PRIVATE_KEY=your_cdp_private_key

# OpenRouter
OPENROUTER_API_KEY=your_openrouter_api_key

# Twitter API (Requires paid plan)
TWITTER_BEARER_TOKEN=your_twitter_bearer_token
TWITTER_API_KEY=your_twitter_api_key
TWITTER_API_SECRET=your_twitter_api_secret
TWITTER_ACCESS_TOKEN=your_twitter_access_token
TWITTER_ACCESS_SECRET=your_twitter_access_secret
TWITTER_BOT_USERNAME=your_bot_username

# Blockchain
NETWORK=base-sepolia  # Use base-mainnet for production
CONTRACT_ADDRESS=  # Will be set after deployment

# Bot Configuration
POLL_INTERVAL=60000  # 1 minute
MAX_BET_AMOUNT=1.0   # ETH
MIN_BET_AMOUNT=0.01  # ETH
DEFAULT_MARKET_DURATION=30  # days
```

## Deployment

### 1. Deploy Smart Contract

```bash
# Deploy to Base Sepolia (testnet)
npm run deploy:contract

# The contract address will be automatically added to your .env file
```

### 2. Start the Bot

```bash
# Development mode
npm run dev

# Production mode
npm run start
```

## Usage

### Commands

**Create Market:**
```
@YourBot create market
```

**Place Bet:**
```
@YourBot I bet 0.1 ETH that this is true
@YourBot I bet 0.05 ETH that this is false
```

**Check Status:**
```
@YourBot status
```

**Get Help:**
```
@YourBot help
```

### Example Workflow

1. Someone tweets a prediction: "Bitcoin will reach $100k by end of 2024"
2. Reply: "@YourBot create market"
3. Bot creates a prediction market for the tweet
4. Others can bet: "@YourBot I bet 0.1 ETH that this is true"
5. Bot provides payment instructions and tracks bets
6. Market resolves automatically after the duration

## Smart Contract Features

- **Decentralized**: No central authority controls funds
- **Transparent**: All bets and outcomes are on-chain
- **Automatic Payouts**: Winners receive funds automatically
- **Platform Fee**: 2% fee for platform sustainability
- **Bet Limits**: Configurable min/max bet amounts
- **Time-based Markets**: Automatic expiration and resolution

## API Structure

### ContractService
- `createMarket(tweetId, prediction, duration)`
- `placeBet(tweetId, position, amount)`
- `getMarketInfo(tweetId)`
- `marketExists(tweetId)`

### BetParser
- `parseBetFromTweet(text)` - Extract bet amount and position
- `formatPosition(position)` - Format true/false as ✅/❌
- `generateBetSummary(betInfo)` - Create bet summary text

### MentionHandler
- `processMention(tweet)` - Handle incoming mentions
- `handleBetRequest(tweet)` - Process betting commands
- `handleMarketCreation(tweet)` - Create new markets
- `handleStatusRequest(tweet)` - Show market status

## Development

### Project Structure

```
prediction-betting-bot/
├── src/
│   ├── bot/
│   │   ├── twitter-bot.ts          # Main bot class
│   │   ├── mention-handler.ts      # Handle Twitter mentions
│   │   └── bet-parser.ts          # Parse betting commands
│   ├── contracts/
│   │   ├── PredictionBetting.sol   # Smart contract
│   │   └── deploy.ts              # Deployment script
│   ├── services/
│   │   ├── contract-service.ts     # Blockchain interactions
│   │   ├── oracle-service.ts       # Market resolution
│   │   └── wallet-service.ts       # Wallet operations
│   ├── utils/
│   │   ├── config.ts              # Configuration
│   │   └── logger.ts              # Logging utilities
│   └── index.ts                   # Main entry point
├── .env.example                   # Environment template
├── package.json                   # Dependencies
├── tsconfig.json                  # TypeScript config
└── README.md                      # This file
```

### Testing

```bash
# Run development server
npm run dev

# Test by mentioning your bot on Twitter
# Check console logs for debugging information
```

## Security Considerations

- **Private Keys**: Never commit private keys to version control
- **Rate Limits**: Bot respects Twitter API rate limits
- **Input Validation**: All user inputs are validated
- **Error Handling**: Comprehensive error handling and logging
- **Smart Contract Security**: Audited contract with safety checks

## Troubleshooting

### Common Issues

**Twitter API errors:**
- Check your API keys and permissions
- Ensure you have the correct Twitter API plan
- Verify rate limits haven't been exceeded

**Contract errors:**
- Confirm contract address is correct
- Check network configuration (sepolia vs mainnet)
- Verify wallet has sufficient ETH for gas

**Bot not responding:**
- Check console logs for errors
- Verify bot is mentioned correctly
- Confirm bot has reply permissions

### Debugging

Enable verbose logging by setting:
```bash
export DEBUG=prediction-betting-bot:*
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Support

For issues and questions:
- Create an issue on GitHub
- Check the troubleshooting section
- Review the smart contract documentation

---

Built with ❤️ using AgentKit and Base blockchain. 