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