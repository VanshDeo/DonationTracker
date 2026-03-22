import React, { useEffect, useState, useCallback } from 'react';
import { Header } from './components/Header';
import { Stats } from './components/Stats';
import { DonationForm } from './components/DonationForm';
import { Leaderboard } from './components/Leaderboard';
import { getCampaignStats, getDonations } from './utils/contract';

const App: React.FC = () => {
  const [stats, setStats] = useState({
    totalRaised: 0,
    donorCount: 0,
    donationCount: 0,
    goalAmount: 0
  });
  const [donations, setDonations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [fetchedStats, fetchedDonations] = await Promise.all([
        getCampaignStats(),
        getDonations()
      ]);
      setStats(fetchedStats);
      setDonations(fetchedDonations);
      setError(null);
    } catch (err: any) {
      console.error("Failed to fetch chain data:", err);
      // Don't override existing data with errors if we already have it
      if (donations.length === 0) {
        setError("Failed to sync with Stellar Soroban network. Ensure contract ID and network logic are correct.");
      }
    } finally {
      setLoading(false);
    }
  }, [donations.length]);

  useEffect(() => {
    fetchData();
    // Refresh data every 15 seconds
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, [fetchData]);

  return (
    <>
      <Header />
      
      <main className="app-container">
        {error ? (
          <div className="terminal-box" style={{ borderColor: '#ff003c' }}>
            <div className="terminal-header" style={{ color: '#ff003c' }}>SYS_ERROR</div>
            <div className="error-text text-center">{error}</div>
            <button className="primary-btn mt-4" onClick={fetchData}>
              RETRY_CONNECTION
            </button>
          </div>
        ) : loading ? (
          <div className="text-center" style={{ marginTop: '20vh' }}>
            <h2 className="loading-dots">INITIALIZING_PROTOCOL</h2>
            <p>Syncing ledger data from Stellar Testnet</p>
          </div>
        ) : (
          <div className="grid grid-cols-2">
            <div>
              <div className="mb-4">
                <Stats stats={stats} />
              </div>
              <div>
                <DonationForm onSuccess={fetchData} minAmount={1} />
              </div>
            </div>
            
            <div>
              <Leaderboard donations={donations} />
            </div>
          </div>
        )}
      </main>
    </>
  );
};

export default App;
