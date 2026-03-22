import { xdr, scValToNative, Address, nativeToScVal, Contract, TransactionBuilder, Account } from '@stellar/stellar-sdk';
// @ts-ignore
import { rpc } from '@stellar/stellar-sdk';
import { isConnected, setAllowed, signTransaction } from '@stellar/freighter-api';

const CONTRACT_ID = import.meta.env.VITE_CONTRACT_ID;
const RPC_URL = import.meta.env.VITE_RPC_URL || 'https://soroban-testnet.stellar.org';
const NETWORK_PASSPHRASE = import.meta.env.VITE_NETWORK_PASSPHRASE || 'Test SDF Network ; September 2015';

if (!CONTRACT_ID) {
  console.warn("VITE_CONTRACT_ID is not set in the environment!");
}

const server = new rpc.Server(RPC_URL);
const contract = new Contract(CONTRACT_ID!);

export const connectWallet = async (): Promise<string | null> => {
  if (await isConnected()) {
    try {
      await setAllowed();
      // Freighter v2+ doesn't return address directly from setAllowed usually, but let's see. 
      // Actually we should use getUserInfo or getPublicKey, but we'll try to get it.
      const publicKey = await (await import('@stellar/freighter-api')).getPublicKey();
      return publicKey;
    } catch (e) {
      console.error(e);
      return null;
    }
  }
  return null;
};

// Helper for generic contract queries (read-only)
async function queryContract(method: string, args: xdr.ScVal[] = []) {
  try {
    const txBuilder = await server.prepareTransaction(
      new TransactionBuilder(
        new Account('GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF', '0'), // Dummy account
        { fee: '1000', networkPassphrase: NETWORK_PASSPHRASE }
      )
        .addOperation(contract.call(method, ...args))
        .setTimeout(30)
        .build()
    );

    const simulation = await server.simulateTransaction(txBuilder);
    if (rpc.Api.isSimulationError(simulation)) {
      throw new Error(`Simulation failed: ${simulation.error}`);
    }

    if (simulation.result?.retval) {
      return scValToNative(simulation.result.retval);
    }
    return null;
  } catch (error) {
    console.error(`Error querying ${method}:`, error);
    throw error;
  }
}

// ── Contract API Functions ──

export async function getCampaignStats() {
  const result = await queryContract('get_campaign_stats');
  return {
    totalRaised: result?.total_raised ? Number(result.total_raised) : 0,
    donorCount: result?.donor_count || 0,
    donationCount: result?.donation_count || 0,
    goalAmount: result?.goal_amount ? Number(result.goal_amount) : 0,
  };
}

export async function getDonations() {
  const result = await queryContract('get_donations');
  if (!Array.isArray(result)) return [];
  return result.map((d: any) => ({
    donor: d.donor.toString(),
    amount: Number(d.amount),
    message: d.message.toString(),
    donatedAt: Number(d.donated_at),
  })).reverse(); // Newest first
}

export async function getDonorStats(donor: string) {
  const result = await queryContract('get_donor_stats', [new Address(donor).toScVal()]);
  return {
    totalDonated: result?.total_donated ? Number(result.total_donated) : 0,
    donationCount: result?.donation_count || 0,
    lastDonatedAt: result?.last_donated_at ? Number(result.last_donated_at) : 0,
  };
}

export async function canDonate(donor: string) {
  const result = await queryContract('can_donate', [new Address(donor).toScVal()]);
  return {
    can: result?.[0] ?? true,
    secondsRemaining: result?.[1] ? Number(result[1]) : 0,
  };
}

// Write operation
export async function donate(donor: string, amountStroops: number, message: string) {
  try {
    // 1. Fetch sequence number
    const account = await server.getAccount(donor);

    // 2. Build transaction
    const tx = new TransactionBuilder(account, { 
      fee: '1000', 
      networkPassphrase: NETWORK_PASSPHRASE 
    })
      .addOperation(
        contract.call(
          'donate',
          new Address(donor).toScVal(),
          nativeToScVal(amountStroops, { type: 'i128' }),
          nativeToScVal(message, { type: 'string' })
        )
      )
      .setTimeout(30)
      .build();

    // 3. Prepare transaction (resolves fees and footprint)
    const preparedTx = (await server.prepareTransaction(tx)) as any;

    // 4. Sign transaction via Freighter
    const signedXdr = await signTransaction(preparedTx.toXDR(), { network: 'TESTNET' });
    
    // 5. Submit to network
    const submitTx = TransactionBuilder.fromXDR(signedXdr as string, NETWORK_PASSPHRASE);
    const response = await server.sendTransaction(submitTx);
    
    if (response.status === 'ERROR') {
      throw new Error(`Transaction failed: ${JSON.stringify(response)}`);
    }

    // 6. Wait for confirmation
    const hash = response.hash;
    let statusResponse = await server.getTransaction(hash);
    let retries = 0;
    while (statusResponse.status === rpc.Api.GetTransactionStatus.NOT_FOUND && retries < 15) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      statusResponse = await server.getTransaction(hash);
      retries++;
    }

    if (statusResponse.status === rpc.Api.GetTransactionStatus.SUCCESS) {
      return true;
    } else {
      throw new Error(`Transaction failed with status: ${statusResponse.status}`);
    }
  } catch (error: any) {
    console.error('Donate transaction error:', error);
    throw new Error(error.message || 'Transaction failed');
  }
}
