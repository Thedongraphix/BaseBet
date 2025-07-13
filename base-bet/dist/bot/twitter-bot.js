"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TwitterBot = void 0;
const twitter_api_v2_1 = require("twitter-api-v2");
const contract_service_1 = require("../services/contract-service");
const mention_handler_1 = require("./mention-handler");
const config_1 = require("../utils/config");
class TwitterBot {
    constructor() {
        this.isRunning = false;
        this.lastMentionId = null;
        this.userId = null; // Cache user ID to avoid repeated API calls
        // Use OAuth 1.1 for full read/write access
        this.twitterClient = new twitter_api_v2_1.TwitterApi({
            appKey: config_1.config.twitter.apiKey,
            appSecret: config_1.config.twitter.apiSecret,
            accessToken: config_1.config.twitter.accessToken,
            accessSecret: config_1.config.twitter.accessSecret,
        });
        this.contractService = new contract_service_1.ContractService();
        this.mentionHandler = new mention_handler_1.MentionHandler(this.twitterClient, this.contractService);
        this.startTime = new Date(); // Record when bot starts
    }
    async start() {
        console.log('🤖 Starting Prediction Betting Bot...');
        // Verify Twitter connection and permissions with retry logic
        let connected = false;
        let retryCount = 0;
        const maxRetries = 3;
        while (!connected && retryCount < maxRetries) {
            try {
                console.log(`🔄 Attempting to connect to Twitter (attempt ${retryCount + 1}/${maxRetries})...`);
                const user = await this.twitterClient.v2.me();
                this.userId = user.data.id; // Cache user ID
                console.log(`✅ Connected as @${user.data.username} (ID: ${user.data.id})`);
                // Test write permissions by checking account settings
                try {
                    const accountSettings = await this.twitterClient.v1.accountSettings();
                    console.log('✅ Write permissions confirmed');
                    connected = true;
                }
                catch (writeError) {
                    console.error('❌ Write permission error:', writeError.message);
                    console.log('💡 Fix: Check your Twitter app permissions in the Developer Portal');
                    console.log('💡 Ensure your app has "Read and Write" permissions');
                    console.log('💡 Regenerate access tokens after changing permissions');
                    if (writeError.code !== 429) {
                        return; // Non-rate-limit error, don't retry
                    }
                }
            }
            catch (error) {
                console.error('❌ Failed to connect to Twitter:', error.message);
                if (error.code === 429) {
                    retryCount++;
                    if (retryCount < maxRetries) {
                        const waitTime = Math.pow(2, retryCount) * 5; // Exponential backoff: 10s, 20s, 40s
                        console.log(`⏰ Rate limited! Waiting ${waitTime} seconds before retry...`);
                        console.log('💡 Twitter API rate limits: 300 requests per 15-minute window');
                        console.log('💡 If this persists, wait 15 minutes before restarting');
                        await this.sleep(waitTime * 1000);
                    }
                    else {
                        console.log('❌ Max retries exceeded. Please wait 15 minutes and try again.');
                        console.log('💡 You can check Twitter API rate limits at: https://developer.twitter.com/en/docs/twitter-api/rate-limits');
                        return;
                    }
                }
                else {
                    console.log('💡 Check your Twitter API credentials in .env file');
                    console.log('💡 Verify your Twitter app is configured correctly');
                    return;
                }
            }
        }
        if (!connected) {
            console.log('❌ Failed to connect to Twitter after multiple retries');
            return;
        }
        // Verify contract connection
        try {
            await this.contractService.marketExists('test');
            console.log('✅ Smart contract connection verified');
        }
        catch (error) {
            console.error('❌ Failed to connect to smart contract:', error);
            return;
        }
        // Initialize lastMentionId to avoid processing old mentions
        await this.initializeLastMentionId();
        this.isRunning = true;
        console.log('🚀 Bot started successfully!');
        console.log('📡 Polling for mentions...');
        console.log(`⏰ Only processing mentions after: ${this.formatEATTime(this.startTime)}`);
        // Start polling for mentions
        await this.pollForMentions();
    }
    async stop() {
        console.log('🛑 Stopping bot...');
        this.isRunning = false;
    }
    async initializeLastMentionId() {
        try {
            console.log('🔄 Getting recent mentions to avoid replying to old tweets...');
            if (!this.userId) {
                console.log('⚠️  User ID not available, skipping mention initialization');
                return;
            }
            const recentMentions = await this.twitterClient.v2.userMentionTimeline(this.userId, {
                max_results: 5,
                'tweet.fields': ['created_at']
            });
            if (recentMentions.data?.data && recentMentions.data.data.length > 0) {
                // Sort by creation time and get the most recent
                const sortedMentions = recentMentions.data.data.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
                this.lastMentionId = sortedMentions[0].id;
                console.log(`✅ Set lastMentionId to: ${this.lastMentionId}`);
            }
        }
        catch (error) {
            if (error.code === 429) {
                console.log('⚠️  Rate limited during initialization, will process all mentions');
                console.log('⚠️  This is normal if you just started the bot');
            }
            else {
                console.log('⚠️  Could not initialize lastMentionId, will process all mentions');
            }
        }
    }
    async pollForMentions() {
        console.log('🔄 Starting mention polling loop...');
        while (this.isRunning) {
            try {
                await this.checkForNewMentions();
                await this.sleep(config_1.config.bot.pollInterval);
            }
            catch (error) {
                console.error('❌ Error in polling loop:', error.message);
                // Handle rate limiting
                if (error.code === 429) {
                    console.log('⏰ Rate limited in polling loop, waiting 5 minutes...');
                    await this.sleep(300000); // Wait 5 minutes
                }
                else {
                    console.log('⚠️  Non-rate-limit error, waiting 30 seconds...');
                    await this.sleep(30000); // Wait 30 seconds before retrying
                }
            }
        }
    }
    async checkForNewMentions() {
        try {
            if (!this.userId) {
                console.log('⚠️  User ID not available, skipping mention check');
                return;
            }
            const options = {
                max_results: 10,
                'tweet.fields': ['conversation_id', 'in_reply_to_user_id', 'author_id', 'created_at'],
                'user.fields': ['username']
            };
            if (this.lastMentionId) {
                options.since_id = this.lastMentionId;
            }
            console.log(`🔍 Checking for mentions since: ${this.lastMentionId || 'beginning'} at ${this.formatEATTime(new Date())}`);
            const mentions = await this.twitterClient.v2.userMentionTimeline(this.userId, options);
            const mentionTweets = mentions.data?.data || [];
            if (mentionTweets.length === 0) {
                console.log('📭 No new mentions found');
                return;
            }
            console.log(`📨 Found ${mentionTweets.length} new mentions`);
            // Process mentions in chronological order (oldest first)
            const sortedMentions = mentionTweets.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
            for (const mention of sortedMentions) {
                if (mention.author_id === this.userId) {
                    // Skip our own tweets
                    continue;
                }
                // Skip mentions older than bot start time (safety check)
                const mentionTime = new Date(mention.created_at);
                if (mentionTime < this.startTime) {
                    console.log(`⏭️  Skipping old mention from ${this.formatEATTime(mentionTime)}`);
                    continue;
                }
                console.log(`\n🔄 Processing mention from ${mention.author_id}:`);
                console.log(`📝 "${mention.text}"`);
                console.log(`⏰ Created: ${this.formatEATTime(mentionTime)}`);
                try {
                    await this.mentionHandler.processMention(mention);
                    console.log(`✅ Processed mention ${mention.id} at ${this.formatEATTime(new Date())}`);
                }
                catch (mentionError) {
                    console.error(`❌ Error processing mention ${mention.id}:`, mentionError.message);
                    // Handle specific Twitter API errors
                    if (mentionError.code === 403) {
                        console.log('💡 403 Error - Check bot permissions:');
                        console.log('   - App must have "Read and Write" permissions');
                        console.log('   - Access tokens must be regenerated after permission changes');
                        console.log('   - Bot account must not be restricted');
                        console.log('   - Verify you\'re not blocked by the user');
                    }
                    else if (mentionError.code === 429) {
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
                console.log(`🔄 Updated lastMentionId to: ${this.lastMentionId}`);
            }
        }
        catch (error) {
            if (error.code === 429) {
                console.log(`⏰ Rate limited on mentions check at ${this.formatEATTime(new Date())}`);
                console.log('⏰ This is normal - waiting for next cycle...');
                // Don't throw error, just wait for next cycle
            }
            else {
                console.error('❌ Error checking mentions:', error.message);
                // Provide specific guidance for common errors
                if (error.message.includes('Could not authenticate')) {
                    console.log('💡 Authentication error - check your Twitter API credentials');
                }
                else if (error.message.includes('forbidden')) {
                    console.log('💡 Permission error - check your Twitter app permissions');
                }
                // Re-throw non-rate-limit errors
                throw error;
            }
        }
    }
    formatEATTime(date) {
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
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
exports.TwitterBot = TwitterBot;
