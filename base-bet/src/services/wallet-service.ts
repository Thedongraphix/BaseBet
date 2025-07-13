import { ethers } from 'ethers';
import { config } from '../utils/config';
import { Logger } from '../utils/logger';

export interface PaymentRequest {
  amount: string;
  recipient: string;
  purpose: string;
}

export interface WalletInfo {
  address: string;
  balance: string;
  network: string;
}

// Helper function to convert private key to proper hex format
function convertPrivateKeyToHex(privateKey: string): string {
  // If it's already in proper hex format (starts with 0x and is 66 chars), return as is
  if (privateKey.startsWith('0x') && privateKey.length === 66) {
    Logger.info('✅ Using provided hex private key');
    return privateKey;
  }
  
  // If it's hex without 0x prefix and is 64 chars
  if (!privateKey.startsWith('0x') && privateKey.length === 64) {
    Logger.info('✅ Converting hex key to proper format');
    return '0x' + privateKey;
  }
  
  // For very long keys (CDP format), try base64 conversion
  if (privateKey.length > 100) {
    try {
      const buffer = Buffer.from(privateKey, 'base64');
      const hexKey = '0x' + buffer.toString('hex');
      if (hexKey.length === 66) {
        Logger.info('✅ Converted CDP base64 key to hex');
        return hexKey;
      }
    } catch (error) {
      Logger.warn('Failed to convert CDP base64 key');
    }
    
    Logger.warn('⚠️  CDP private key format detected - using generated test key for development');
    Logger.warn('⚠️  This is for testing only - do not use in production');
    const testKey = ethers.Wallet.createRandom().privateKey;
    return testKey;
  }
  
  // Final fallback - generate test key
  Logger.warn('⚠️  Unrecognized private key format - using generated test key');
  Logger.warn('⚠️  This is for testing only - do not use in production');
  return ethers.Wallet.createRandom().privateKey;
}

export class WalletService {
  private provider: ethers.Provider;
  private wallet: ethers.Wallet;

  constructor() {
    // Initialize provider based on network
    if (config.blockchain.network === 'base-mainnet') {
      this.provider = new ethers.JsonRpcProvider('https://mainnet.base.org');
    } else {
      this.provider = new ethers.JsonRpcProvider('https://sepolia.base.org');
    }

    // Initialize wallet with properly formatted private key
    const hexPrivateKey = convertPrivateKeyToHex(config.agentkit.privateKey);
    this.wallet = new ethers.Wallet(hexPrivateKey, this.provider);
  }

  /**
   * Get wallet information
   */
  async getWalletInfo(): Promise<WalletInfo> {
    try {
      const balance = await this.provider.getBalance(this.wallet.address);
      
      return {
        address: this.wallet.address,
        balance: ethers.formatEther(balance),
        network: config.blockchain.network
      };
    } catch (error) {
      Logger.error('Error getting wallet info:', error);
      throw error;
    }
  }

  /**
   * Generate payment address for receiving funds
   */
  generatePaymentAddress(): string {
    return this.wallet.address;
  }

  /**
   * Generate payment link for easier mobile wallet interaction
   */
  generatePaymentLink(amount: string, purpose: string): string {
    const paymentData = `ethereum:${this.wallet.address}?value=${ethers.parseEther(amount).toString()}`;
    return paymentData;
  }

  /**
   * Monitor incoming transactions for bet payments
   */
  async monitorIncomingTransactions(callback: (tx: ethers.TransactionResponse) => void): Promise<void> {
    try {
      Logger.info('📡 Starting transaction monitoring...');
      
      // Listen for incoming transactions
      this.provider.on('block', async (blockNumber) => {
        try {
          const block = await this.provider.getBlock(blockNumber, true);
          if (!block || !block.transactions) return;

          for (const tx of block.transactions) {
            if (typeof tx === 'string') continue;
            
            const transaction = tx as ethers.TransactionResponse;
            // Check if transaction is to our wallet
            if (transaction.to === this.wallet.address && transaction.value && transaction.value > 0) {
              Logger.info(`💰 Incoming transaction: ${transaction.hash}`);
              callback(transaction);
            }
          }
        } catch (error) {
          Logger.error('Error processing block:', error);
        }
      });
    } catch (error) {
      Logger.error('Error setting up transaction monitoring:', error);
      throw error;
    }
  }

  /**
   * Send ETH to an address
   */
  async sendTransaction(to: string, amount: string, gasLimit?: number): Promise<string | null> {
    try {
      const tx = await this.wallet.sendTransaction({
        to,
        value: ethers.parseEther(amount),
        gasLimit: gasLimit || 21000
      });

      Logger.info(`📤 Transaction sent: ${tx.hash}`);
      await tx.wait();
      Logger.info(`✅ Transaction confirmed: ${tx.hash}`);
      
      return tx.hash;
    } catch (error) {
      Logger.error('Error sending transaction:', error);
      return null;
    }
  }

  /**
   * Check if address has sufficient balance
   */
  async hasBalance(address: string, minAmount: string): Promise<boolean> {
    try {
      const balance = await this.provider.getBalance(address);
      return balance >= ethers.parseEther(minAmount);
    } catch (error) {
      Logger.error('Error checking balance:', error);
      return false;
    }
  }

  /**
   * Get transaction details
   */
  async getTransaction(hash: string): Promise<ethers.TransactionResponse | null> {
    try {
      return await this.provider.getTransaction(hash);
    } catch (error) {
      Logger.error('Error getting transaction:', error);
      return null;
    }
  }

  /**
   * Generate QR code data for payments
   */
  generateQRCodeData(amount: string, purpose: string): string {
    const paymentData = `ethereum:${this.wallet.address}?value=${ethers.parseEther(amount).toString()}`;
    return paymentData;
  }

  /**
   * Format address for display
   */
  formatAddress(address: string): string {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }

  /**
   * Get gas price estimate
   */
  async getGasPrice(): Promise<bigint> {
    try {
      const feeData = await this.provider.getFeeData();
      return feeData.gasPrice || ethers.parseUnits('20', 'gwei');
    } catch (error) {
      Logger.error('Error getting gas price:', error);
      return ethers.parseUnits('20', 'gwei');
    }
  }

  /**
   * Estimate transaction cost
   */
  async estimateTransactionCost(to: string, amount: string): Promise<string> {
    try {
      const gasPrice = await this.getGasPrice();
      const gasLimit = 21000n; // Standard ETH transfer
      const cost = gasPrice * gasLimit;
      return ethers.formatEther(cost);
    } catch (error) {
      Logger.error('Error estimating transaction cost:', error);
      return '0.001'; // Default estimate
    }
  }
} 