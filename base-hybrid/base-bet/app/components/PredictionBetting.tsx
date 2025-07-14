"use client";

import { type ReactNode, useCallback, useMemo, useState, useEffect } from "react";
import { useAccount } from "wagmi";
import {
  Transaction,
  TransactionButton,
  TransactionToast,
  TransactionToastAction,
  TransactionToastIcon,
  TransactionToastLabel,
  TransactionError,
  TransactionResponse,
  TransactionStatusAction,
  TransactionStatusLabel,
  TransactionStatus,
} from "@coinbase/onchainkit/transaction";
import {
  Name,
  Identity,
  Address,
  Avatar,
  EthBalance,
} from "@coinbase/onchainkit/identity";
import { useNotification } from "@coinbase/onchainkit/minikit";
import { Button, Card, Icon } from "./DemoComponents";
import { formatEther, parseEther } from "viem";

// Contract configuration - using deployed contract from previous setup
const PREDICTION_CONTRACT_ADDRESS = (process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || "0xad8063e222D6B893eEBDe0f85C398b32f0A3cF2C") as `0x${string}`;
const MIN_BET_AMOUNT = parseFloat(process.env.NEXT_PUBLIC_MIN_BET_AMOUNT || "0.001");
const MAX_BET_AMOUNT = parseFloat(process.env.NEXT_PUBLIC_MAX_BET_AMOUNT || "10.0");

// Contract ABI for prediction betting
const PREDICTION_CONTRACT_ABI = [
  {
    "inputs": [
      {"internalType": "string", "name": "prediction", "type": "string"},
      {"internalType": "uint256", "name": "durationDays", "type": "uint256"}
    ],
    "name": "createMarket",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {"internalType": "string", "name": "marketId", "type": "string"},
      {"internalType": "bool", "name": "position", "type": "bool"}
    ],
    "name": "placeBet",
    "outputs": [],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "string", "name": "marketId", "type": "string"}],
    "name": "getMarketInfo",
    "outputs": [
      {"internalType": "string", "name": "prediction", "type": "string"},
      {"internalType": "uint256", "name": "deadline", "type": "uint256"},
      {"internalType": "bool", "name": "resolved", "type": "bool"},
      {"internalType": "bool", "name": "outcome", "type": "bool"},
      {"internalType": "uint256", "name": "totalAgree", "type": "uint256"},
      {"internalType": "uint256", "name": "totalDisagree", "type": "uint256"},
      {"internalType": "uint256", "name": "betCount", "type": "uint256"}
    ],
    "stateMutability": "view",
    "type": "function"
  }
] as const;

interface MarketInfo {
  prediction: string;
  deadline: bigint;
  resolved: boolean;
  outcome: boolean;
  totalAgree: bigint;
  totalDisagree: bigint;
  betCount: bigint;
}

interface PredictionBettingProps {
  initialMarketId?: string;
  initialPrediction?: string;
}

export function CreateMarketCard() {
  const [prediction, setPrediction] = useState("");
  const [duration, setDuration] = useState(30);
  const { address } = useAccount();
  const sendNotification = useNotification();

  const handleCreateMarket = useCallback(() => {
    if (prediction.trim()) {
      // Notification will be sent after successful transaction
      sendNotification({
        title: "Market Created! 🎯",
        body: `Your prediction "${prediction.substring(0, 50)}..." is now live for betting!`
      });
    }
  }, [prediction, sendNotification]);

  return (
    <Card title="Create Prediction Market" className="mb-6">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-[var(--app-foreground)] mb-2">
            What do you want to predict?
          </label>
          <textarea
            value={prediction}
            onChange={(e) => setPrediction(e.target.value)}
            placeholder="e.g., Bitcoin will reach $100k by end of 2024"
            className="w-full p-3 border border-[var(--app-border)] rounded-lg bg-[var(--app-background)] text-[var(--app-foreground)]"
            rows={3}
            maxLength={280}
          />
          <div className="text-xs text-[var(--app-foreground-muted)] mt-1">
            {prediction.length}/280 characters
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-[var(--app-foreground)] mb-2">
            Market Duration (days)
          </label>
          <select
            value={duration}
            onChange={(e) => setDuration(parseInt(e.target.value))}
            className="w-full p-3 border border-[var(--app-border)] rounded-lg bg-[var(--app-background)] text-[var(--app-foreground)]"
          >
            <option value={7}>7 days</option>
            <option value={14}>14 days</option>
            <option value={30}>30 days</option>
            <option value={90}>90 days</option>
            <option value={180}>180 days</option>
          </select>
        </div>

        <Transaction
          contracts={[
            {
              address: PREDICTION_CONTRACT_ADDRESS,
              abi: PREDICTION_CONTRACT_ABI,
              functionName: "createMarket",
              args: [prediction, BigInt(duration)],
            },
          ]}
          onSuccess={handleCreateMarket}
        >
          <TransactionButton
            disabled={!prediction.trim() || !address}
            className="w-full"
          >
            Create Market 🎯
          </TransactionButton>
          <TransactionStatus>
            <TransactionStatusLabel />
            <TransactionStatusAction />
          </TransactionStatus>
          <TransactionToast>
            <TransactionToastIcon />
            <TransactionToastLabel />
            <TransactionToastAction />
          </TransactionToast>
        </Transaction>
      </div>
    </Card>
  );
}

