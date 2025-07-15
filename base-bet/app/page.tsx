"use client";

import {
  useMiniKit,
  useOpenUrl,
} from "@coinbase/onchainkit/minikit";
import {
  Name,
  Identity,
  Address,
  Avatar,
  EthBalance,
} from "@coinbase/onchainkit/identity";
import {
  ConnectWallet,
  Wallet,
  WalletDropdown,
  WalletDropdownDisconnect,
} from "@coinbase/onchainkit/wallet";
import { useEffect } from "react";
import { PredictionBetting } from "./components/PredictionBetting";

export default function App() {
  const { setFrameReady, isFrameReady } = useMiniKit();

  const openUrl = useOpenUrl();

  useEffect(() => {
    if (!isFrameReady) {
      setFrameReady();
    }
  }, [setFrameReady, isFrameReady]);

  const saveFrameButton = null;

  return (
    <div className="min-h-screen bg-[var(--app-background)]">
      {/* Header with wallet connection */}
      <div className="border-b border-[var(--app-border)] bg-[var(--app-background)]">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <h1 className="text-xl font-bold text-[var(--app-foreground)]">
              🎯 Prediction Betting
            </h1>
            {saveFrameButton}
          </div>
          
          <Wallet>
            <ConnectWallet>
              <Avatar className="h-6 w-6" />
              <Name />
            </ConnectWallet>
            <WalletDropdown>
              <Identity
                className="px-4 pt-3 pb-2"
                hasCopyAddressOnClick
              >
                <Avatar />
                <Name />
                <Address />
                <EthBalance />
              </Identity>
              <WalletDropdownDisconnect />
            </WalletDropdown>
          </Wallet>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        <PredictionBetting />
      </main>

      {/* Footer */}
      <footer className="border-t border-[var(--app-border)] mt-16">
        <div className="max-w-4xl mx-auto px-4 py-6 text-center">
          <p className="text-sm text-[var(--app-foreground-muted)]">
            Built on Base 🔵 | Powered by OnchainKit ⚡ | 
            <button 
              onClick={() => openUrl("https://docs.base.org/minikit")}
              className="ml-1 text-[var(--app-accent)] hover:underline"
            >
              Learn More
            </button>
          </p>
        </div>
      </footer>
    </div>
  );
}
