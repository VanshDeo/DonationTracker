import React from 'react';
import { useWallet } from '../context/WalletContext';
import { Terminal } from 'lucide-react';

export const Header: React.FC = () => {
  const { address, connect, disconnect, isConnecting, error } = useWallet();

  const formatAddress = (addr: string) => 
    `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;

  return (
    <nav>
      <div className="flex items-center gap-4">
        <Terminal size={32} color="var(--neon-green)" className="glitch" />
        <h1 style={{ margin: 0, fontSize: '1.5rem' }}>Stellar Donate</h1>
      </div>
      
      <div className="flex items-center gap-4">
        {error && <span className="error-text text-sm" style={{ margin: 0 }}>{error}</span>}
        
        {address ? (
          <div className="flex items-center gap-4">
            <span className="text-sm">Logged in as: <span style={{ textDecoration: 'underline' }}>{formatAddress(address)}</span></span>
            <button 
              onClick={disconnect}
              className="primary-btn" 
              style={{ padding: '8px 16px', width: 'auto', fontSize: '0.8rem' }}
            >
              Disconnect
            </button>
          </div>
        ) : (
          <button 
            onClick={connect} 
            disabled={isConnecting}
            className="primary-btn"
            style={{ padding: '8px 16px', width: 'auto' }}
          >
            {isConnecting ? 'CONNECTING...' : 'CONNECT FREIGHTER'}
          </button>
        )}
      </div>
    </nav>
  );
};