export function BettingCard({ marketId, marketInfo }: { marketId: string; marketInfo: MarketInfo | null }) {
  const [betAmount, setBetAmount] = useState("0.01");
  const [position, setPosition] = useState<boolean | null>(null);
  const { address } = useAccount();
  const sendNotification = useNotification();

  const handleBet = useCallback(() => {
    if (marketInfo && position !== null) {
      sendNotification({
        title: "Bet Placed! 💰",
        body: `${betAmount} ETH bet on ${position ? "AGREE" : "DISAGREE"} - Good luck!`
      });
    }
  }, [betAmount, position, marketInfo, sendNotification]);

  const betValue = useMemo(() => {
    try {
      return parseEther(betAmount);
    } catch {
      return 0n;
    }
  }, [betAmount]);

  if (!marketInfo) {
    return (
      <Card title="Market Not Found" className="mb-6">
        <div className="text-center py-8">
          <Icon name="star" size="lg" className="mx-auto mb-4 text-[var(--app-foreground-muted)]" />
          <p className="text-[var(--app-foreground-muted)]">
            No market found for this prediction.
          </p>
        </div>
      </Card>
    );
  }

  const totalPool = marketInfo.totalAgree + marketInfo.totalDisagree;
  const agreePercentage = totalPool > 0n ? Number((marketInfo.totalAgree * 100n) / totalPool) : 50;
  const disagreePercentage = 100 - agreePercentage;

  return (
    <Card title="Place Your Bet" className="mb-6">
      <div className="space-y-4">
        {/* Market Info */}
        <div className="bg-[var(--app-gray-light)] p-4 rounded-lg">
          <h3 className="font-medium text-[var(--app-foreground)] mb-2">
            Prediction
          </h3>
          <p className="text-sm text-[var(--app-foreground-muted)]">
            {marketInfo.prediction}
          </p>
        </div>

        {/* Pool Stats */}
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center p-3 bg-green-50 rounded-lg">
            <div className="text-lg font-bold text-green-600">
              ✅ {agreePercentage}%
            </div>
            <div className="text-sm text-green-700">
              {formatEther(marketInfo.totalAgree)} ETH
            </div>
            <div className="text-xs text-green-600">AGREE</div>
          </div>
          <div className="text-center p-3 bg-red-50 rounded-lg">
            <div className="text-lg font-bold text-red-600">
              ❌ {disagreePercentage}%
            </div>
            <div className="text-sm text-red-700">
              {formatEther(marketInfo.totalDisagree)} ETH
            </div>
            <div className="text-xs text-red-600">DISAGREE</div>
          </div>
        </div>

        {/* Position Selection */}
        <div>
          <label className="block text-sm font-medium text-[var(--app-foreground)] mb-2">
            Your Position
          </label>
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant={position === true ? "primary" : "outline"}
              onClick={() => setPosition(true)}
              className="w-full"
            >
              ✅ AGREE
            </Button>
            <Button
              variant={position === false ? "primary" : "outline"}
              onClick={() => setPosition(false)}
              className="w-full"
            >
              ❌ DISAGREE
            </Button>
          </div>
        </div>

        {/* Bet Amount */}
        <div>
          <label className="block text-sm font-medium text-[var(--app-foreground)] mb-2">
            Bet Amount (ETH)
          </label>
          <input
            type="number"
            value={betAmount}
            onChange={(e) => setBetAmount(e.target.value)}
            min={MIN_BET_AMOUNT}
            max={MAX_BET_AMOUNT}
            step="0.001"
            className="w-full p-3 border border-[var(--app-border)] rounded-lg bg-[var(--app-background)] text-[var(--app-foreground)]"
            placeholder="0.01"
          />
          <div className="text-xs text-[var(--app-foreground-muted)] mt-1">
            Min: {MIN_BET_AMOUNT} ETH | Max: {MAX_BET_AMOUNT} ETH
          </div>
        </div>

        {/* Place Bet Button */}
        <Transaction
          contracts={[
            {
              address: PREDICTION_CONTRACT_ADDRESS,
              abi: PREDICTION_CONTRACT_ABI,
              functionName: "placeBet",
              args: [marketId, position || false],
              value: betValue,
            },
          ]}
          onSuccess={handleBet}
        >
          <TransactionButton
            disabled={!address || position === null || !betAmount || betValue === 0n}
            className="w-full"
          >
            {position === null 
              ? "Select Position" 
              : `Bet ${betAmount} ETH on ${position ? "AGREE" : "DISAGREE"}`
            }
          </TransactionButton>
          <TransactionStatus>
            <TransactionStatusLabel />
            <TransactionStatusAction />
          </TransactionStatus>
          <TransactionToast>
            <TransactionToastIcon />
            <TransactionToastLabel />
            <TransactionToastAction />
          </TransactionToast>
        </Transaction>
      </div>
    </Card>
  );
}

