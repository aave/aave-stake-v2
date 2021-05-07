import { formatEther } from '@ethersproject/units';
import { DefenderRelaySigner, DefenderRelayProvider } from 'defender-relay-client/lib/ethers';
import { Signer } from 'ethers';
import { exit } from 'process';
import { DRE, impersonateAccountsHardhat } from './misc-utils';

let impersonatedLog = false;
let balanceLog = false;

export const getDefenderRelaySigner = async () => {
  const { DEFENDER_API_KEY, DEFENDER_SECRET_KEY } = process.env;
  let signer: Signer;

  if (!DEFENDER_API_KEY || !DEFENDER_SECRET_KEY) {
    throw new Error('Defender secrets required');
  }

  const credentials = { apiKey: DEFENDER_API_KEY, apiSecret: DEFENDER_SECRET_KEY };

  signer = new DefenderRelaySigner(credentials, new DefenderRelayProvider(credentials), {
    speed: 'fast',
  });

  const defenderAddress = await signer.getAddress();

  // Reemplace signer if MAINNET_FORK is active
  if (process.env.MAINNET_FORK === 'true') {
    if (!impersonatedLog) {
      console.log('  - Impersonating Defender Relay via Hardhat');
      impersonatedLog = true;
    }
    await impersonateAccountsHardhat([defenderAddress]);
    signer = await DRE.ethers.provider.getSigner(defenderAddress);
  }
  // Reemplace signer if Tenderly network is active
  if (DRE.network.name.includes('tenderly')) {
    if (!impersonatedLog) {
      console.log('  - Impersonating Defender Relay via Tenderly');
      impersonatedLog = true;
    }
    signer = await DRE.ethers.provider.getSigner(defenderAddress);
  }
  if (!balanceLog) {
    console.log('  - Balance: ', formatEther(await signer.getBalance()));
    balanceLog = true;
  }
  return { signer, address: defenderAddress };
};
