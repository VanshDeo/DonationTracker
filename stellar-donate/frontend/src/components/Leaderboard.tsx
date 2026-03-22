import React from 'react';

interface Donation {
  donor: string;
  amount: number;
  message: string;
  donatedAt: number;
}

interface LeaderboardProps {
  donations: Donation[];
}

export const Leaderboard: React.FC<LeaderboardProps> = ({ donations }) => {
  const formatAddress = (addr: string) => 
    `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    return date.toISOString().replace('T', ' ').substring(0, 19);
  };

  return (
    <div className="terminal-box" style={{ height: '100%' }}>
      <div className="terminal-header">PUBLIC_LEDGER.log</div>
      
      {donations.length === 0 ? (
        <div className="text-center" style={{ color: '#555', padding: '2rem' }}>
          [NO DATA FOUND IN LEDGER]
        </div>
      ) : (
        <div style={{ maxHeight: '600px', overflowY: 'auto', paddingRight: '8px' }}>
          {donations.map((tx, idx) => (
            <div key={`${tx.donor}-${tx.donatedAt}-${idx}`} className="log-entry">
              <div className="flex justify-between items-center mb-4">
                <span style={{ color: '#aaa', fontSize: '0.8rem' }}>
                  {formatDate(tx.donatedAt)}
                </span>
                <span className="success-text" style={{ fontSize: '1.2rem' }}>
                  +{(tx.amount / 10_000_000).toLocaleString()} XLM
                </span>
              </div>
              
              <div className="text-sm mb-4">
                <span style={{ color: '#555' }}>SRC: </span>
                {formatAddress(tx.donor)}
              </div>
              
              {tx.message && (
                <div 
                  className="break-words" 
                  style={{ 
                    borderLeft: '2px solid var(--neon-green)', 
                    paddingLeft: '8px',
                    fontStyle: 'italic',
                    color: '#ddd' 
                  }}
                >
                  "{tx.message}"
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
