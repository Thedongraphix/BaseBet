# Twitter Prediction Betting Bot - Cursor Implementation Guide

## Project Overview

Build a Twitter bot that enables crypto prediction betting directly in threads using AgentKit and Base blockchain. Users can mention the bot to create and participate in PvP bets on any prediction tweet.

## Prerequisites

- Node.js 18+
- Cursor IDE
- Twitter Developer Account (Basic plan minimum)
- Coinbase Developer Platform account
- Git

## Project Setup

### 1. Initialize Project

```bash
# Create new AgentKit project
npm create onchain-agent@latest prediction-betting-bot
cd prediction-betting-bot

# Install additional dependencies
npm install twitter-api-v2 @types/node dotenv ethers
```

### 2. Project Structure

```
prediction-betting-bot/
├── src/
│   ├── bot/
│   │   ├── twitter-bot.ts
│   │   ├── mention-handler.ts
│   │   └── bet-parser.ts
│   ├── contracts/
│   │   ├── PredictionBetting.sol
│   │   └── deploy.ts
│   ├── services/
│   │   ├── contract-service.ts
│   │   ├── oracle-service.ts
│   │   └── wallet-service.ts
│   ├── utils/
│   │   ├── config.ts
│   │   └── logger.ts
│   └── index.ts
├── .env.example
├── .env
├── package.json
├── tsconfig.json
└── README.md
```

## Implementation

### 3. Environment Configuration

Create `.env` file:

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

### 4. Core Configuration

`src/utils/config.ts`:

```typescript
import dotenv from 'dotenv';
dotenv.config();

export const config = {
  // Twitter
  twitter: {
    bearerToken: process.env.TWITTER_BEARER_TOKEN!,
    apiKey: process.env.TWITTER_API_KEY!,
    apiSecret: process.env.TWITTER_API_SECRET!,
    accessToken: process.env.TWITTER_ACCESS_TOKEN!,
    accessSecret: process.env.TWITTER_ACCESS_SECRET!,
    botUsername: process.env.TWITTER_BOT_USERNAME!,
  },
  
  // Blockchain
  blockchain: {
    network: process.env.NETWORK || 'base-sepolia',
    contractAddress: process.env.CONTRACT_ADDRESS!,
  },
  
  // AgentKit
  agentkit: {
    apiKeyName: process.env.CDP_API_KEY_NAME!,
    privateKey: process.env.CDP_API_KEY_PRIVATE_KEY!,
  },
  
  // OpenRouter
  openai: {
    apiKey: process.env.OPENROUTER_API_KEY!,
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
```

### 5. Smart Contract

