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

export const AAVE_GOVERNANCE_V2 = '0xEC568fffba86c094cf06b22134B23074DFE2252c';
export const UPGRADABLE_CRP_FACTORY = '0x1156C30b08DbF16281c803EAe0d52Eee7652f10C';
export const AAVE_TOKEN = '0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9';
export const WETH = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2';
export const REWARDS_VAULT = '0x25f2226b597e8f9514b3f68f00f494cf4f286491';
export const BPOOL_FACTORY = '0x9424B1412450D0f8Fc2255FAf6046b98213B76Bd';

export const CRP_IMPLEMENTATION = '0xadc74a134082ea85105258407159fbb428a73782';
export const SHORT_EXECUTOR = '0xee56e2b3d491590b5b31738cc34d5232f378a8d5';
export const LONG_EXECUTOR = '0x61910EcD7e8e942136CE7Fe7943f956cea1CC2f7';
export const PROXY_CRP_ADMIN = SHORT_EXECUTOR;
export const RESERVE_CONTROLER = '0x1E506cbb6721B83B1549fa1558332381Ffa61A93';
export const ZERO_ADDRESS: tEthereumAddress = '0x0000000000000000000000000000000000000000';

export const STK_BPT = '0xa1116930326d21fb917d5a27f1e9943a9595fb47';
export const AAVE_BPT_POOL_TOKEN = '0x41a08648c3766f9f9d85598ff102a08f4ef84f84';
export const STK_WSTEH = '0xa1116930326d21fb917d5a27f1e9943a9595fb47'; // TODO change for actual token
export const STAKED_AAVE = '0x4da27a545c0c5b758a6ba100e3a049001de870f5';
export const ETH_USD_PRICE_FEED = '0x5f4ec3df9cbd43714fe2740f5e3616155c5b8419';
export const AAVE_ORACLE = '0x6Df09E975c830ECae5bd4eD9d90f3A95a4f88012';
export const BPT_PRICE_FEED = '0x0De156f178a20114eeec0eBF71d7772064476b0D';
export const STK_WHALE = '0xaFDAbFb6227507fF6522b8a242168F6b5F353a6E';
export const BPT_WHALE = '0x741AA7CFB2c7bF2A1E7D4dA2e3Df6a56cA4131F3';
export const STK_WSTEH_WHALE = '0x741AA7CFB2c7bF2A1E7D4dA2e3Df6a56cA4131F3';
export const COLLECTOR = '0x464c71f6c2f760dda6093dcb91c24c39e5d6e18c';
export const STK_WSTEH_PRICE_FEED = BPT_PRICE_FEED; // TODO change

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
      [eEthereumNetwork.goerli]: '0x8153a21dfeb1f67024aa6c6e611432900ff3dcb9',
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
      [eEthereumNetwork.kovan]: '21600', // 6h
      [eEthereumNetwork.goerli]: '180', // 3min
      [eEthereumNetwork.ropsten]: '180', // 3min
      [eEthereumNetwork.main]: '864000', // 10d
    },
    network
  );

export const getUnstakeWindowPerNetwork = (network: eEthereumNetwork): tEthereumAddress =>
  getParamPerNetwork<string>(
    {
      [eEthereumNetwork.coverage]: UNSTAKE_WINDOW,
      [eEthereumNetwork.hardhat]: UNSTAKE_WINDOW,
      [eEthereumNetwork.kovan]: '10800', // 3h
      [eEthereumNetwork.goerli]: '240', // 4min
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
      [eEthereumNetwork.goerli]: ZERO_ADDRESS,
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
      [eEthereumNetwork.goerli]: '864000',
      [eEthereumNetwork.ropsten]: '864000',
      [eEthereumNetwork.main]: '12960000', // 5 months (30 days) in seconds
    },
    network
  );

export const getAaveIncentivesVaultPerNetwork = (network: eEthereumNetwork): tEthereumAddress =>
  getParamPerNetwork<tEthereumAddress>(
    {
      [eEthereumNetwork.coverage]: ZERO_ADDRESS,
      [eEthereumNetwork.hardhat]: ZERO_ADDRESS,
      [eEthereumNetwork.kovan]: ZERO_ADDRESS,
      [eEthereumNetwork.goerli]: ZERO_ADDRESS,
      [eEthereumNetwork.ropsten]: ZERO_ADDRESS,
      [eEthereumNetwork.main]: '0x253f7b06c1d60c1fbbc9d82c301327eb86e3ba81',
    },
    network
  );
