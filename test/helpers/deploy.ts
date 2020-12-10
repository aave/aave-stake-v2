import { Signer } from 'ethers';
import {
  PSM_STAKER_PREMIUM,
  COOLDOWN_SECONDS,
  UNSTAKE_WINDOW,
  STAKED_AAVE_NAME,
  STAKED_AAVE_SYMBOL,
  STAKED_AAVE_DECIMALS,
  MAX_UINT_AMOUNT,
} from '../../helpers/constants';
import {
  deployInitializableAdminUpgradeabilityProxy,
  deployAaveIncentivesController,
  deployStakedAave,
  deployMockTransferHook,
  deployStakedAaveV2,
} from '../../helpers/contracts-accessors';
import { insertContractAddressInDb } from '../../helpers/contracts-helpers';
import { waitForTx } from '../../helpers/misc-utils';
import { eContractid } from '../../helpers/types';
import { MintableErc20 } from '../../types/MintableErc20';

export const testDeployAaveStakeV1 = async (
  aaveToken: MintableErc20,
  deployer: Signer,
  vaultOfRewards: Signer,
  restWallets: Signer[]
) => {
  const proxyAdmin = await restWallets[0].getAddress();
  const emissionManager = await deployer.getAddress();

  const stakedToken = aaveToken.address;
  const rewardsToken = aaveToken.address;

  const vaultOfRewardsAddress = await vaultOfRewards.getAddress();

  const aaveIncentivesControllerProxy = await deployInitializableAdminUpgradeabilityProxy();
  const stakedAaveProxy = await deployInitializableAdminUpgradeabilityProxy();

  const aaveIncentivesControllerImplementation = await deployAaveIncentivesController([
    aaveToken.address,
    vaultOfRewardsAddress,
    stakedAaveProxy.address,
    PSM_STAKER_PREMIUM,
    emissionManager,
    (1000 * 60 * 60).toString(),
  ]);

  const stakedAaveImpl = await deployStakedAave([
    stakedToken,
    rewardsToken,
    COOLDOWN_SECONDS,
    UNSTAKE_WINDOW,
    vaultOfRewardsAddress,
    emissionManager,
    (1000 * 60 * 60).toString(),
  ]);

  const mockTransferHook = await deployMockTransferHook();

  const stakedAaveEncodedInitialize = stakedAaveImpl.interface.encodeFunctionData('initialize', [
    mockTransferHook.address,
    STAKED_AAVE_NAME,
    STAKED_AAVE_SYMBOL,
    STAKED_AAVE_DECIMALS,
  ]);
  await stakedAaveProxy['initialize(address,address,bytes)'](
    stakedAaveImpl.address,
    proxyAdmin,
    stakedAaveEncodedInitialize
  );
  await waitForTx(
    await aaveToken.connect(vaultOfRewards).approve(stakedAaveProxy.address, MAX_UINT_AMOUNT)
  );
  await insertContractAddressInDb(eContractid.StakedAave, stakedAaveProxy.address);

  const peiEncodedInitialize = aaveIncentivesControllerImplementation.interface.encodeFunctionData(
    'initialize'
  );
  await aaveIncentivesControllerProxy['initialize(address,address,bytes)'](
    aaveIncentivesControllerImplementation.address,
    proxyAdmin,
    peiEncodedInitialize
  );
  await waitForTx(
    await aaveToken
      .connect(vaultOfRewards)
      .approve(aaveIncentivesControllerProxy.address, MAX_UINT_AMOUNT)
  );
  await insertContractAddressInDb(
    eContractid.AaveIncentivesController,
    aaveIncentivesControllerProxy.address
  );

  return {
    aaveIncentivesControllerProxy,
    stakedAaveProxy,
  };
};

export const testDeployAaveStakeV2 = async (
  aaveToken: MintableErc20,
  deployer: Signer,
  vaultOfRewards: Signer,
  restWallets: Signer[]
) => {
  const stakedToken = aaveToken.address;
  const rewardsToken = aaveToken.address;
  const emissionManager = await deployer.getAddress();
  const vaultOfRewardsAddress = await vaultOfRewards.getAddress();

  const { stakedAaveProxy } = await testDeployAaveStakeV1(
    aaveToken,
    deployer,
    vaultOfRewards,
    restWallets
  );

  const stakedAaveImpl = await deployStakedAaveV2([
    stakedToken,
    rewardsToken,
    COOLDOWN_SECONDS,
    UNSTAKE_WINDOW,
    vaultOfRewardsAddress,
    emissionManager,
    (1000 * 60 * 60).toString(),
  ]);

  const stakedAaveEncodedInitialize = stakedAaveImpl.interface.encodeFunctionData('initialize');

  await stakedAaveProxy
    .connect(restWallets[0])
    .upgradeToAndCall(stakedAaveImpl.address, stakedAaveEncodedInitialize);

  await insertContractAddressInDb(eContractid.StakedAaveV2, stakedAaveProxy.address);

  return {
    stakedAaveProxy,
  };
};