`src/contracts/PredictionBetting.sol`:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract PredictionBetting {
    struct Bet {
        address bettor;
        uint256 amount;
        bool position; // true = agree, false = disagree
        uint256 timestamp;
    }
    
    struct Market {
        string prediction;
        string tweetId;
        address creator;
        uint256 deadline;
        bool resolved;
        bool outcome;
        Bet[] bets;
        uint256 totalAgree;
        uint256 totalDisagree;
        bool active;
    }
    
    mapping(string => Market) public markets;
    mapping(address => uint256) public pendingWithdrawals;
    mapping(string => bool) public marketExists;
    
    address public owner;
    uint256 public platformFee = 200; // 2% (200 basis points)
    uint256 public constant BASIS_POINTS = 10000;
    
    event MarketCreated(
        string indexed tweetId, 
        string prediction, 
        address creator,
        uint256 deadline
    );
    
    event BetPlaced(
        string indexed tweetId, 
        address bettor, 
        uint256 amount, 
        bool position
    );
    
    event MarketResolved(string indexed tweetId, bool outcome);
    event Withdrawal(address indexed user, uint256 amount);
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }
    
    modifier marketMustExist(string memory tweetId) {
        require(marketExists[tweetId], "Market does not exist");
        _;
    }
    
    constructor() {
        owner = msg.sender;
    }
    
    function createMarket(
        string memory tweetId,
        string memory prediction,
        uint256 durationDays
    ) external {
        require(!marketExists[tweetId], "Market already exists");
        require(bytes(prediction).length > 0, "Invalid prediction");
        require(durationDays > 0 && durationDays <= 365, "Invalid duration");
        
        uint256 deadline = block.timestamp + (durationDays * 1 days);
        
        Market storage market = markets[tweetId];
        market.prediction = prediction;
        market.tweetId = tweetId;
        market.creator = msg.sender;
        market.deadline = deadline;
        market.resolved = false;
        market.outcome = false;
        market.totalAgree = 0;
        market.totalDisagree = 0;
        market.active = true;
        
        marketExists[tweetId] = true;
        
        emit MarketCreated(tweetId, prediction, msg.sender, deadline);
    }
    
    function placeBet(
        string memory tweetId, 
        bool position
    ) external payable marketMustExist(tweetId) {
        Market storage market = markets[tweetId];
        require(market.active, "Market not active");
        require(block.timestamp < market.deadline, "Betting period ended");
        require(!market.resolved, "Market already resolved");
        require(msg.value > 0, "Bet amount must be > 0");
        require(msg.value >= 0.001 ether, "Minimum bet is 0.001 ETH");
        require(msg.value <= 10 ether, "Maximum bet is 10 ETH");
        
        market.bets.push(Bet({
            bettor: msg.sender,
            amount: msg.value,
            position: position,
            timestamp: block.timestamp
        }));
        
        if (position) {
            market.totalAgree += msg.value;
        } else {
            market.totalDisagree += msg.value;
        }
        
        emit BetPlaced(tweetId, msg.sender, msg.value, position);
    }
    
    function resolveMarket(
        string memory tweetId, 
        bool outcome
    ) external onlyOwner marketMustExist(tweetId) {
        Market storage market = markets[tweetId];
        require(market.active, "Market not active");
        require(!market.resolved, "Already resolved");
        require(block.timestamp >= market.deadline, "Market not yet expired");
        
        market.resolved = true;
        market.outcome = outcome;
        
        uint256 totalPool = market.totalAgree + market.totalDisagree;
        if (totalPool == 0) return;
        
        uint256 winningPool = outcome ? market.totalAgree : market.totalDisagree;
        uint256 losingPool = outcome ? market.totalDisagree : market.totalAgree;
        
        if (winningPool == 0) {
            // No winners, refund everyone
            for (uint i = 0; i < market.bets.length; i++) {
                Bet memory bet = market.bets[i];
                pendingWithdrawals[bet.bettor] += bet.amount;
            }
        } else {
            // Calculate platform fee
            uint256 platformFeeAmount = (losingPool * platformFee) / BASIS_POINTS;
            uint256 prizePool = losingPool - platformFeeAmount;
            
            // Distribute winnings
            for (uint i = 0; i < market.bets.length; i++) {
                Bet memory bet = market.bets[i];
                if (bet.position == outcome) {
                    // Winner gets bet back + proportional share of prize pool
                    uint256 winnings = bet.amount + (bet.amount * prizePool) / winningPool;
                    pendingWithdrawals[bet.bettor] += winnings;
                }
            }
            
            // Platform fee to owner
            pendingWithdrawals[owner] += platformFeeAmount;
        }
        
        emit MarketResolved(tweetId, outcome);
    }
    
    function withdraw() external {
        uint256 amount = pendingWithdrawals[msg.sender];
        require(amount > 0, "No funds to withdraw");
        
        pendingWithdrawals[msg.sender] = 0;
        payable(msg.sender).transfer(amount);
        
        emit Withdrawal(msg.sender, amount);
    }
    
    function getMarketInfo(string memory tweetId) 
        external 
        view 
        marketMustExist(tweetId)
        returns (
            string memory prediction,
            uint256 deadline,
            bool resolved,
            bool outcome,
            uint256 totalAgree,
            uint256 totalDisagree,
            uint256 betCount
        ) 
    {
        Market storage market = markets[tweetId];
        return (
            market.prediction,
            market.deadline,
            market.resolved,
            market.outcome,
            market.totalAgree,
            market.totalDisagree,
            market.bets.length
        );
    }
    
    function getUserBets(string memory tweetId, address user) 
        external 
        view 
        marketMustExist(tweetId)
        returns (uint256[] memory amounts, bool[] memory positions) 
    {
        Market storage market = markets[tweetId];
        uint256 userBetCount = 0;
        
        // Count user bets
        for (uint i = 0; i < market.bets.length; i++) {
            if (market.bets[i].bettor == user) {
                userBetCount++;
            }
        }
        
        amounts = new uint256[](userBetCount);
        positions = new bool[](userBetCount);
        
        uint256 index = 0;
        for (uint i = 0; i < market.bets.length; i++) {
            if (market.bets[i].bettor == user) {
                amounts[index] = market.bets[i].amount;
                positions[index] = market.bets[i].position;
                index++;
            }
        }
    }
    
    function setPlatformFee(uint256 _fee) external onlyOwner {
        require(_fee <= 1000, "Fee cannot exceed 10%"); // Max 10%
        platformFee = _fee;
    }
}
```

### 6. Contract Service

`src/services/contract-service.ts`:

```typescript
import { ethers } from 'ethers';
import { config } from '../utils/config';

