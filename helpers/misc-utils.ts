import BigNumber from 'bignumber.js';
import low from 'lowdb';
import FileSync from 'lowdb/adapters/FileSync';
import { WAD } from './constants';
import { Wallet, ContractTransaction } from 'ethers';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { iParamsPerNetwork, eEthereumNetwork, tEthereumAddress } from './types';
import { getCurrentBlock } from './contracts-helpers';
import { time } from 'console';

export const toWad = (value: string | number) => new BigNumber(value).times(WAD).toFixed();

export const stringToBigNumber = (amount: string): BigNumber => new BigNumber(amount);

export const getDb = () => low(new FileSync('./deployed-contracts.json'));

export let DRE: HardhatRuntimeEnvironment = {} as HardhatRuntimeEnvironment;

export const setDRE = (_DRE: HardhatRuntimeEnvironment) => {
  DRE = _DRE;
};

export const getParamPerNetwork = <T>(
  { kovan, ropsten, main, hardhat, goerli }: iParamsPerNetwork<T>,
  network: eEthereumNetwork
) => {
  switch (network) {
    case eEthereumNetwork.hardhat:
      return hardhat;
    case eEthereumNetwork.kovan:
      return kovan;
    case eEthereumNetwork.ropsten:
      return ropsten;
    case eEthereumNetwork.main:
      return main;
    case eEthereumNetwork.goerli:
      return goerli;
    default:
      return main;
  }
};

export const sleep = (milliseconds: number) => {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
};

export const createRandomAddress = () => Wallet.createRandom().address;

export const waitForTx = async (tx: ContractTransaction) => await tx.wait();

export const evmSnapshot = async () => await DRE.ethers.provider.send('evm_snapshot', []);

export const evmRevert = async (id: string) => DRE.ethers.provider.send('evm_revert', [id]);

export const timeLatest = async () => {
  const block = await DRE.ethers.provider.getBlock('latest');
  return new BigNumber(block.timestamp);
};

export const increaseTime = async (secondsToIncrease: number) =>
  await DRE.ethers.provider.send('evm_increaseTime', [secondsToIncrease]);

export const increaseTimeTenderly = async (secondsToIncrease: number) => {
  if (DRE.network.name.includes('tenderly')) {
    await DRE.ethers.provider.send('evm_increaseTime', [`0x${secondsToIncrease.toString(16)}`]);
    return;
  }
  await DRE.ethers.provider.send('evm_increaseTime', [secondsToIncrease]);
  await DRE.ethers.provider.send('evm_mine', []);
};

export const advanceBlock = async (timestamp?: number) => {
  const priorBlock = await getCurrentBlock();
  await DRE.ethers.provider.send('evm_mine', timestamp ? [timestamp] : []);
  const nextBlock = await getCurrentBlock();
  if (!timestamp && nextBlock == priorBlock) {
    await advanceBlock();
    return;
  }
};

export const increaseTimeAndMineTenderly = async (secondsToIncrease: number) => {
  await increaseTimeTenderly(secondsToIncrease);
};

export const increaseTimeAndMine = async (secondsToIncrease: number) => {
  await DRE.ethers.provider.send('evm_increaseTime', [secondsToIncrease]);
  await DRE.ethers.provider.send('evm_mine', []);
};

export const impersonateAccountsHardhat = async (accounts: tEthereumAddress[]) => {
  if (DRE.network.name !== 'hardhat') {
    return;
  }

  for (const account of accounts) {
    await DRE.network.provider.request({
      method: 'hardhat_impersonateAccount',
      params: [account],
    });
  }
};

export const latestBlock = async () => DRE.ethers.provider.getBlockNumber();

export const advanceBlockTo = async (target: number) => {
  const currentBlock = await latestBlock();
  if (DRE.network.name.includes('tenderly')) {
    const pendingBlocks = target - currentBlock - 1;

    const response = await DRE.ethers.provider.send('evm_increaseBlocks', [
      `0x${pendingBlocks.toString(16)}`,
    ]);

    return;
  }
  const start = Date.now();
  let notified;
  if (target < currentBlock)
    throw Error(`Target block #(${target}) is lower than current block #(${currentBlock})`);
  // eslint-disable-next-line no-await-in-loop
  while ((await latestBlock()) < target) {
    if (!notified && Date.now() - start >= 5000) {
      notified = true;
      console.log("advanceBlockTo: Advancing too many blocks is causing this test to be slow.'");
    }
    // eslint-disable-next-line no-await-in-loop
    await advanceBlock(0);
  }
};
