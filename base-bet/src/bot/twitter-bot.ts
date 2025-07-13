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
  private startTime: Date;

  constructor() {
    // Use OAuth 1.1 for full read/write access
    this.twitterClient = new TwitterApi({
      appKey: config.twitter.apiKey,
      appSecret: config.twitter.apiSecret,
      accessToken: config.twitter.accessToken,
      accessSecret: config.twitter.accessSecret,
    });

    this.contractService = new ContractService();
    this.mentionHandler = new MentionHandler(this.twitterClient, this.contractService);
    this.startTime = new Date(); // Record when bot starts
  }

  async start(): Promise<void> {
    console.log('🤖 Starting Prediction Betting Bot...');
    
    // Verify Twitter connection and permissions
    try {
      const user = await this.twitterClient.v2.me();
      console.log(`✅ Connected as @${user.data.username} (ID: ${user.data.id})`);
      
      // Test write permissions by checking account settings
      try {
        const accountSettings = await this.twitterClient.v1.accountSettings();
        console.log('✅ Write permissions confirmed');
      } catch (writeError: any) {
        console.error('❌ Write permission error:', writeError.message);
        console.log('💡 Fix: Check your Twitter app permissions in the Developer Portal');
        console.log('💡 Ensure your app has "Read and Write" permissions');
        console.log('💡 Regenerate access tokens after changing permissions');
        return;
      }
      
    } catch (error: any) {
      console.error('❌ Failed to connect to Twitter:', error.message);
      console.log('💡 Check your Twitter API credentials in .env file');
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

    // Initialize lastMentionId to avoid processing old mentions
    await this.initializeLastMentionId();

    this.isRunning = true;
    console.log('🚀 Bot started successfully!');
    console.log('📡 Polling for mentions...');
    console.log(`⏰ Only processing mentions after: ${this.startTime.toISOString()}`);
    
    // Start polling for mentions
    await this.pollForMentions();
  }

  async stop(): Promise<void> {
    console.log('🛑 Stopping bot...');
    this.isRunning = false;
  }

  private async initializeLastMentionId(): Promise<void> {
    try {
      console.log('🔄 Getting recent mentions to avoid replying to old tweets...');
      const me = await this.twitterClient.v2.me();
      const recentMentions = await this.twitterClient.v2.userMentionTimeline(me.data.id, {
        max_results: 5,
        'tweet.fields': ['created_at']
      });

      if (recentMentions.data?.data && recentMentions.data.data.length > 0) {
        // Sort by creation time and get the most recent
        const sortedMentions = recentMentions.data.data.sort((a: TweetV2, b: TweetV2) => 
          new Date(b.created_at!).getTime() - new Date(a.created_at!).getTime()
        );
        this.lastMentionId = sortedMentions[0].id;
        console.log(`✅ Set lastMentionId to: ${this.lastMentionId}`);
      }
    } catch (error) {
      console.log('⚠️  Could not initialize lastMentionId, will process all mentions');
    }
  }

  private async pollForMentions(): Promise<void> {
    while (this.isRunning) {
      try {
        await this.checkForNewMentions();
        await this.sleep(config.bot.pollInterval);
      } catch (error: any) {
        console.error('❌ Error in polling loop:', error.message);
        
        // Handle rate limiting
        if (error.code === 429) {
          console.log('⏰ Rate limited, waiting 5 minutes...');
          await this.sleep(300000); // Wait 5 minutes
        } else {
          await this.sleep(5000); // Wait 5 seconds before retrying
        }
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

      // Get current user ID for mention timeline
      const me = await this.twitterClient.v2.me();
      const mentions = await this.twitterClient.v2.userMentionTimeline(me.data.id, options);

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
        if (mention.author_id === me.data.id) {
          // Skip our own tweets
          continue;
        }

        // Skip mentions older than bot start time (safety check)
        const mentionTime = new Date(mention.created_at!);
        if (mentionTime < this.startTime) {
          console.log(`⏭️  Skipping old mention from ${mentionTime.toISOString()}`);
          continue;
        }

        console.log(`\n🔄 Processing mention from ${mention.author_id}:`);
        console.log(`📝 "${mention.text}"`);
        console.log(`⏰ Created: ${mention.created_at}`);
        
        try {
          await this.mentionHandler.processMention(mention);
          console.log(`✅ Processed mention ${mention.id}`);
        } catch (mentionError: any) {
          console.error(`❌ Error processing mention ${mention.id}:`, mentionError.message);
          
          // Handle specific Twitter API errors
          if (mentionError.code === 403) {
            console.log('💡 403 Error - Check bot permissions:');
            console.log('   - App must have "Read and Write" permissions');
            console.log('   - Access tokens must be regenerated after permission changes');
            console.log('   - Bot account must not be restricted');
            console.log('   - Verify you\'re not blocked by the user');
          } else if (mentionError.code === 429) {
            console.log('💡 Rate limited - will retry in next cycle');
            break; // Stop processing mentions for this cycle
          }
        }
        
        // Small delay between processing mentions
        await this.sleep(2000);
      }

      // Update last mention ID
      if (sortedMentions.length > 0) {
        this.lastMentionId = sortedMentions[sortedMentions.length - 1].id;
      }

    } catch (error: any) {
      if (error.code === 429) {
        console.log('⏰ Rate limited on mentions check, waiting...');
        await this.sleep(60000); // Wait 1 minute for rate limit
      } else {
        console.error('❌ Error checking mentions:', error.message);
        
        // Provide specific guidance for common errors
        if (error.message.includes('Could not authenticate')) {
          console.log('💡 Authentication error - check your Twitter API credentials');
        } else if (error.message.includes('forbidden')) {
          console.log('💡 Permission error - check your Twitter app permissions');
        }
      }
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
} 