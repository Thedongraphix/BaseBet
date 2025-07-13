import { ethers } from 'ethers';
import { config } from '../utils/config';

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

    this.wallet = new ethers.Wallet(config.agentkit.privateKey, this.provider);

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
      return await this.contract.marketExists(tweetId);
    } catch (error) {
      console.error('Error checking market existence:', error);
      return false;
    }
  }

  async getMarketInfo(tweetId: string) {
    try {
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
      const amount = await this.contract.pendingWithdrawals(address);
      return ethers.formatEther(amount);
    } catch (error) {
      console.error('Error getting pending withdrawals:', error);
      return '0';
    }
  }

  async withdraw(): Promise<boolean> {
    try {
      const tx = await this.contract.withdraw();
      await tx.wait();
      return true;
    } catch (error) {
      console.error('Error withdrawing:', error);
      return false;
    }
  }
} 