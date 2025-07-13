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
  private userId: string | null = null; // Cache user ID to avoid repeated API calls
  private hasBeenMentioned = false; // Track if bot has been mentioned before
  private isFirstRun = true; // Track first run to avoid unnecessary initialization calls

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
    
    // Only verify connection once - don't retry to save API calls
    try {
      console.log('🔄 Connecting to Twitter (single attempt to save API calls)...');
      
      const user = await this.twitterClient.v2.me();
      this.userId = user.data.id; // Cache user ID
      console.log(`✅ Connected as @${user.data.username} (ID: ${user.data.id})`);
      
      // Test write permissions
      try {
        const accountSettings = await this.twitterClient.v1.accountSettings();
        console.log('✅ Write permissions confirmed');
      } catch (writeError: any) {
        console.error('❌ Write permission error:', writeError.message);
        console.log('💡 Fix: Check your Twitter app permissions in the Developer Portal');
        console.log('💡 Ensure your app has "Read and Write" permissions');
        console.log('💡 Regenerate access tokens after changing permissions');
        if (writeError.code === 429) {
          console.log('⏰ Rate limited during startup. Wait 15 minutes and restart.');
          return;
        }
        return;
      }
      
    } catch (error: any) {
      console.error('❌ Failed to connect to Twitter:', error.message);
      
      if (error.code === 429) {
        console.log('⏰ Rate limited! You have used too many API calls.');
        console.log('💡 Current usage: Check your Twitter Developer Dashboard');
        console.log('💡 Wait 15 minutes for rate limit reset, then restart');
        console.log('💡 The bot is now optimized to use fewer API calls');
        return;
      } else {
        console.log('💡 Check your Twitter API credentials in .env file');
        return;
      }
    }

    // Verify contract connection
    try {
      await this.contractService.marketExists('test');
      console.log('✅ Smart contract connection verified');
    } catch (error) {
      console.error('❌ Failed to connect to smart contract:', error);
      return;
    }

    // Skip initialization API calls to save rate limit
    console.log('⚡ Skipping mention initialization to save API calls');
    console.log('💡 Bot will start monitoring after first mention is detected');

    this.isRunning = true;
    console.log('🚀 Bot started successfully!');
    console.log('📡 Smart polling enabled - will only check for mentions when needed');
    console.log(`⏰ Bot active since: ${this.formatEATTime(this.startTime)}`);
    
    // Start intelligent polling
    await this.intelligentPollForMentions();
  }

  async stop(): Promise<void> {
    console.log('🛑 Stopping bot...');
    this.isRunning = false;
  }

  /**
   * Intelligent polling that adapts based on activity
   */
  private async intelligentPollForMentions(): Promise<void> {
    console.log('🧠 Starting intelligent mention polling...');
    
    let consecutiveEmptyChecks = 0;
    let currentInterval = config.bot.pollInterval; // Start with 60 seconds
    const maxInterval = 600000; // Max 10 minutes between checks
    const minInterval = config.bot.pollInterval; // Min 60 seconds
    
    while (this.isRunning) {
      try {
        const foundMentions = await this.checkForNewMentions();
        
        if (foundMentions > 0) {
          // Found mentions - reset to frequent checking
          consecutiveEmptyChecks = 0;
          currentInterval = minInterval;
          this.hasBeenMentioned = true;
          console.log(`🔥 Active mode: Found ${foundMentions} mentions, checking every ${currentInterval/1000}s`);
        } else {
          // No mentions found
          consecutiveEmptyChecks++;
          
          if (!this.hasBeenMentioned) {
            // Bot hasn't been mentioned yet - use longer intervals
            currentInterval = Math.min(maxInterval, 300000); // 5 minutes max for first-time
            console.log(`😴 Waiting mode: No mentions yet, checking every ${currentInterval/60000} minutes`);
          } else {
            // Bot has been mentioned before - gradually increase interval
            if (consecutiveEmptyChecks >= 3) {
              currentInterval = Math.min(maxInterval, currentInterval * 1.5);
              console.log(`🐌 Quiet mode: ${consecutiveEmptyChecks} empty checks, interval now ${currentInterval/60000} minutes`);
            }
          }
        }
        
        await this.sleep(currentInterval);
        
      } catch (error: any) {
        console.error('❌ Error in polling loop:', error.message);
        
        // Handle rate limiting
        if (error.code === 429) {
          console.log('⏰ Rate limited in polling loop, switching to quiet mode...');
          console.log('💡 Waiting 15 minutes for rate limit reset');
          await this.sleep(900000); // Wait 15 minutes
          currentInterval = maxInterval; // Use long intervals after rate limit
        } else {
          console.log('⚠️  Non-rate-limit error, waiting 2 minutes...');
          await this.sleep(120000); // Wait 2 minutes before retrying
        }
      }
    }
  }

  /**
   * Check for new mentions - returns number of mentions found
   */
  private async checkForNewMentions(): Promise<number> {
    try {
      if (!this.userId) {
        console.log('⚠️  User ID not available, skipping mention check');
        return 0;
      }

      const options: any = {
        max_results: 10,
        'tweet.fields': ['conversation_id', 'in_reply_to_user_id', 'author_id', 'created_at'],
        'user.fields': ['username']
      };

      if (this.lastMentionId) {
        options.since_id = this.lastMentionId;
      }

      console.log(`🔍 Checking for mentions at ${this.formatEATTime(new Date())}`);
      
      const mentions = await this.twitterClient.v2.userMentionTimeline(this.userId, options);

      const mentionTweets = mentions.data?.data || [];

      if (mentionTweets.length === 0) {
        console.log('📭 No new mentions found');
        return 0;
      }

      console.log(`📨 Found ${mentionTweets.length} new mentions - PROCESSING NOW`);

      // Process mentions in chronological order (oldest first)
      const sortedMentions = mentionTweets.sort((a: TweetV2, b: TweetV2) => 
        new Date(a.created_at!).getTime() - new Date(b.created_at!).getTime()
      );

      let processedCount = 0;

      for (const mention of sortedMentions) {
        if (mention.author_id === this.userId) {
          // Skip our own tweets
          continue;
        }

        // Skip mentions older than bot start time (safety check)
        const mentionTime = new Date(mention.created_at!);
        if (mentionTime < this.startTime) {
          console.log(`⏭️  Skipping old mention from ${this.formatEATTime(mentionTime)}`);
          continue;
        }

        console.log(`\n🔄 Processing mention ${processedCount + 1}/${mentionTweets.length}:`);
        console.log(`👤 From: ${mention.author_id}`);
        console.log(`📝 Text: "${mention.text}"`);
        console.log(`⏰ Created: ${this.formatEATTime(mentionTime)}`);
        
        try {
          await this.mentionHandler.processMention(mention);
          console.log(`✅ Processed mention ${mention.id} at ${this.formatEATTime(new Date())}`);
          processedCount++;
        } catch (mentionError: any) {
          console.error(`❌ Error processing mention ${mention.id}:`, mentionError.message);
          
          // Handle specific Twitter API errors
          if (mentionError.code === 403) {
            console.log('💡 403 Error - Check bot permissions');
          } else if (mentionError.code === 429) {
            console.log('💡 Rate limited during mention processing - will retry later');
            break; // Stop processing mentions for this cycle
          }
        }
        
        // Delay between processing mentions to avoid rate limits
        await this.sleep(3000); // 3 second delay
      }

      // Update last mention ID only if we processed mentions
      if (processedCount > 0) {
        this.lastMentionId = sortedMentions[sortedMentions.length - 1].id;
        console.log(`🔄 Updated lastMentionId to: ${this.lastMentionId}`);
      }

      return processedCount;

    } catch (error: any) {
      if (error.code === 429) {
        console.log(`⏰ Rate limited during mention check at ${this.formatEATTime(new Date())}`);
        console.log('📊 API Usage: You may be hitting your daily/hourly limits');
        console.log('💡 Check your Twitter Developer Dashboard for usage stats');
        // Don't throw error, just return 0
        return 0;
      } else {
        console.error('❌ Error checking mentions:', error.message);
        
        // Provide specific guidance for common errors
        if (error.message.includes('Could not authenticate')) {
          console.log('💡 Authentication error - check your Twitter API credentials');
        } else if (error.message.includes('forbidden')) {
          console.log('💡 Permission error - check your Twitter app permissions');
        }
        
        // Re-throw non-rate-limit errors
        throw error;
      }
    }
  }

  private formatEATTime(date: Date): string {
    // Convert to EAT (UTC+3)
    const eatOffset = 3 * 60; // 3 hours in minutes
    const utc = date.getTime() + (date.getTimezoneOffset() * 60000);
    const eatTime = new Date(utc + (eatOffset * 60000));
    
    return eatTime.toLocaleString('en-US', {
      timeZone: 'Africa/Nairobi',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    }) + ' EAT';
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}