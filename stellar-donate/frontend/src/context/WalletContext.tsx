import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { connectWallet } from '../utils/contract';
import { isAllowed } from '@stellar/freighter-api';

interface WalletContextType {
  address: string | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  isConnecting: boolean;
  error: string | null;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export const WalletProvider = ({ children }: { children: ReactNode }) => {
  const [address, setAddress] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Check if previously connected
    const checkConnection = async () => {
      try {
        if (await isAllowed()) {
           const addr = await connectWallet();
           if (addr) setAddress(addr);
        }
      } catch (err) {
        // Silent fail on initial load
      }
    };
    checkConnection();
  }, []);

  const connect = async () => {
    setIsConnecting(true);
    setError(null);
    try {
      const result = await connectWallet();
      if (result) {
        setAddress(result);
      } else {
        setError("Please install and unlock Freighter Wallet.");
      }
    } catch (err: any) {
      setError(err.message || 'Failed to connect wallet');
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnect = () => {
    setAddress(null);
  };

  return (
    <WalletContext.Provider value={{ address, connect, disconnect, isConnecting, error }}>
      {children}
    </WalletContext.Provider>
  );
};

export const useWallet = () => {
  const context = useContext(WalletContext);
  if (context === undefined) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
};
