import { deployContract, getContractFactory, getContract } from './contracts-helpers';
import { eContractid, tEthereumAddress } from './types';
import { MintableErc20 } from '../types/MintableErc20';
import { StakedAave } from '../types/StakedAave';
import { StakedAaveV2 } from '../types/StakedAaveV2';
import { StakedAaveV3 } from '../types/StakedAaveV3';
import { AaveEcosystemReserve } from '../types/AaveEcosystemReserve';
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
import { verifyContract } from './contracts-helpers';
import { ATokenMock } from '../types/ATokenMock';
import { getDb, DRE } from './misc-utils';
import { DoubleTransferHelper } from '../types/DoubleTransferHelper';
import { ZERO_ADDRESS } from './constants';
import { Signer } from 'ethers';
import { StakedTokenBptRev2, StakedTokenV2Rev3 } from '../types';

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
    await verifyContract(id, instance, args);
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
    await verifyContract(id, instance, args);
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
    await verifyContract(id, instance, args);
  }
  return instance;
};

export const deployStakedTokenV2Revision3 = async (
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
  const id = eContractid.StakedTokenV2Rev3;
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
  const instance = await deployContract<StakedTokenV2Rev3>(id, args, '', signer);
  if (verify) {
    await verifyContract(id, instance, args);
  }
  return instance;
};

export const deployStakedTokenBptRevision2 = async (
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
  const id = eContractid.StakedTokenBptRev2;
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
  const instance = await deployContract<StakedTokenBptRev2>(id, args, '', signer);
  if (verify) {
    await verifyContract(id, instance, args);
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
    await verifyContract(id, instance, args);
  }
  return instance;
};

export const deployStakedAaveV3 = async (
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
    await verifyContract(id, instance, args);
  }
  return instance;
};

export const deployAaveIncentivesController = async (
  [rewardToken, aavePsm]: [tEthereumAddress, tEthereumAddress],
  verify?: boolean
) => {
  const id = eContractid.AaveIncentivesController;
  const args: string[] = [rewardToken, aavePsm];
  const instance = await deployContract<AaveIncentivesController>(id, args);
  await instance.deployTransaction.wait();
  if (verify) {
    await verifyContract(id, instance, args);
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
    await verifyContract(id, instance, args);
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
    await verifyContract(id, instance, args);
  }
  return instance;
};

export const deploySelfDestruct = async () => {
  const id = eContractid.MockSelfDestruct;
  const instance = await deployContract<SelfdestructTransfer>(id, []);
  await instance.deployTransaction.wait();
  return instance;
};

export const deployAaveEcosystemReserve = async (verify?: boolean) => {
  const id = eContractid.AaveEcosystemReserve;
  const args: string[] = [];
  const instance = await deployContract<AaveEcosystemReserve>(id, args);
  if (verify) {
    verifyContract(id, instance, args);
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

export const getAaveIncentivesController = async (address?: tEthereumAddress) =>
  await getContract<AaveIncentivesController>(
    eContractid.AaveIncentivesController,
    address ||
      (await getDb().get(`${eContractid.AaveIncentivesController}.${DRE.network.name}`).value())
        .address
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

export const getAaveEcosystemReserve = async (address: tEthereumAddress) =>
  await getContract<AaveEcosystemReserve>(eContractid.AaveEcosystemReserve, address);

export const getInitializableAdminUpgradeabilityProxy = async (address: tEthereumAddress) =>
  await getContract<InitializableAdminUpgradeabilityProxy>(
    eContractid.InitializableAdminUpgradeabilityProxy,
    address
  );
