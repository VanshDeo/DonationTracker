import React, { useState, useEffect } from 'react';
import { donate, canDonate, getCampaignStats } from '../utils/contract';
import { useWallet } from '../context/WalletContext';

interface DonationFormProps {
  onSuccess: () => void;
  minAmount?: number;
}

export const DonationForm: React.FC<DonationFormProps> = ({ onSuccess, minAmount = 1 }) => {
  const { address } = useWallet();
  const [amount, setAmount] = useState<string>(minAmount.toString());
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [cooldownTime, setCooldownTime] = useState(0);
  const [canDonateNow, setCanDonateNow] = useState(true);

  // Check cooldown status every second if connected
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    const checkStatus = async () => {
      if (!address) return;
      try {
        const status = await canDonate(address);
        setCanDonateNow(status.can);
        if (!status.can) {
          setCooldownTime(status.secondsRemaining);
        } else {
          setCooldownTime(0);
        }
      } catch (err) {
        console.error("Failed to check cooldown:", err);
      }
    };

    checkStatus();
    interval = setInterval(checkStatus, 5000); // Check chain every 5s
    
    // Internal countdown for smoother UI
    const countdown = setInterval(() => {
      setCooldownTime(prev => {
        if (prev <= 1) {
          setCanDonateNow(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      clearInterval(interval);
      clearInterval(countdown);
    };
  }, [address]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address) {
      setError("Please connect your wallet first.");
      return;
    }
    
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount < minAmount) {
      setError(`Minimum donation is ${minAmount} XLM`);
      return;
    }

    if (message.length > 140) {
      setError("Message must be 140 characters or less");
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      // 1 XLM = 10,000,000 stroops
      const stroops = Math.floor(numAmount * 10_000_000);
      await donate(address, stroops, message);
      
      setAmount(minAmount.toString());
      setMessage('');
      onSuccess();
      
      // Force refresh cooldown instantly
      const status = await canDonate(address);
      setCanDonateNow(status.can);
      setCooldownTime(status.secondsRemaining);
      
    } catch (err: any) {
      setError(err.message || "Transaction failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="terminal-box">
      <div className="terminal-header">EXECUTE_DONATION.exe</div>
      
      {!address ? (
        <div className="text-center text-sm mb-4" style={{ color: '#aaa' }}>
          [&gt;] Awaiting wallet connection to enable transactions...
        </div>
      ) : !canDonateNow ? (
        <div className="text-center mb-4">
          <div className="error-text" style={{ fontSize: '1.2rem' }}>[ SPAM GUARD ACTIVE ]</div>
          <p className="text-sm">Cooldown enagaged. Please wait:</p>
          <h2 style={{ color: '#ff003c', margin: '1rem 0' }}>{formatTime(cooldownTime)}</h2>
          <p className="text-xs">This prevents on-chain spam by limiting donations to once per hour.</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          {error && <div className="error-text">[ERROR]: {error}</div>}
          
          <label className="text-sm mb-4" style={{ display: 'block' }}>AMOUNT (XLM) [&gt;= {minAmount}]</label>
          <input 
            type="number" 
            step="0.01" 
            min={minAmount}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            disabled={isSubmitting}
            required
          />
          
          <label className="text-sm mb-4 justify-between flex" style={{ display: 'flex' }}>
            <span>MESSAGE</span>
            <span style={{ color: message.length > 140 ? '#ff003c' : 'inherit' }}>
              {message.length}/140
            </span>
          </label>
          <textarea 
            rows={3}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Enter public message (optional)"
            disabled={isSubmitting}
            maxLength={140}
          />
          
          <button 
            type="submit" 
            className="primary-btn mt-4"
            disabled={isSubmitting || !address || !canDonateNow}
          >
            {isSubmitting ? (
              <span className="loading-dots">TRANSMITTING</span>
            ) : (
              'DEPLOY FUNDS'
            )}
          </button>
        </form>
      )}
    </div>
  );
};
