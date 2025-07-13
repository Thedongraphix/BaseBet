"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WalletService = void 0;
const ethers_1 = require("ethers");
const config_1 = require("../utils/config");
const logger_1 = require("../utils/logger");
// Helper function to convert private key to proper hex format
function convertPrivateKeyToHex(privateKey) {
    // If it's already in proper hex format (starts with 0x and is 66 chars), return as is
    if (privateKey.startsWith('0x') && privateKey.length === 66) {
        logger_1.Logger.info('✅ Using provided hex private key');
        return privateKey;
    }
    // If it's hex without 0x prefix and is 64 chars
    if (!privateKey.startsWith('0x') && privateKey.length === 64) {
        logger_1.Logger.info('✅ Converting hex key to proper format');
        return '0x' + privateKey;
    }
    // For very long keys (CDP format), try base64 conversion
    if (privateKey.length > 100) {
        try {
            const buffer = Buffer.from(privateKey, 'base64');
            const hexKey = '0x' + buffer.toString('hex');
            if (hexKey.length === 66) {
                logger_1.Logger.info('✅ Converted CDP base64 key to hex');
                return hexKey;
            }
        }
        catch (error) {
            logger_1.Logger.warn('Failed to convert CDP base64 key');
        }
        logger_1.Logger.warn('⚠️  CDP private key format detected - using generated test key for development');
        logger_1.Logger.warn('⚠️  This is for testing only - do not use in production');
        const testKey = ethers_1.ethers.Wallet.createRandom().privateKey;
        return testKey;
    }
    // Final fallback - generate test key
    logger_1.Logger.warn('⚠️  Unrecognized private key format - using generated test key');
    logger_1.Logger.warn('⚠️  This is for testing only - do not use in production');
    return ethers_1.ethers.Wallet.createRandom().privateKey;
}
class WalletService {
    constructor() {
        // Initialize provider based on network
        if (config_1.config.blockchain.network === 'base-mainnet') {
            this.provider = new ethers_1.ethers.JsonRpcProvider('https://mainnet.base.org');
        }
        else {
            this.provider = new ethers_1.ethers.JsonRpcProvider('https://sepolia.base.org');
        }
        // Initialize wallet with properly formatted private key
        const hexPrivateKey = convertPrivateKeyToHex(config_1.config.agentkit.privateKey);
        this.wallet = new ethers_1.ethers.Wallet(hexPrivateKey, this.provider);
    }
    /**
     * Get wallet information
     */
    async getWalletInfo() {
        try {
            const balance = await this.provider.getBalance(this.wallet.address);
            return {
                address: this.wallet.address,
                balance: ethers_1.ethers.formatEther(balance),
                network: config_1.config.blockchain.network
            };
        }
        catch (error) {
            logger_1.Logger.error('Error getting wallet info:', error);
            throw error;
        }
    }
    /**
     * Generate payment address for receiving funds
     */
    generatePaymentAddress() {
        return this.wallet.address;
    }
    /**
     * Generate payment link for easier mobile wallet interaction
     */
    generatePaymentLink(amount, purpose) {
        const paymentData = `ethereum:${this.wallet.address}?value=${ethers_1.ethers.parseEther(amount).toString()}`;
        return paymentData;
    }
    /**
     * Monitor incoming transactions for bet payments
     */
    async monitorIncomingTransactions(callback) {
        try {
            logger_1.Logger.info('📡 Starting transaction monitoring...');
            // Listen for incoming transactions
            this.provider.on('block', async (blockNumber) => {
                try {
                    const block = await this.provider.getBlock(blockNumber, true);
                    if (!block || !block.transactions)
                        return;
                    for (const tx of block.transactions) {
                        if (typeof tx === 'string')
                            continue;
                        const transaction = tx;
                        // Check if transaction is to our wallet
                        if (transaction.to === this.wallet.address && transaction.value && transaction.value > 0) {
                            logger_1.Logger.info(`💰 Incoming transaction: ${transaction.hash}`);
                            callback(transaction);
                        }
                    }
                }
                catch (error) {
                    logger_1.Logger.error('Error processing block:', error);
                }
            });
        }
        catch (error) {
            logger_1.Logger.error('Error setting up transaction monitoring:', error);
            throw error;
        }
    }
    /**
     * Send ETH to an address
     */
    async sendTransaction(to, amount, gasLimit) {
        try {
            const tx = await this.wallet.sendTransaction({
                to,
                value: ethers_1.ethers.parseEther(amount),
                gasLimit: gasLimit || 21000
            });
            logger_1.Logger.info(`📤 Transaction sent: ${tx.hash}`);
            await tx.wait();
            logger_1.Logger.info(`✅ Transaction confirmed: ${tx.hash}`);
            return tx.hash;
        }
        catch (error) {
            logger_1.Logger.error('Error sending transaction:', error);
            return null;
        }
    }
    /**
     * Check if address has sufficient balance
     */
    async hasBalance(address, minAmount) {
        try {
            const balance = await this.provider.getBalance(address);
            return balance >= ethers_1.ethers.parseEther(minAmount);
        }
        catch (error) {
            logger_1.Logger.error('Error checking balance:', error);
            return false;
        }
    }
    /**
     * Get transaction details
     */
    async getTransaction(hash) {
        try {
            return await this.provider.getTransaction(hash);
        }
        catch (error) {
            logger_1.Logger.error('Error getting transaction:', error);
            return null;
        }
    }
    /**
     * Generate QR code data for payments
     */
    generateQRCodeData(amount, purpose) {
        const paymentData = `ethereum:${this.wallet.address}?value=${ethers_1.ethers.parseEther(amount).toString()}`;
        return paymentData;
    }
    /**
     * Format address for display
     */
    formatAddress(address) {
        return `${address.slice(0, 6)}...${address.slice(-4)}`;
    }
    /**
     * Get gas price estimate
     */
    async getGasPrice() {
        try {
            const feeData = await this.provider.getFeeData();
            return feeData.gasPrice || ethers_1.ethers.parseUnits('20', 'gwei');
        }
        catch (error) {
            logger_1.Logger.error('Error getting gas price:', error);
            return ethers_1.ethers.parseUnits('20', 'gwei');
        }
    }
    /**
     * Estimate transaction cost
     */
    async estimateTransactionCost(to, amount) {
        try {
            const gasPrice = await this.getGasPrice();
            const gasLimit = 21000n; // Standard ETH transfer
            const cost = gasPrice * gasLimit;
            return ethers_1.ethers.formatEther(cost);
        }
        catch (error) {
            logger_1.Logger.error('Error estimating transaction cost:', error);
            return '0.001'; // Default estimate
        }
    }
}
exports.WalletService = WalletService;