export class ContractService {
  private contract: ethers.Contract;
  private provider: ethers.Provider;
  private wallet: ethers.Wallet;

  constructor() {
    // Initialize provider based on network
    if (config.blockchain.network === 'base-mainnet') {
      this.provider = new ethers.JsonRpcProvider('https://mainnet.base.org');
    } else {
      this.provider = new ethers.JsonRpcProvider('https://sepolia.base.org');
    }

    this.wallet = new ethers.Wallet(config.agentkit.privateKey, this.provider);

    // Contract ABI (simplified for key functions)
    const abi = [
      "function createMarket(string memory tweetId, string memory prediction, uint256 durationDays) external",
      "function placeBet(string memory tweetId, bool position) external payable",
      "function resolveMarket(string memory tweetId, bool outcome) external",
      "function getMarketInfo(string memory tweetId) external view returns (string memory, uint256, bool, bool, uint256, uint256, uint256)",
      "function getUserBets(string memory tweetId, address user) external view returns (uint256[] memory, bool[] memory)",
      "function withdraw() external",
      "function pendingWithdrawals(address) external view returns (uint256)",
      "function marketExists(string memory) external view returns (bool)",
      "event MarketCreated(string indexed tweetId, string prediction, address creator, uint256 deadline)",
      "event BetPlaced(string indexed tweetId, address bettor, uint256 amount, bool position)",
      "event MarketResolved(string indexed tweetId, bool outcome)"
    ];

    this.contract = new ethers.Contract(
      config.blockchain.contractAddress,
      abi,
      this.wallet
    );
  }

  async createMarket(tweetId: string, prediction: string, durationDays: number = 30): Promise<boolean> {
    try {
      const tx = await this.contract.createMarket(tweetId, prediction, durationDays);
      await tx.wait();
      return true;
    } catch (error) {
      console.error('Error creating market:', error);
      return false;
    }
  }

  async marketExists(tweetId: string): Promise<boolean> {
    try {
      return await this.contract.marketExists(tweetId);
    } catch (error) {
      console.error('Error checking market existence:', error);
      return false;
    }
  }

  async getMarketInfo(tweetId: string) {
    try {
      const result = await this.contract.getMarketInfo(tweetId);
      return {
        prediction: result[0],
        deadline: result[1],
        resolved: result[2],
        outcome: result[3],
        totalAgree: ethers.formatEther(result[4]),
        totalDisagree: ethers.formatEther(result[5]),
        betCount: result[6].toString()
      };
    } catch (error) {
      console.error('Error getting market info:', error);
      return null;
    }
  }

  async placeBet(tweetId: string, position: boolean, amount: string): Promise<boolean> {
    try {
      const tx = await this.contract.placeBet(tweetId, position, {
        value: ethers.parseEther(amount)
      });
      await tx.wait();
      return true;
    } catch (error) {
      console.error('Error placing bet:', error);
      return false;
    }
  }

  async getPendingWithdrawals(address: string): Promise<string> {
    try {
      const amount = await this.contract.pendingWithdrawals(address);
      return ethers.formatEther(amount);
    } catch (error) {
      console.error('Error getting pending withdrawals:', error);
      return '0';
    }
  }

  async withdraw(): Promise<boolean> {
    try {
      const tx = await this.contract.withdraw();
      await tx.wait();
      return true;
    } catch (error) {
      console.error('Error withdrawing:', error);
      return false;
    }
  }
}
```

### 7. Bet Parser

`src/bot/bet-parser.ts`:

```typescript
export interface BetInfo {
  amount: number;
  position: boolean; // true = agree, false = disagree
  isValid: boolean;
  error?: string;
}

