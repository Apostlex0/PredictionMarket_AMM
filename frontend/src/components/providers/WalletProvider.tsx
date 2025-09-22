'use client';
import { AptosWalletAdapterProvider } from "@aptos-labs/wallet-adapter-react";
import { Network } from "@aptos-labs/ts-sdk";
import { PropsWithChildren } from "react";

export function WalletProvider({ children }: PropsWithChildren) {
  return (
    <AptosWalletAdapterProvider
      autoConnect={true}
      dappConfig={{
        network: Network.MAINNET,
        aptosApiKeys: {
          mainnet: process.env.NEXT_PUBLIC_APTOS_API_KEY_MAINNET,
        }
      }}
      onError={(error) => {
        console.log("Wallet connection error:", error);
      }}
    >
      {children}
    </AptosWalletAdapterProvider>
  );
}
