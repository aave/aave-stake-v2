import { eEthereumNetwork } from './helpers/types';
// @ts-ignore
import { accounts } from './test-wallets';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { HardhatUserConfig } from 'hardhat/types';

import '@typechain/hardhat';
import 'solidity-coverage';
import '@nomiclabs/hardhat-waffle';
import '@nomiclabs/hardhat-etherscan';
import '@tenderly/hardhat-tenderly';

dotenv.config();

export const BUIDLEREVM_CHAIN_ID = 31337;

const DEFAULT_BLOCK_GAS_LIMIT = 12500000;
const HARDFORK = 'london';
const INFURA_KEY = process.env.INFURA_KEY || '';
const ETHERSCAN_KEY = process.env.ETHERSCAN_KEY || '';
const MNEMONIC_PATH = "m/44'/60'/0'/0";
const MNEMONIC = process.env.MNEMONIC || '';
const PRIVATE_KEY = process.env.PRIVATE_KEY || '';
const ALCHEMY_KEY = process.env.ALCHEMY_KEY || '';
const SKIP_LOAD = process.env.SKIP_LOAD === 'true';
const MAINNET_FORK = process.env.MAINNET_FORK === 'true';
const FORKING_BLOCK = parseInt(process.env.FORKING_BLOCK || '12369243');

// Prevent to load scripts before compilation and typechain
if (!SKIP_LOAD) {
  ['misc', 'migrations', 'deployments', 'proposals'].forEach((folder) => {
    const tasksPath = path.join(__dirname, 'tasks', folder);
    fs.readdirSync(tasksPath)
      .filter((pth) => pth.includes('.ts'))
      .forEach((task) => {
        require(`${tasksPath}/${task}`);
      });
  });
}

require(`${path.join(__dirname, 'tasks/misc')}/set-dre.ts`);

const mainnetFork = MAINNET_FORK
  ? {
      blockNumber: FORKING_BLOCK,
      url: ALCHEMY_KEY
        ? `https://eth-mainnet.alchemyapi.io/v2/${ALCHEMY_KEY}`
        : `https://main.infura.io/v3/${INFURA_KEY}`,
    }
  : undefined;

// Use of mnemonic over private key if mnemonic is provided
const accountsToUse =
  PRIVATE_KEY == ''
    ? {
        mnemonic: MNEMONIC,
        path: MNEMONIC_PATH,
        initialIndex: 0,
        count: 20,
      }
    : [PRIVATE_KEY];

const getCommonNetworkConfig = (networkName: eEthereumNetwork, networkId: number) => {
  return {
    url: ALCHEMY_KEY
      ? `https://eth-${
          networkName === 'main' ? 'mainnet' : networkName
        }.alchemyapi.io/v2/${ALCHEMY_KEY}`
      : `https://${networkName}.infura.io/v3/${INFURA_KEY}`,
    hardfork: HARDFORK,
    blockGasLimit: DEFAULT_BLOCK_GAS_LIMIT,
    chainId: networkId,
    accounts: accountsToUse,
  };
};

const config: HardhatUserConfig = {
  solidity: {
    compilers: [
      {
        version: '0.6.12',
        settings: {
          optimizer: { enabled: true, runs: 200 },
          evmVersion: 'london',
        },
      },
      {
        version: '0.7.5',
        settings: {
          optimizer: { enabled: true, runs: 200 },
          evmVersion: 'london',
        },
      },
    ],
  },
  typechain: {
    outDir: 'types',
  },
  etherscan: {
    apiKey: ETHERSCAN_KEY,
  },
  defaultNetwork: 'hardhat',
  mocha: {
    timeout: 0,
  },
  tenderly: {
    project: process.env.TENDERLY_PROJECT || '',
    username: process.env.TENDERLY_USERNAME || '',
    forkNetwork: '3030', //Network id of the network we want to fork
  },
  networks: {
    tenderly: getCommonNetworkConfig(eEthereumNetwork.tenderly, 3030),
    kovan: getCommonNetworkConfig(eEthereumNetwork.kovan, 42),
    ropsten: getCommonNetworkConfig(eEthereumNetwork.ropsten, 3),
    goerli: getCommonNetworkConfig(eEthereumNetwork.goerli, 5),
    main: getCommonNetworkConfig(eEthereumNetwork.main, 1),
    hardhat: {
      hardfork: 'london',
      blockGasLimit: DEFAULT_BLOCK_GAS_LIMIT,
      gas: DEFAULT_BLOCK_GAS_LIMIT,
      gasPrice: DEFAULT_GAS_PRICE,
      chainId: BUIDLEREVM_CHAIN_ID,
      throwOnTransactionFailures: true,
      throwOnCallFailures: true,
      accounts: accounts.map(({ secretKey, balance }: { secretKey: string; balance: string }) => ({
        privateKey: secretKey,
        balance,
      })),
      forking: mainnetFork,
    },
    ganache: {
      url: 'http://ganache:8545',
      accounts: {
        mnemonic: 'fox sight canyon orphan hotel grow hedgehog build bless august weather swarm',
        path: "m/44'/60'/0'/0",
        initialIndex: 0,
        count: 20,
      },
    },
    coverage: {
      url: 'http://localhost:8555',
    },
  },
};

export default config;
