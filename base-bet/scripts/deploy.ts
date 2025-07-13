import { ethers } from "hardhat";
import fs from 'fs';
import path from 'path';

async function main() {
  console.log("🚀 Starting contract deployment...");

  // Get the deployer account
  const [deployer] = await ethers.getSigners();
  console.log(`🔑 Deploying from address: ${deployer.address}`);

  // Check balance
  const balance = await deployer.provider.getBalance(deployer.address);
  console.log(`💰 Account balance: ${ethers.formatEther(balance)} ETH`);

  if (balance < ethers.parseEther("0.01")) {
    throw new Error("❌ Insufficient balance for deployment. Need at least 0.01 ETH for gas fees.");
  }

  // Deploy the contract
  console.log("📝 Deploying PredictionBetting contract...");
  const PredictionBetting = await ethers.getContractFactory("PredictionBetting");
  const contract = await PredictionBetting.deploy();

  console.log("⏳ Waiting for deployment confirmation...");
  await contract.waitForDeployment();

  const contractAddress = await contract.getAddress();
  console.log(`✅ PredictionBetting deployed to: ${contractAddress}`);

  // Get network info
  const network = await ethers.provider.getNetwork();
  console.log(`📍 Network: ${network.name} (Chain ID: ${network.chainId})`);

  // Update .env file with contract address
  const envPath = path.join(__dirname, '../.env');
  let envContent = '';
  
  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf8');
  }
  
  // Update or add CONTRACT_ADDRESS
  const lines = envContent.split('\n');
  let updated = false;
  
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('CONTRACT_ADDRESS=')) {
      lines[i] = `CONTRACT_ADDRESS=${contractAddress}`;
      updated = true;
      break;
    }
  }
  
  if (!updated) {
    lines.push(`CONTRACT_ADDRESS=${contractAddress}`);
  }
  
  fs.writeFileSync(envPath, lines.join('\n'));
  console.log('📝 Updated .env file with contract address');

  // Save deployment info
  const deploymentInfo = {
    network: network.name,
    chainId: Number(network.chainId),
    contractAddress: contractAddress,
    deployedAt: new Date().toISOString(),
    deployer: deployer.address,
    deploymentBlockNumber: await ethers.provider.getBlockNumber(),
    isMockDeployment: false
  };

  const deploymentPath = path.join(__dirname, '../deployment.json');
  fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
  console.log('📄 Saved deployment info to deployment.json');

  // Verify basic contract functions
  console.log("\n🧪 Testing contract deployment...");
  
  try {
    // Test creating a market
    console.log("Testing market creation...");
    const testTx = await contract.createMarket("test123", "Test prediction", 1);
    await testTx.wait();
    console.log("✅ Market creation test passed");

    // Test market existence
    const exists = await contract.marketExists("test123");
    console.log(`✅ Market exists check: ${exists}`);

    // Get market info
    const marketInfo = await contract.getMarketInfo("test123");
    console.log(`✅ Market info retrieved: ${marketInfo[0]}`);

  } catch (error) {
    console.log("⚠️  Contract testing failed:", error);
  }

  console.log(`\n🎉 Deployment completed successfully!`);
  console.log(`📋 Contract Address: ${contractAddress}`);
  console.log(`🔍 View on BaseScan: https://${network.chainId === 84532n ? 'sepolia.' : ''}basescan.org/address/${contractAddress}`);
  console.log(`\n📋 Next steps:`);
  console.log(`1. Update your bot configuration with the new contract address`);
  console.log(`2. Test the bot with the deployed contract`);
  console.log(`3. Monitor the contract on BaseScan for transactions`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("💥 Deployment failed:", error);
    process.exit(1);
  }); 