export function MarketStatsCard({ marketInfo }: { marketInfo: MarketInfo | null }) {
  if (!marketInfo) return null;

  const totalPool = marketInfo.totalAgree + marketInfo.totalDisagree;
  const deadline = new Date(Number(marketInfo.deadline) * 1000);
  const isExpired = deadline < new Date();

  return (
    <Card title="Market Statistics" className="mb-6">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold text-[var(--app-foreground)]">
              {formatEther(totalPool)}
            </div>
            <div className="text-sm text-[var(--app-foreground-muted)]">
              Total Pool (ETH)
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold text-[var(--app-foreground)]">
              {marketInfo.betCount.toString()}
            </div>
            <div className="text-sm text-[var(--app-foreground-muted)]">
              Total Bets
            </div>
          </div>
        </div>

        <div className="text-center">
          <div className={`text-lg font-medium ${isExpired ? 'text-red-600' : 'text-green-600'}`}>
            {marketInfo.resolved ? '✅ RESOLVED' : isExpired ? '⏰ EXPIRED' : '🔄 ACTIVE'}
          </div>
          {marketInfo.resolved && (
            <div className="text-sm text-[var(--app-foreground-muted)] mt-1">
              Outcome: {marketInfo.outcome ? '✅ AGREE' : '❌ DISAGREE'}
            </div>
          )}
          {!marketInfo.resolved && (
            <div className="text-sm text-[var(--app-foreground-muted)] mt-1">
              Expires: {deadline.toLocaleDateString()}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

export function PredictionBetting({ initialMarketId, initialPrediction }: PredictionBettingProps) {
  const [activeTab, setActiveTab] = useState(initialMarketId ? "bet" : "create");
  const [marketId] = useState(initialMarketId || "");
  const [marketInfo, setMarketInfo] = useState<MarketInfo | null>(null);
  const { address } = useAccount();

  // TODO: Implement market info fetching using wagmi hooks
  // This would use the contract read functions to get market data

  return (
    <div className="max-w-2xl mx-auto p-4">
      {/* Header */}
      <div className="text-center mb-6">
        <h1 className="text-3xl font-bold text-[var(--app-foreground)] mb-2">
          🎯 Prediction Betting
        </h1>
        <p className="text-[var(--app-foreground-muted)]">
          Create and bet on predictions with crypto on Base
        </p>
      </div>

      {/* Wallet Connection */}
      <Card className="mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            {address ? (
              <Identity address={address}>
                <Avatar />
                <Name />
                <Address />
                <EthBalance />
              </Identity>
            ) : (
              <div className="text-[var(--app-foreground-muted)]">
                Connect wallet to start betting
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Tab Navigation */}
      <div className="flex rounded-lg bg-[var(--app-gray-light)] p-1 mb-6">
        <Button
          variant={activeTab === "create" ? "primary" : "ghost"}
          onClick={() => setActiveTab("create")}
          className="flex-1"
        >
          Create Market
        </Button>
        <Button
          variant={activeTab === "bet" ? "primary" : "ghost"}
          onClick={() => setActiveTab("bet")}
          className="flex-1"
        >
          Place Bet
        </Button>
      </div>

      {/* Content */}
      {activeTab === "create" && <CreateMarketCard />}
      {activeTab === "bet" && (
        <>
          <BettingCard marketId={marketId} marketInfo={marketInfo} />
          <MarketStatsCard marketInfo={marketInfo} />
        </>
      )}
    </div>
  );
} 