export class BetParser {
  static parseBetFromTweet(text: string): BetInfo {
    const cleanText = text.toLowerCase().trim();

    // Extract amount patterns
    const amountPatterns = [
      /(\d+\.?\d*)\s*eth/i,
      /(\d+\.?\d*)\s*ether/i,
      /eth\s*(\d+\.?\d*)/i,
      /ether\s*(\d+\.?\d*)/i
    ];

    let amount = 0;
    for (const pattern of amountPatterns) {
      const match = cleanText.match(pattern);
      if (match) {
        amount = parseFloat(match[1]);
        break;
      }
    }

    if (amount === 0) {
      return {
        amount: 0,
        position: false,
        isValid: false,
        error: "No valid bet amount found. Use format like '0.1 ETH'"
      };
    }

    if (amount < 0.001) {
      return {
        amount,
        position: false,
        isValid: false,
        error: "Minimum bet amount is 0.001 ETH"
      };
    }

    if (amount > 10) {
      return {
        amount,
        position: false,
        isValid: false,
        error: "Maximum bet amount is 10 ETH"
      };
    }

    // Determine position (agree vs disagree)
    const agreeWords = ['true', 'agree', 'yes', 'correct', 'right', 'will happen', 'believe'];
    const disagreeWords = ['false', 'disagree', 'no', 'wrong', 'incorrect', 'wont happen', 'doubt'];

    let position = false; // default to disagree
    let foundPosition = false;

    // Check for agree words
    for (const word of agreeWords) {
      if (cleanText.includes(word)) {
        position = true;
        foundPosition = true;
        break;
      }
    }

    // Check for disagree words (only if no agree word found)
    if (!foundPosition) {
      for (const word of disagreeWords) {
        if (cleanText.includes(word)) {
          position = false;
          foundPosition = true;
          break;
        }
      }
    }

    if (!foundPosition) {
      return {
        amount,
        position: false,
        isValid: false,
        error: "Position unclear. Please specify 'agree/true' or 'disagree/false'"
      };
    }

    return {
      amount,
      position,
      isValid: true
    };
  }

  static formatPosition(position: boolean): string {
    return position ? '✅ AGREE' : '❌ DISAGREE';
  }

  static generateBetSummary(betInfo: BetInfo): string {
    if (!betInfo.isValid) {
      return `❌ Invalid bet: ${betInfo.error}`;
    }

    return `💰 ${betInfo.amount} ETH - ${this.formatPosition(betInfo.position)}`;
  }
}
```

### 8. Mention Handler

`src/bot/mention-handler.ts`:

```typescript
import { TwitterApi, TweetV2 } from 'twitter-api-v2';
import { ContractService } from '../services/contract-service';
import { BetParser, BetInfo } from './bet-parser';
import { config } from '../utils/config';

export class MentionHandler {
  private twitterClient: TwitterApi;
  private contractService: ContractService;

  constructor(twitterClient: TwitterApi, contractService: ContractService) {
    this.twitterClient = twitterClient;
    this.contractService = contractService;
  }

  async processMention(tweet: TweetV2): Promise<void> {
    const tweetText = tweet.text.toLowerCase();
    console.log(`Processing mention: ${tweet.text}`);

    try {
      if (this.isBetCommand(tweetText)) {
        await this.handleBetRequest(tweet);
      } else if (this.isCreateMarketCommand(tweetText)) {
        await this.handleMarketCreation(tweet);
      } else if (this.isStatusCommand(tweetText)) {
        await this.handleStatusRequest(tweet);
      } else if (this.isHelpCommand(tweetText)) {
        await this.handleHelpRequest(tweet);
      } else {
        await this.handleUnknownCommand(tweet);
      }
    } catch (error) {
      console.error(`Error processing mention ${tweet.id}:`, error);
      await this.replyWithError(tweet.id, "Sorry, something went wrong. Please try again.");
    }
  }

  private isBetCommand(text: string): boolean {
    return text.includes('bet') && (text.includes('eth') || text.includes('ether'));
  }

  private isCreateMarketCommand(text: string): boolean {
    return text.includes('create') || text.includes('new bet') || text.includes('new market');
  }

  private isStatusCommand(text: string): boolean {
    return text.includes('status') || text.includes('info') || text.includes('stats');
  }

  private isHelpCommand(text: string): boolean {
    return text.includes('help') || text.includes('how') || text.includes('commands');
  }

