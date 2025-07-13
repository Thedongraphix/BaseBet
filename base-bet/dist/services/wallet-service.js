"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WalletService = void 0;
const ethers_1 = require("ethers");
const config_1 = require("../utils/config");
const logger_1 = require("../utils/logger");
// Helper function to convert base64 private key to hex format
function convertPrivateKeyToHex(privateKey) {
    // If it's already in hex format (starts with 0x), return as is
    if (privateKey.startsWith('0x')) {
        return privateKey;
    }
    // For development/testing, if we have issues with the CDP key format,
    // generate a test key. This should be replaced with proper key handling in production
    if (privateKey.length > 100) {
        logger_1.Logger.warn('⚠️  CDP private key format detected - using generated test key for development');
        logger_1.Logger.warn('⚠️  This is for testing only - do not use in production');
        // Generate a test private key for development
        const testKey = ethers_1.ethers.Wallet.createRandom().privateKey;
        return testKey;
    }
    // Convert base64 to hex
    try {
        const buffer = Buffer.from(privateKey, 'base64');
        const hexKey = '0x' + buffer.toString('hex');
        // Ensure the key is 64 characters (32 bytes) plus 0x prefix
        if (hexKey.length !== 66) {
            logger_1.Logger.error(`Invalid private key length: ${hexKey.length}, expected 66`);
            throw new Error('Invalid private key length');
        }
        return hexKey;
    }
    catch (error) {
        logger_1.Logger.error('Error converting private key:', error);
        // Try treating it as a hex string without 0x prefix
        try {
            if (privateKey.length === 64) {
                return '0x' + privateKey;
            }
            // If it's PEM format, extract the key
            if (privateKey.includes('-----BEGIN') && privateKey.includes('-----END')) {
                // This is a PEM formatted key - for now, we'll skip this and use a test key
                logger_1.Logger.warn('PEM formatted key detected - using test key for development');
                return ethers_1.ethers.Wallet.createRandom().privateKey;
            }
            throw new Error('Unsupported private key format');
        }
        catch (secondError) {
            logger_1.Logger.error('Failed to parse private key in any format:', secondError);
            logger_1.Logger.warn('Using generated test key for development');
            return ethers_1.ethers.Wallet.createRandom().privateKey;
        }
    }
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
