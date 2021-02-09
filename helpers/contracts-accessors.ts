import { deployContract, getContractFactory, getContract } from './contracts-helpers';
import { eContractid, tEthereumAddress } from './types';
import { MintableErc20 } from '../types/MintableErc20';
import { StakedAave } from '../types/StakedAave';
import { StakedAaveV2 } from '../types/StakedAaveV2';
import { IcrpFactory } from '../types/IcrpFactory'; // Configurable right pool factory
import { IConfigurableRightsPool } from '../types/IConfigurableRightsPool';
import { IControllerAaveEcosystemReserve } from '../types/IControllerAaveEcosystemReserve';
import { SelfdestructTransfer } from '../types/SelfdestructTransfer';
import { IbPool } from '../types/IbPool'; // Balance pool
import { StakedTokenV2 } from '../types/StakedTokenV2';
import { StakedTokenV3 } from '../types/StakedTokenV3';
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
import { Signer } from 'ethers';

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
    await verifyContract(instance.address, args);
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
    await verifyContract(instance.address, args);
  }
  return instance;
};

export const deployStakedTokenV2 = async (
  [
    stakedToken,
    rewardsToken,
    cooldownSeconds,
    unstakeWindow,
    rewardsVault,
    emissionManager,
    distributionDuration,
    name,
    symbol,
    decimals,
    governance,
  ]: [
    tEthereumAddress,
    tEthereumAddress,
    string,
    string,
    tEthereumAddress,
    tEthereumAddress,
    string,
    string,
    string,
    string,
    tEthereumAddress
  ],
  verify?: boolean,
  signer?: Signer
) => {
  const id = eContractid.StakedTokenV2;
  const args: string[] = [
    stakedToken,
    rewardsToken,
    cooldownSeconds,
    unstakeWindow,
    rewardsVault,
    emissionManager,
    distributionDuration,
    name,
    symbol,
    decimals,
    governance,
  ];
  const instance = await deployContract<StakedTokenV2>(id, args, '', signer);
  if (verify) {
    await verifyContract(instance.address, args);
  }
  return instance;
};

export const deployStakedTokenV3 = async (
  [
    stakedToken,
    rewardsToken,
    cooldownSeconds,
    unstakeWindow,
    rewardsVault,
    emissionManager,
    distributionDuration,
    name,
    symbol,
    decimals,
    governance,
  ]: [
    tEthereumAddress,
    tEthereumAddress,
    string,
    string,
    tEthereumAddress,
    tEthereumAddress,
    string,
    string,
    string,
    string,
    tEthereumAddress
  ],
  verify?: boolean,
  signer?: Signer
) => {
  const id = eContractid.StakedTokenV3;
  const args: string[] = [
    stakedToken,
    rewardsToken,
    cooldownSeconds,
    unstakeWindow,
    rewardsVault,
    emissionManager,
    distributionDuration,
    name,
    symbol,
    decimals,
    governance,
  ];
  const instance = await deployContract<StakedTokenV3>(id, args, '', signer);
  if (verify) {
    await verifyContract(instance.address, args);
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
    await verifyContract(instance.address, args);
  }
  return instance;
};

export const deployMintableErc20 = async ([name, symbol, decimals]: [string, string, number]) =>
  await deployContract<MintableErc20>(eContractid.MintableErc20, [name, symbol, decimals]);

export const deployInitializableAdminUpgradeabilityProxy = async (
  verify?: boolean,
  signer?: Signer
) => {
  const id = eContractid.InitializableAdminUpgradeabilityProxy;
  const args: string[] = [];
  const instance = await deployContract<InitializableAdminUpgradeabilityProxy>(
    id,
    args,
    '',
    signer
  );
  await instance.deployTransaction.wait();
  if (verify) {
    await verifyContract(instance.address, args);
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
    await verifyContract(instance.address, args);
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

export const getStakedTokenV2 = async (address?: tEthereumAddress) => {
  return await getContract<StakedTokenV2>(
    eContractid.StakedTokenV2,
    address ||
      (await getDb().get(`${eContractid.StakedTokenV2}.${DRE.network.name}`).value()).address
  );
};
export const getStakedTokenV3 = async (address?: tEthereumAddress) => {
  return await getContract<StakedTokenV3>(
    eContractid.StakedTokenV2,
    address ||
      (await getDb().get(`${eContractid.StakedTokenV2}.${DRE.network.name}`).value()).address
  );
};

export const getAaveIncentivesController = getContractFactory<AaveIncentivesController>(
  eContractid.AaveIncentivesController
);

export const getIErc20Detailed = getContractFactory<Ierc20Detailed>(eContractid.IERC20Detailed);

export const getATokenMock = getContractFactory<ATokenMock>(eContractid.ATokenMock);

export const getCRPFactoryContract = (address: tEthereumAddress) =>
  getContract<IcrpFactory>(eContractid.ICRPFactory, address);

export const getCRPContract = (address: tEthereumAddress) =>
  getContract<IConfigurableRightsPool>(eContractid.IConfigurableRightsPool, address);

export const getBpool = (address: tEthereumAddress) =>
  getContract<IbPool>(eContractid.IBPool, address);

export const getERC20Contract = (address: tEthereumAddress) =>
  getContract<MintableErc20>(eContractid.MintableErc20, address);

export const getController = (address: tEthereumAddress) =>
  getContract<IControllerAaveEcosystemReserve>(
    eContractid.IControllerAaveEcosystemReserve,
    address
  );

export const deploySelfDestruct = async () => {
  const id = eContractid.MockSelfDestruct;
  const instance = await deployContract<SelfdestructTransfer>(id, []);
  await instance.deployTransaction.wait();
  return instance;
};