  private async handleBetRequest(tweet: TweetV2): Promise<void> {
    const betInfo = BetParser.parseBetFromTweet(tweet.text);

    if (!betInfo.isValid) {
      await this.replyToTweet(tweet.id, `❌ ${betInfo.error}\n\nExample: "@${config.twitter.botUsername} I bet 0.1 ETH that this is true"`);
      return;
    }

    // Get conversation/market ID
    const marketId = tweet.conversation_id || tweet.id;
    
    // Check if market exists
    const marketExists = await this.contractService.marketExists(marketId);

    if (!marketExists) {
      // Try to create market first
      const originalTweet = await this.getOriginalTweet(marketId);
      if (originalTweet && originalTweet.text) {
        const created = await this.contractService.createMarket(
          marketId, 
          originalTweet.text, 
          config.bot.defaultMarketDuration
        );

        if (!created) {
          await this.replyToTweet(tweet.id, "❌ Failed to create market. Please try again.");
          return;
        }
      } else {
        await this.replyToTweet(tweet.id, "❌ Could not find original tweet to create market.");
        return;
      }
    }

    // Get market info
    const marketInfo = await this.contractService.getMarketInfo(marketId);
    if (!marketInfo) {
      await this.replyToTweet(tweet.id, "❌ Market not found or error retrieving info.");
      return;
    }

    if (marketInfo.resolved) {
      await this.replyToTweet(tweet.id, "❌ This market has already been resolved.");
      return;
    }

    // Generate deposit address and instructions
    const reply = `🎯 **Bet Registered!**

💰 Amount: ${betInfo.amount} ETH
${BetParser.formatPosition(betInfo.position)}

📊 **Market Stats:**
• Total AGREE: ${marketInfo.totalAgree} ETH
• Total DISAGREE: ${marketInfo.totalDisagree} ETH
• Total Bets: ${marketInfo.betCount}

⚡ **To place your bet:**
Send ${betInfo.amount} ETH to this address:
\`0x[TEMP_ADDRESS]\`

Or use this payment link:
[Payment Link]

Your bet will be active once confirmed! 🚀`;

    await this.replyToTweet(tweet.id, reply);
  }

  private async handleMarketCreation(tweet: TweetV2): Promise<void> {
    const marketId = tweet.conversation_id || tweet.id;
    
    // Check if market already exists
    const exists = await this.contractService.marketExists(marketId);
    if (exists) {
      await this.replyToTweet(tweet.id, "💫 Market already exists for this prediction! You can place bets now.");
      return;
    }

    // Get original tweet
    const originalTweet = await this.getOriginalTweet(marketId);
    if (!originalTweet) {
      await this.replyToTweet(tweet.id, "❌ Could not find the original prediction tweet.");
      return;
    }

    // Create market
    const created = await this.contractService.createMarket(
      marketId,
      originalTweet.text,
      config.bot.defaultMarketDuration
    );

    if (created) {
      const reply = `🚀 **Prediction Market Created!**

📝 **Prediction:** "${originalTweet.text.substring(0, 150)}${originalTweet.text.length > 150 ? '...' : ''}"

⏰ **Duration:** ${config.bot.defaultMarketDuration} days
💰 **Min Bet:** ${config.bot.minBetAmount} ETH
💰 **Max Bet:** ${config.bot.maxBetAmount} ETH

🎯 **How to bet:**
Reply with: "@${config.twitter.botUsername} I bet [amount] ETH that this is true/false"

Let the predictions begin! 🎲`;

      await this.replyToTweet(tweet.id, reply);
    } else {
      await this.replyToTweet(tweet.id, "❌ Failed to create market. Please try again.");
    }
  }

  private async handleStatusRequest(tweet: TweetV2): Promise<void> {
    const marketId = tweet.conversation_id || tweet.id;
    
    const exists = await this.contractService.marketExists(marketId);
    if (!exists) {
      await this.replyToTweet(tweet.id, "❌ No market exists for this prediction yet. Reply with 'create market' to start one!");
      return;
    }

    const marketInfo = await this.contractService.getMarketInfo(marketId);
    if (!marketInfo) {
      await this.replyToTweet(tweet.id, "❌ Error retrieving market information.");
      return;
    }

    const deadline = new Date(Number(marketInfo.deadline) * 1000);
    const now = new Date();
    const timeLeft = deadline.getTime() - now.getTime();
    const daysLeft = Math.max(0, Math.ceil(timeLeft / (1000 * 60 * 60 * 24)));

    const reply = `📊 **Market Status**

${marketInfo.resolved ? '✅ RESOLVED' : '🔄 ACTIVE'}
${marketInfo.resolved ? `Outcome: ${marketInfo.outcome ? '✅ TRUE' : '❌ FALSE'}` : `⏰ ${daysLeft} days left`}

💰 **Betting Pool:**
• AGREE: ${marketInfo.totalAgree} ETH
• DISAGREE: ${marketInfo.totalDisagree} ETH
• Total: ${(parseFloat(marketInfo.totalAgree) + parseFloat(marketInfo.totalDisagree)).toFixed(4)} ETH

📈 **Stats:**
• Total Bets: ${marketInfo.betCount}
• AGREE Odds: ${this.calculateOdds(marketInfo.totalAgree, marketInfo.totalDisagree, true)}
• DISAGREE Odds: ${this.calculateOdds(marketInfo.totalAgree, marketInfo.totalDisagree, false)}`;

    await this.replyToTweet(tweet.id, reply);
  }

