import { ethers } from 'ethers';
import { config } from '../utils/config';

// Helper function to convert private key to proper hex format
function convertPrivateKeyToHex(privateKey: string): string {
  // If it's already in proper hex format (starts with 0x and is 66 chars), return as is
  if (privateKey.startsWith('0x') && privateKey.length === 66) {
    console.log('✅ Using provided hex private key');
    return privateKey;
  }
  
  // If it's hex without 0x prefix and is 64 chars
  if (!privateKey.startsWith('0x') && privateKey.length === 64) {
    console.log('✅ Converting hex key to proper format');
    return '0x' + privateKey;
  }
  
  // For very long keys (CDP format), try base64 conversion
  if (privateKey.length > 100) {
    try {
      const buffer = Buffer.from(privateKey, 'base64');
      const hexKey = '0x' + buffer.toString('hex');
      if (hexKey.length === 66) {
        console.log('✅ Converted CDP base64 key to hex');
        return hexKey;
      }
    } catch (error) {
      console.warn('Failed to convert CDP base64 key');
    }
    
    console.warn('⚠️  CDP private key format detected - using generated test key for development');
    console.warn('⚠️  This is for testing only - do not use in production');
    const testKey = ethers.Wallet.createRandom().privateKey;
    return testKey;
  }
  
  // Final fallback - generate test key
  console.warn('⚠️  Unrecognized private key format - using generated test key');
  console.warn('⚠️  This is for testing only - do not use in production');
  return ethers.Wallet.createRandom().privateKey;
}

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

    // Initialize wallet with properly formatted private key
    const hexPrivateKey = convertPrivateKeyToHex(config.agentkit.privateKey);
    this.wallet = new ethers.Wallet(hexPrivateKey, this.provider);

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
      // For mock deployment, simulate market creation
      if (config.blockchain.contractAddress === '0x1111111111111111111111111111111111111111') {
        console.log(`📝 Mock: Creating market for tweet ${tweetId}`);
        console.log(`📄 Prediction: ${prediction}`);
        console.log(`⏰ Duration: ${durationDays} days`);
        return true;
      }

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
      // For mock deployment, simulate market existence check
      if (config.blockchain.contractAddress === '0x1111111111111111111111111111111111111111') {
        console.log(`🔍 Mock: Checking if market exists for tweet ${tweetId}`);
        return false; // Always return false for mock to allow testing
      }

      return await this.contract.marketExists(tweetId);
    } catch (error) {
      console.error('Error checking market existence:', error);
      return false;
    }
  }

  async getMarketInfo(tweetId: string) {
    try {
      // For mock deployment, return mock market info
      if (config.blockchain.contractAddress === '0x1111111111111111111111111111111111111111') {
        console.log(`📊 Mock: Getting market info for tweet ${tweetId}`);
        return {
          prediction: "Mock prediction for testing",
          deadline: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60), // 30 days from now
          resolved: false,
          outcome: false,
          totalAgree: "0.1",
          totalDisagree: "0.05",
          betCount: "3"
        };
      }

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
      // For mock deployment, simulate bet placement
      if (config.blockchain.contractAddress === '0x1111111111111111111111111111111111111111') {
        console.log(`💰 Mock: Placing bet for tweet ${tweetId}`);
        console.log(`🎯 Position: ${position ? 'AGREE' : 'DISAGREE'}`);
        console.log(`💵 Amount: ${amount} ETH`);
        return true;
      }

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
      // For mock deployment, return mock withdrawal amount
      if (config.blockchain.contractAddress === '0x1111111111111111111111111111111111111111') {
        console.log(`💸 Mock: Getting pending withdrawals for ${address}`);
        return "0.025";
      }

      const amount = await this.contract.pendingWithdrawals(address);
      return ethers.formatEther(amount);
    } catch (error) {
      console.error('Error getting pending withdrawals:', error);
      return '0';
    }
  }

  async withdraw(): Promise<boolean> {
    try {
      // For mock deployment, simulate withdrawal
      if (config.blockchain.contractAddress === '0x1111111111111111111111111111111111111111') {
        console.log(`💰 Mock: Withdrawing funds`);
        return true;
      }

      const tx = await this.contract.withdraw();
      await tx.wait();
      return true;
    } catch (error) {
      console.error('Error withdrawing:', error);
      return false;
    }
  }
} 