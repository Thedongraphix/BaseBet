#!/bin/bash

echo "🎯 Setting up Farcaster Prediction Betting App Environment"
echo "================================================================"

# Backup existing .env if it exists
if [ -f .env ]; then
    cp .env .env.backup
    echo "✅ Backed up existing .env to .env.backup"
fi

# Create .env file with our known working addresses
cat > .env << 'EOF'
# Shared/OnchainKit variables
NEXT_PUBLIC_ONCHAINKIT_PROJECT_NAME=PredictionBetting
NEXT_PUBLIC_URL=
NEXT_PUBLIC_ICON_URL=$NEXT_PUBLIC_URL/logo.png
NEXT_PUBLIC_ONCHAINKIT_API_KEY=

# Frame metadata
FARCASTER_HEADER=
FARCASTER_PAYLOAD=
FARCASTER_SIGNATURE=
NEXT_PUBLIC_APP_ICON=$NEXT_PUBLIC_URL/icon.png

# Optional Frame metadata items
NEXT_PUBLIC_APP_SUBTITLE=Crypto Prediction Betting on Base
NEXT_PUBLIC_APP_DESCRIPTION=Create and bet on predictions directly in Farcaster with crypto
NEXT_PUBLIC_APP_SPLASH_IMAGE=$NEXT_PUBLIC_URL/splash.png
NEXT_PUBLIC_SPLASH_BACKGROUND_COLOR=#0052FF
NEXT_PUBLIC_APP_PRIMARY_CATEGORY=social
NEXT_PUBLIC_APP_HERO_IMAGE=$NEXT_PUBLIC_URL/hero.png
NEXT_PUBLIC_APP_TAGLINE=Bet on the future with crypto
NEXT_PUBLIC_APP_OG_TITLE=PredictionBetting - Crypto Prediction Markets
NEXT_PUBLIC_APP_OG_DESCRIPTION=Create and bet on predictions directly in Farcaster with crypto on Base
NEXT_PUBLIC_APP_OG_IMAGE=$NEXT_PUBLIC_URL/hero.png

# Redis config for notifications and webhooks
REDIS_URL=
REDIS_TOKEN=

# Blockchain Configuration (Using working addresses from previous setup)
NEXT_PUBLIC_CONTRACT_ADDRESS=0xad8063e222D6B893eEBDe0f85C398b32f0A3cF2C
NEXT_PUBLIC_NETWORK=base-sepolia
NEXT_PUBLIC_WALLET_ADDRESS=0x0408a00e58eCb6D4914C4fD3DA7B9316cda8651d

# Prediction Betting App Settings
NEXT_PUBLIC_MIN_BET_AMOUNT=0.001
NEXT_PUBLIC_MAX_BET_AMOUNT=10.0
NEXT_PUBLIC_DEFAULT_MARKET_DURATION=30
EOF

echo "✅ Created .env file with Base Sepolia configuration"
echo ""
echo "📋 Configuration Summary:"
echo "- Project Name: PredictionBetting"
echo "- Network: Base Sepolia (testnet)"
echo "- Contract: 0xad8063e222D6B893eEBDe0f85C398b32f0A3cF2C"
echo "- Wallet: 0x0408a00e58eCb6D4914C4fD3DA7B9316cda8651d"
echo "- Min Bet: 0.001 ETH"
echo "- Max Bet: 10.0 ETH"
echo ""
echo "🔧 Next Steps:"
echo "1. Set NEXT_PUBLIC_URL to your deployed app URL"
echo "2. Get OnchainKit API key from Coinbase Developer Platform"
echo "3. Run 'npx create-onchain --manifest' to generate Farcaster manifest"
echo "4. Set up Redis for notifications (optional)"
echo ""
echo "🚀 Ready to run: npm run dev" 