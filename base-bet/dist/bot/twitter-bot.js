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
        this.twitterClient = new twitter_api_v2_1.TwitterApi({
            appKey: config_1.config.twitter.apiKey,
            appSecret: config_1.config.twitter.apiSecret,
            accessToken: config_1.config.twitter.accessToken,
            accessSecret: config_1.config.twitter.accessSecret,
        });
        this.contractService = new contract_service_1.ContractService();
        this.mentionHandler = new mention_handler_1.MentionHandler(this.twitterClient, this.contractService);
    }
    async start() {
        console.log('🤖 Starting Prediction Betting Bot...');
        // Verify Twitter connection
        try {
            const user = await this.twitterClient.v2.me();
            console.log(`✅ Connected as @${user.data.username}`);
        }
        catch (error) {
            console.error('❌ Failed to connect to Twitter:', error);
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
        this.isRunning = true;
        console.log('🚀 Bot started successfully!');
        // Start polling for mentions
        await this.pollForMentions();
    }
    async stop() {
        console.log('🛑 Stopping bot...');
        this.isRunning = false;
    }
    async pollForMentions() {
        while (this.isRunning) {
            try {
                await this.checkForNewMentions();
                await this.sleep(config_1.config.bot.pollInterval);
            }
            catch (error) {
                console.error('❌ Error in polling loop:', error);
                await this.sleep(5000); // Wait 5 seconds before retrying
            }
        }
    }
    async checkForNewMentions() {
        try {
            const options = {
                max_results: 10,
                'tweet.fields': ['conversation_id', 'in_reply_to_user_id', 'author_id', 'created_at'],
                'user.fields': ['username']
            };
            if (this.lastMentionId) {
                options.since_id = this.lastMentionId;
            }
            const mentions = await this.twitterClient.v2.userMentionTimeline((await this.twitterClient.v2.me()).data.id, options);
            const mentionTweets = mentions.data?.data || [];
            if (mentionTweets.length === 0) {
                return;
            }
            console.log(`📨 Found ${mentionTweets.length} new mentions`);
            // Process mentions in chronological order (oldest first)
            const sortedMentions = mentionTweets.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
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
        }
        catch (error) {
            if (error && typeof error === 'object' && 'code' in error && error.code === 429) {
                console.log('⏰ Rate limited, waiting...');
                await this.sleep(60000); // Wait 1 minute for rate limit
            }
            else {
                console.error('❌ Error checking mentions:', error);
            }
        }
    }
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
exports.TwitterBot = TwitterBot;