  private async handleHelpRequest(tweet: TweetV2): Promise<void> {
    const reply = `🤖 **Prediction Betting Bot Help**

**Commands:**
• \`@${config.twitter.botUsername} I bet [amount] ETH that this is true/false\`
• \`@${config.twitter.botUsername} create market\`
• \`@${config.twitter.botUsername} status\`
• \`@${config.twitter.botUsername} help\`

**Examples:**
• "I bet 0.1 ETH that this is true"
• "I bet 0.05 ETH that this won't happen"

**Limits:**
• Min: ${config.bot.minBetAmount} ETH
• Max: ${config.bot.maxBetAmount} ETH

Built on Base 🔵 | Powered by AgentKit ⚡`;

    await this.replyToTweet(tweet.id, reply);
  }

  private async handleUnknownCommand(tweet: TweetV2): Promise<void> {
    await this.replyToTweet(tweet.id, 
      `🤔 I didn't understand that command. Reply with "@${config.twitter.botUsername} help" to see available commands!`
    );
  }

  private async replyToTweet(tweetId: string, message: string): Promise<void> {
    try {
      await this.twitterClient.v2.reply(message, tweetId);
      console.log(`Replied to tweet ${tweetId}`);
    } catch (error) {
      console.error(`Failed to reply to tweet ${tweetId}:`, error);
    }
  }

  private async replyWithError(tweetId: string, message: string): Promise<void> {
    await this.replyToTweet(tweetId, `❌ ${message}`);
  }

  private async getOriginalTweet(conversationId: string): Promise<TweetV2 | null> {
    try {
      const tweet = await this.twitterClient.v2.singleTweet(conversationId, {
        'tweet.fields': ['author_id', 'created_at', 'conversation_id']
      });
      return tweet.data;
    } catch (error) {
      console.error(`Error fetching original tweet ${conversationId}:`, error);
      return null;
    }
  }

  private calculateOdds(totalAgree: string, totalDisagree: string, forAgree: boolean): string {
    const agree = parseFloat(totalAgree);
    const disagree = parseFloat(totalDisagree);
    const total = agree + disagree;

    if (total === 0) return "1:1";

    if (forAgree) {
      const odds = total / agree;
      return `1:${odds.toFixed(2)}`;
    } else {
      const odds = total / disagree;
      return `1:${odds.toFixed(2)}`;
    }
  }
}
```

### 9. Main Twitter Bot

`src/bot/twitter-bot.ts`:

```typescript
import { TwitterApi, TweetV2 } from 'twitter-api-v2';
import { ContractService } from '../services/contract-service';
import { MentionHandler } from './mention-handler';
import { config } from '../utils/config';

export class TwitterBot {
  private twitterClient: TwitterApi;
  private contractService: ContractService;
  private mentionHandler: MentionHandler;
  private isRunning = false;
  private lastMentionId: string | null = null;

  constructor() {
    this.twitterClient = new TwitterApi({
      appKey: config.twitter.apiKey,
      appSecret: config.twitter.apiSecret,
      accessToken: config.twitter.accessToken,
      accessSecret: config.twitter.accessSecret,
    });

    this.contractService = new ContractService();
    this.mentionHandler = new MentionHandler(this.twitterClient, this.contractService);
  }

