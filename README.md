#  Betting Mini App on base

🎯 **A prediction betting mini app built for Farcaster using MiniKit and Base blockchain**

## Why Farcaster over Twitter?

✅ **Native onchain integration** - Built specifically for Base blockchain  
✅ **No API rate limits** - No Twitter API restrictions  
✅ **Better UX** - Frame-based interactions are more intuitive  
✅ **Built-in wallet connectivity** - Seamless crypto transactions  
✅ **Crypto-native audience** - Users already understand betting/DeFi  
✅ **Real-time notifications** - Built-in notification system  
✅ **OnchainKit compatibility** - Professional UI components  

## Features

- 🎯 **Create Prediction Markets** - Turn any prediction into a betting market
- 💰 **Place Bets** - Bet ETH on true/false outcomes
- 📊 **Live Statistics** - Real-time betting pools and odds
- 🔔 **Notifications** - Get notified about market events
- 🔗 **Base Integration** - Secure smart contracts on Base Sepolia
- 📱 **Mobile Friendly** - Optimized for mobile Farcaster experience

## Quick Setup

### 1. Configure Environment
```bash
# Run the setup script to configure with working addresses
chmod +x setup-env.sh
./setup-env.sh
```

### 2. Set Required Variables
Edit `.env` and add:
```env
NEXT_PUBLIC_URL=https://your-app-url.com
NEXT_PUBLIC_ONCHAINKIT_API_KEY=your_api_key_from_coinbase
```

### 3. Generate Farcaster Manifest
```bash
npx create-onchain --manifest
```

### 4. Start Development sever
```bash
npm run dev
```

## Pre-configured Settings

The app comes pre-configured with working addresses from our previous setup:

- **Smart Contract**: `0xad8063e222D6B893eEBDe0f85C398b32f0A3cF2C` (Base Sepolia)
- **Network**: Base Sepolia (testnet)
- **Wallet**: `0x0408a00e58eCb6D4914C4fD3DA7B9316cda8651d`

## How It Works

### Creating Prediction Markets
1. User types a prediction in the app
2. Smart contract creates a new market
3. Other users can bet on true/false outcomes

### Placing Bets
1. Select AGREE or DISAGREE position
2. Choose bet amount (0.001 - 10 ETH)
3. Connect wallet and confirm transaction
4. Bet is recorded on-chain

### Market Resolution
- Markets expire after set duration (default 30 days)
- Winners receive proportional share of losing side's bets
- 2% platform fee for sustainability

## MiniKit Features Used

- **MiniKitProvider** - OnchainKit integration with Base
- **Transaction Components** - Seamless smart contract interactions
- **Identity Components** - User profiles and wallet display
- **Notification System** - Real-time updates
- **Frame Integration** - Native Farcaster experience

## Component Architecture

```
app/
├── components/
│   ├── PredictionBetting.tsx     # Main betting interface
│   ├── DemoComponents.tsx        # UI components (Button, Card, Icon)
├── page.tsx                      # Main app layout
├── providers.tsx                 # MiniKit and OnchainKit setup
└── .well-known/farcaster.json/   # Farcaster manifest
```

## Smart Contract Integration

The app uses OnchainKit's Transaction components for seamless blockchain interactions:

```typescript
<Transaction
  contracts={[{
    address: PREDICTION_CONTRACT_ADDRESS,
    abi: PREDICTION_CONTRACT_ABI,
    functionName: "createMarket",
    args: [prediction, BigInt(duration)],
  }]}
>
  <TransactionButton>Create Market</TransactionButton>
</Transaction>
```

## Deployment

### 1. Deploy to Vercel
```bash
vercel deploy
```

### 2. Update Environment
- Set `NEXT_PUBLIC_URL` to your deployed URL
- Configure Redis for notifications (optional)

### 3. Register with Farcaster
- Add your app to Farcaster directory
- Users can install as a mini app

## Development vs Production

**Development (Current)**:
- Base Sepolia testnet
- Test ETH for transactions
- Debug mode enabled

**Production (Future)**:
- Base Mainnet
- Real ETH transactions
- Production optimizations

## Next Steps

1. **Test the Mini App** - Run locally and test functionality
2. **Deploy to Vercel** - Get a public URL
3. **Generate Manifest** - Configure Farcaster integration
4. **Add to Farcaster** - Launch as a mini app
5. **Marketing** - Share with crypto prediction communities

## Benefits Over Twitter Bot

| Feature | Twitter Bot | Farcaster Mini App |
|---------|-------------|-------------------|
| Wallet Integration | Manual payment links | Native wallet connect |
| Transaction UX | External wallet steps | One-click transactions |
| Rate Limits | 1,500 tweets/month | No limits |
| Audience | General Twitter | Crypto-native users |
| Onchain UX | Basic text responses | Rich transaction UI |
| Notifications | Limited | Full notification system |

## Support

- **Smart Contract**: Already deployed and tested
- **Wallet**: Funded and working
- **UI Components**: OnchainKit professional components
- **Documentation**: Comprehensive setup guides

Ready to revolutionize prediction betting on Farcaster! 🚀 
