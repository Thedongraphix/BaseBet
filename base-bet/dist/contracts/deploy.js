"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deployContract = deployContract;
const ethers_1 = require("ethers");
const config_1 = require("../utils/config");
const logger_1 = require("../utils/logger");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
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
async function deployContract() {
    logger_1.Logger.info('🚀 Starting contract deployment...');
    // Initialize provider based on network
    let provider;
    if (config_1.config.blockchain.network === 'base-mainnet') {
        provider = new ethers_1.ethers.JsonRpcProvider('https://mainnet.base.org');
    }
    else {
        provider = new ethers_1.ethers.JsonRpcProvider('https://sepolia.base.org');
    }
    // Initialize wallet with properly formatted private key
    const hexPrivateKey = convertPrivateKeyToHex(config_1.config.agentkit.privateKey);
    const wallet = new ethers_1.ethers.Wallet(hexPrivateKey, provider);
    logger_1.Logger.info(`📍 Deploying to: ${config_1.config.blockchain.network}`);
    logger_1.Logger.info(`🔑 From address: ${wallet.address}`);
    // Check balance
    const balance = await provider.getBalance(wallet.address);
    logger_1.Logger.info(`💰 Wallet balance: ${ethers_1.ethers.formatEther(balance)} ETH`);
    // For testing, we'll skip the balance check and use mock deployment
    if (balance < ethers_1.ethers.parseEther('0.01')) {
        logger_1.Logger.warn('⚠️  Insufficient balance for real deployment. Proceeding with mock deployment for testing.');
        logger_1.Logger.warn('⚠️  For production, fund your wallet with at least 0.01 ETH.');
    }
    else {
        logger_1.Logger.info('✅ Sufficient balance for deployment');
    }
    try {
        // Read contract source
        const contractPath = path_1.default.join(__dirname, 'PredictionBetting.sol');
        const contractSource = fs_1.default.readFileSync(contractPath, 'utf8');
        // For production, you would use a proper Solidity compiler
        // This is a simplified version - in practice, use hardhat or foundry
        logger_1.Logger.warn('⚠️  Using simplified deployment. For production, use Hardhat or Foundry.');
        // For now, let's create a mock contract deployment to test the system
        // In production, you would compile the Solidity contract to get real bytecode
        logger_1.Logger.info('📝 Creating mock contract deployment for testing...');
        // Create a mock contract address for testing
        const mockContractAddress = '0x' + '1'.repeat(40); // Mock address for testing
        logger_1.Logger.info(`✅ Mock contract deployed for testing!`);
        logger_1.Logger.info(`📍 Contract address: ${mockContractAddress}`);
        logger_1.Logger.info(`🔍 Note: This is a mock deployment for testing purposes`);
        // Update .env file with contract address
        const envPath = path_1.default.join(__dirname, '../..', '.env');
        let envContent = '';
        if (fs_1.default.existsSync(envPath)) {
            envContent = fs_1.default.readFileSync(envPath, 'utf8');
        }
        // Update or add CONTRACT_ADDRESS
        const lines = envContent.split('\n');
        let updated = false;
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].startsWith('CONTRACT_ADDRESS=')) {
                lines[i] = `CONTRACT_ADDRESS=${mockContractAddress}`;
                updated = true;
                break;
            }
        }
        if (!updated) {
            lines.push(`CONTRACT_ADDRESS=${mockContractAddress}`);
        }
        fs_1.default.writeFileSync(envPath, lines.join('\n'));
        logger_1.Logger.info('📝 Updated .env file with contract address');
        // Save deployment info
        const deploymentInfo = {
            network: config_1.config.blockchain.network,
            contractAddress: mockContractAddress,
            deployedAt: new Date().toISOString(),
            deployer: wallet.address,
            isMockDeployment: true
        };
        const deploymentPath = path_1.default.join(__dirname, '../..', 'deployment.json');
        fs_1.default.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
        logger_1.Logger.info('📄 Saved deployment info to deployment.json');
        logger_1.Logger.info('🎉 Mock deployment completed successfully!');
        logger_1.Logger.info('📋 Next steps:');
        logger_1.Logger.info('1. Test the Twitter bot functionality');
        logger_1.Logger.info('2. For production, deploy real contract using Hardhat/Foundry');
        logger_1.Logger.info('3. Update contract address in .env after real deployment');
    }
    catch (error) {
        logger_1.Logger.error('💥 Deployment failed:', error);
        process.exit(1);
    }
}
// Run deployment if called directly
if (require.main === module) {
    deployContract().catch(console.error);
}
