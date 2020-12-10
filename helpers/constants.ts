import { eEthereumNetwork, tEthereumAddress } from './types';
import { getParamPerNetwork } from './misc-utils';

export const MAX_UINT_AMOUNT =
  '115792089237316195423570985008687907853269984665640564039457584007913129639935';
export const MOCK_ETH_ADDRESS = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';
export const WAD = Math.pow(10, 18).toString();
export const COOLDOWN_SECONDS = '3600'; // 1 hour in seconds
export const UNSTAKE_WINDOW = '1800'; // 30 min in seconds
export const DISTRIBUTION_DURATION = '86400'; // 1 day in seconds

export const STAKED_AAVE_NAME = 'Staked Aave';
export const STAKED_AAVE_SYMBOL = 'stkAAVE';
export const STAKED_AAVE_DECIMALS = 18;

export const ZERO_ADDRESS: tEthereumAddress = '0x0000000000000000000000000000000000000000';

// PEI constants
export const PSM_STAKER_PREMIUM = '2';

// just junk mock

export const RANDOM_ADDRESSES = [
  '0x0000000000000000000000000000000000000221',
  '0x0000000000000000000000000000000000000321',
  '0x0000000000000000000000000000000000000211',
  '0x0000000000000000000000000000000000000251',
  '0x0000000000000000000000000000000000000271',
  '0x0000000000000000000000000000000000000291',
  '0x0000000000000000000000000000000000000321',
  '0x0000000000000000000000000000000000000421',
  '0x0000000000000000000000000000000000000521',
  '0x0000000000000000000000000000000000000621',
  '0x0000000000000000000000000000000000000721',
];

export const getAaveTokenPerNetwork = (network: eEthereumNetwork): tEthereumAddress =>
  getParamPerNetwork<tEthereumAddress>(
    {
      [eEthereumNetwork.coverage]: ZERO_ADDRESS,
      [eEthereumNetwork.hardhat]: ZERO_ADDRESS,
      [eEthereumNetwork.kovan]: '0xe4483afcf0d612c011679C76B61F5b0d27bAF93C',
      [eEthereumNetwork.ropsten]: '0x74dA004A1B81b4d0C79F5820f9FF22647cb1dD95',
      [eEthereumNetwork.main]: '0x9c0435779F5E52CEC404D957C9bAa6f7d674C8bA',
    },
    network
  );

export const getCooldownSecondsPerNetwork = (network: eEthereumNetwork): tEthereumAddress =>
  getParamPerNetwork<string>(
    {
      [eEthereumNetwork.coverage]: COOLDOWN_SECONDS,
      [eEthereumNetwork.hardhat]: COOLDOWN_SECONDS,
      [eEthereumNetwork.kovan]: '21600', // 8h
      [eEthereumNetwork.ropsten]: '180', // 3m
      [eEthereumNetwork.main]: '864000', // 10d
    },
    network
  );

export const getUnstakeWindowPerNetwork = (network: eEthereumNetwork): tEthereumAddress =>
  getParamPerNetwork<string>(
    {
      [eEthereumNetwork.coverage]: UNSTAKE_WINDOW,
      [eEthereumNetwork.hardhat]: UNSTAKE_WINDOW,
      [eEthereumNetwork.kovan]: '10800', // 4h
      [eEthereumNetwork.ropsten]: '240', // 4m
      [eEthereumNetwork.main]: '172800', // 2d
    },
    network
  );

export const getAaveAdminPerNetwork = (network: eEthereumNetwork): tEthereumAddress =>
  getParamPerNetwork<tEthereumAddress>(
    {
      [eEthereumNetwork.coverage]: ZERO_ADDRESS,
      [eEthereumNetwork.hardhat]: ZERO_ADDRESS,
      [eEthereumNetwork.kovan]: '0x8134929c3dcb1b8b82f27f53424b959fb82182f2', // Aave Governance
      [eEthereumNetwork.ropsten]: '0xEd93e49A2d75beA505fD4D1A0Dff745f69F2E997', // Aave Governance
      [eEthereumNetwork.main]: '0x8a2Efd9A790199F4c94c6effE210fce0B4724f52', // Aave Governance
    },
    network
  );

export const getDistributionDurationPerNetwork = (network: eEthereumNetwork): tEthereumAddress =>
  getParamPerNetwork<tEthereumAddress>(
    {
      [eEthereumNetwork.coverage]: DISTRIBUTION_DURATION,
      [eEthereumNetwork.hardhat]: DISTRIBUTION_DURATION,
      [eEthereumNetwork.kovan]: '864000',
      [eEthereumNetwork.ropsten]: '864000',
      [eEthereumNetwork.main]: '12960000', // 5 months (30 days) in seconds
    },
    network
  );

export const getAaveIncentivesVaultPerNetwork = (network: eEthereumNetwork): tEthereumAddress =>
  getParamPerNetwork<tEthereumAddress>(
    {
      [eEthereumNetwork.coverage]: '',
      [eEthereumNetwork.hardhat]: '',
      [eEthereumNetwork.kovan]: '',
      [eEthereumNetwork.ropsten]: '',
      [eEthereumNetwork.main]: '0x253f7b06c1d60c1fbbc9d82c301327eb86e3ba81',
    },
    network
  );
