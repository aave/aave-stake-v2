import { deployContract, getContractFactory, getContract } from './contracts-helpers';
import { eContractid, tEthereumAddress } from './types';
import { MintableErc20 } from '../types/MintableErc20';
import { StakedAave } from '../types/StakedAave';
import { StakedAaveV2 } from '../types/StakedAaveV2';
import {StakedTokenV3 } from '../types/StakedTokenV3';
import { Ierc20Detailed } from '../types/Ierc20Detailed';
import { InitializableAdminUpgradeabilityProxy } from '../types/InitializableAdminUpgradeabilityProxy';
import { AaveIncentivesController } from '../types/AaveIncentivesController';
import { MockTransferHook } from '../types/MockTransferHook';
import { verifyContract } from './etherscan-verification';
import { ATokenMock } from '../types/ATokenMock';
import { getDb, DRE } from './misc-utils';
import { DoubleTransferHelper } from '../types/DoubleTransferHelper';
import { zeroAddress } from 'ethereumjs-util';
import { ZERO_ADDRESS } from './constants';

export const deployStakedAave = async (
  [
    stakedToken,
    rewardsToken,
    cooldownSeconds,
    unstakeWindow,
    rewardsVault,
    emissionManager,
    distributionDuration,
  ]: [
    tEthereumAddress,
    tEthereumAddress,
    string,
    string,
    tEthereumAddress,
    tEthereumAddress,
    string
  ],
  verify?: boolean
) => {
  const id = eContractid.StakedAave;
  const args: string[] = [
    stakedToken,
    rewardsToken,
    cooldownSeconds,
    unstakeWindow,
    rewardsVault,
    emissionManager,
    distributionDuration,
  ];
  const instance = await deployContract<StakedAave>(id, args);
  if (verify) {
    await verifyContract(id, instance.address, args);
  }
  return instance;
};

export const deployStakedAaveV2 = async (
  [
    stakedToken,
    rewardsToken,
    cooldownSeconds,
    unstakeWindow,
    rewardsVault,
    emissionManager,
    distributionDuration,
  ]: [
    tEthereumAddress,
    tEthereumAddress,
    string,
    string,
    tEthereumAddress,
    tEthereumAddress,
    string
  ],
  verify?: boolean
) => {
  const id = eContractid.StakedAaveV2;
  const args: string[] = [
    stakedToken,
    rewardsToken,
    cooldownSeconds,
    unstakeWindow,
    rewardsVault,
    emissionManager,
    distributionDuration,
    ZERO_ADDRESS, // gov address
  ];
  const instance = await deployContract<StakedAaveV2>(id, args);
  if (verify) {
    await verifyContract(id, instance.address, args);
  }
  return instance;
};


export const deployStakedAaveV2 = async (
  [
    stakedToken,
    rewardsToken,
    cooldownSeconds,
    unstakeWindow,
    rewardsVault,
    emissionManager,
    distributionDuration,
  ]: [
    tEthereumAddress,
    tEthereumAddress,
    string,
    string,
    tEthereumAddress,
    tEthereumAddress,
    string
  ],
  verify?: boolean
) => {
  const id = eContractid.StakedAaveV3;
  const args: string[] = [
    stakedToken,
    rewardsToken,
    cooldownSeconds,
    unstakeWindow,
    rewardsVault,
    emissionManager,
    distributionDuration,
    ZERO_ADDRESS, // gov address
  ];
  const instance = await deployContract<StakedAaveV3>(id, args);
  if (verify) {
    await verifyContract(id, instance.address, args);
  }
  return instance;
};

export const deployAaveIncentivesController = async (
  [rewardToken, rewardsVault, aavePsm, extraPsmReward, emissionManager, distributionDuration]: [
    tEthereumAddress,
    tEthereumAddress,
    tEthereumAddress,
    string,
    tEthereumAddress,
    string
  ],
  verify?: boolean
) => {
  const id = eContractid.AaveIncentivesController;
  const args: string[] = [
    rewardToken,
    rewardsVault,
    aavePsm,
    extraPsmReward,
    emissionManager,
    distributionDuration,
  ];
  const instance = await deployContract<AaveIncentivesController>(id, args);
  await instance.deployTransaction.wait();
  if (verify) {
    await verifyContract(id, instance.address, args);
  }
  return instance;
};

export const deployMintableErc20 = async ([name, symbol, decimals]: [string, string, number]) =>
  await deployContract<MintableErc20>(eContractid.MintableErc20, [name, symbol, decimals]);

export const deployInitializableAdminUpgradeabilityProxy = async (verify?: boolean) => {
  const id = eContractid.InitializableAdminUpgradeabilityProxy;
  const args: string[] = [];
  const instance = await deployContract<InitializableAdminUpgradeabilityProxy>(id, args);
  await instance.deployTransaction.wait();
  if (verify) {
    await verifyContract(id, instance.address, args);
  }
  return instance;
};

export const deployMockTransferHook = async () =>
  await deployContract<MockTransferHook>(eContractid.MockTransferHook, []);

export const deployATokenMock = async (aicAddress: tEthereumAddress, slug: string) =>
  await deployContract<ATokenMock>(eContractid.ATokenMock, [aicAddress], slug);

export const deployDoubleTransferHelper = async (aaveToken: tEthereumAddress, verify?: boolean) => {
  const id = eContractid.DoubleTransferHelper;
  const args = [aaveToken];
  const instance = await deployContract<DoubleTransferHelper>(id, args);
  await instance.deployTransaction.wait();
  if (verify) {
    await verifyContract(id, instance.address, args);
  }
  return instance;
};

export const getMintableErc20 = getContractFactory<MintableErc20>(eContractid.MintableErc20);

export const getStakedAave = getContractFactory<StakedAave>(eContractid.StakedAave);
export const getStakedAaveV2 = getContractFactory<StakedAaveV2>(eContractid.StakedAaveV2);

export const getStakedAaveProxy = async (address?: tEthereumAddress) => {
  return await getContract<InitializableAdminUpgradeabilityProxy>(
    eContractid.InitializableAdminUpgradeabilityProxy,
    address || (await getDb().get(`${eContractid.StakedAave}.${DRE.network.name}`).value()).address
  );
};

export const getStakedAaveImpl = async (address?: tEthereumAddress) => {
  return await getContract<StakedAave>(
    eContractid.StakedAave,
    address ||
      (await getDb().get(`${eContractid.StakedAaveImpl}.${DRE.network.name}`).value()).address
  );
};

export const getAaveIncentivesController = getContractFactory<AaveIncentivesController>(
  eContractid.AaveIncentivesController
);

export const getIErc20Detailed = getContractFactory<Ierc20Detailed>(eContractid.IERC20Detailed);

export const getATokenMock = getContractFactory<ATokenMock>(eContractid.ATokenMock);