  async start(): Promise<void> {
    console.log('🤖 Starting Prediction Betting Bot...');
    
    // Verify Twitter connection
    try {
      const user = await this.twitterClient.v2.me();
      console.log(`✅ Connected as @${user.data.username}`);
    } catch (error) {
      console.error('❌ Failed to connect to Twitter:', error);
      return;
    }

    // Verify contract connection
    try {
      await this.contractService.marketExists('test');
      console.log('✅ Smart contract connection verified');
    } catch (error) {
      console.error('❌ Failed to connect to smart contract:', error);
      return;
    }

    this.isRunning = true;
    console.log('🚀 Bot started successfully!');
    
    // Start polling for mentions
    await this.pollForMentions();
  }

  async stop(): Promise<void> {
    console.log('🛑 Stopping bot...');
    this.isRunning = false;
  }

  private async pollForMentions(): Promise<void> {
    while (this.isRunning) {
      try {
        await this.checkForNewMentions();
        await this.sleep(config.bot.pollInterval);
      } catch (error) {
        console.error('❌ Error in polling loop:', error);
        await this.sleep(5000); // Wait 5 seconds before retrying
      }
    }
  }

  private async checkForNewMentions(): Promise<void> {
    try {
      const options: any = {
        max_results: 10,
        'tweet.fields': ['conversation_id', 'in_reply_to_user_id', 'author_id', 'created_at'],
        'user.fields': ['username']
      };

      if (this.lastMentionId) {
        options.since_id = this.lastMentionId;
      }

      const mentions = await this.twitterClient.v2.userMentionTimeline(
        (await this.twitterClient.v2.me()).data.id,
        options
      );

      if (!mentions.data || mentions.data.length === 0) {
        return;
      }

      console.log(`📨 Found ${mentions.data.length} new mentions`);

      // Process mentions in chronological order (oldest first)
      const sortedMentions = mentions.data.sort((a, b) => 
        new Date(a.created_at!).getTime() - new Date(b.created_at!).getTime()
      );

      for (const mention of sortedMentions) {
        if (mention.author_id === (await this.twitterClient.v2.me()).data.id) {
          // Skip our own tweets
          continue;
        }

        console.log(`Processing mention from ${mention.author_id}: ${mention.text}`);
        await this.mentionHandler.processMention(mention);
        
        // Small delay between processing mentions
        await this.sleep(1000);
      }

      // Update last mention ID
      this.lastMentionId = sortedMentions[sortedMentions.length - 1].id;

    } catch (error) {
      if (error.code === 429) {
        console.log('⏰ Rate limited, waiting...');
        await this.sleep(60000); // Wait 1 minute for rate limit
      } else {
        console.error('❌ Error checking mentions:', error);
      }
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

### 10. Main Entry Point

`src/index.ts`:

```typescript
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
```

### 11. TypeScript Configuration

`tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "moduleResolution": "node",
    "allowSyntheticDefaultImports": true,
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### 12. Package.json Scripts

Add to your `package.json`:

```json
{
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "dev": "ts-node src/index.ts",
    "deploy:contract": "ts-node src/contracts/deploy.ts",
    "test": "echo \"No tests specified\" && exit 0"
  }
}
```

## Deployment Instructions

### 1. Environment Setup

1. Copy `.env.example` to `.env`
2. Fill in all required environment variables
3. Get Twitter API access (Basic plan minimum)
4. Set up Coinbase Developer Platform account

### 2. Smart Contract Deployment

```bash
# Deploy to Base Sepolia (testnet)
npm run deploy:contract

# Update CONTRACT_ADDRESS in .env with deployed address
```

### 3. Bot Testing

```bash
# Run in development mode
npm run dev

# Test by mentioning your bot on Twitter
```

### 4. Production Deployment

```bash
# Build the project
npm run build

# Deploy to your cloud provider (Railway, Render, etc.)
npm start
```

## Usage Examples

**Create Market:**
> @YourBot create market

**Place Bet:**
> @YourBot I bet 0.1 ETH that this is true

**Check Status:**
> @YourBot status

**Get Help:**
> @YourBot help

## Next Steps

1. **Test thoroughly** on Base Sepolia testnet
2. **Add oracle integration** for automatic resolution
3. **Implement payment processing** for easier betting
4. **Add more betting options** (custom amounts, time limits)
5. **Build web dashboard** for market analytics
6. **Scale to multiple chains** using AgentKit

## Troubleshooting

- **Twitter API errors**: Check rate limits and API plan
- **Contract errors**: Verify contract address and network
- **Bot not responding**: Check mentions and reply permissions
- **Transaction failures**: Verify gas fees and wallet balance

Start building! 🚀