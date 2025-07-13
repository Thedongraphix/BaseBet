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

      const mentionTweets = mentions.data?.data || [];

      if (mentionTweets.length === 0) {
        return;
      }

      console.log(`📨 Found ${mentionTweets.length} new mentions`);

      // Process mentions in chronological order (oldest first)
      const sortedMentions = mentionTweets.sort((a: TweetV2, b: TweetV2) => 
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
      if (error && typeof error === 'object' && 'code' in error && error.code === 429) {
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