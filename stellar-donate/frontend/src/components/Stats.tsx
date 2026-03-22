import React from 'react';

interface StatsProps {
  stats: {
    totalRaised: number;
    donorCount: number;
    donationCount: number;
    goalAmount: number;
  }
}

export const Stats: React.FC<StatsProps> = ({ stats }) => {
  const { totalRaised, donorCount, donationCount, goalAmount } = stats;
  
  // Convert stroops to XLM
  const raisedXLM = totalRaised / 10_000_000;
  const goalXLM = goalAmount / 10_000_000;
  
  const percentage = goalAmount > 0 
    ? Math.min(100, Math.round((totalRaised / goalAmount) * 100))
    : 0;

  return (
    <div className="terminal-box">
      <div className="terminal-header">SYS_STATS.dat</div>
      
      <div className="stat-item">
        <span>TOTAL_FUNDS_SECURED</span>
        <span className="success-text">{raisedXLM.toLocaleString()} XLM</span>
      </div>
      
      <div className="stat-item">
        <span>UNIQUE_OPERATIVES</span>
        <span>{donorCount}</span>
      </div>
      
      <div className="stat-item">
        <span>TRANSACTION_COUNT</span>
        <span>{donationCount}</span>
      </div>

      {goalAmount > 0 && (
        <div style={{ marginTop: '2rem' }}>
          <div className="flex justify-between text-sm">
            <span>MISSION_PROGRESS</span>
            <span>{percentage}%</span>
          </div>
          <div className="progress-bar-container">
            <div 
              className="progress-bar-fill" 
              style={{ width: `${percentage}%` }}
            ></div>
          </div>
          <div className="flex justify-between text-xs" style={{ color: '#aaa' }}>
            <span>0 XLM</span>
            <span>TARGET: {goalXLM.toLocaleString()} XLM</span>
          </div>
        </div>
      )}
    </div>
  );
};
