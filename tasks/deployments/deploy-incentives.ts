import { task } from 'hardhat/config';
import { eContractid } from '../../helpers/types';
import { waitForTx } from '../../helpers/misc-utils';
import {
  deployAaveIncentivesController,
  deployInitializableAdminUpgradeabilityProxy,
} from '../../helpers/contracts-accessors';
import { isAddress } from '@ethersproject/address';
import { ZERO_ADDRESS } from '../../helpers/constants';
import { BigNumber } from '@ethersproject/bignumber';

const { AaveIncentivesController: id } = eContractid;

task(`deploy-incentives`, `Deploy and initializes the ${id} contract`)
  .addFlag('verify')
  .addParam('rewardToken')
  .addParam('rewardsVault')
  .addOptionalParam('psm')
  .addOptionalParam('extraPsmReward')
  .addOptionalParam('emissionManager')
  .addOptionalParam('distributionDuration')
  .addParam('admin', `The address to be added as an Admin role in ${id} Transparent Proxy.`)
  .setAction(
    async (
      {
        verify,
        admin,
        rewardToken,
        rewardsVault,
        psm,
        extraPsmReward,
        emissionManager,
        distributionDuration,
      },
      localBRE
    ) => {
      await localBRE.run('set-dre');
      if (!isAddress(admin)) {
        throw Error('Missing or incorrect admin param');
      }
      if (!isAddress(rewardToken)) {
        throw Error('Missing or incorrect rewardToken param');
      }
      if (!isAddress(rewardsVault)) {
        throw Error('Missing or incorrect rewardsVault param');
      }
      psm = isAddress(psm) ? psm : ZERO_ADDRESS;
      extraPsmReward = extraPsmReward ? BigNumber.from(extraPsmReward) : BigNumber.from('0');
      emissionManager = isAddress(emissionManager) ? emissionManager : ZERO_ADDRESS;
      distributionDuration = distributionDuration
        ? BigNumber.from(distributionDuration)
        : BigNumber.from('0');

      console.log(`\n- ${id} implementation deployment:`);

      const aaveIncentivesControllerImpl = await deployAaveIncentivesController(
        [rewardToken, rewardsVault, psm, extraPsmReward, emissionManager, distributionDuration],
        verify
      );

      console.log(`\tInitializing ${id} proxy`);

      const aaveIncentivesProxy = await deployInitializableAdminUpgradeabilityProxy(verify);

      const encodedParams = aaveIncentivesControllerImpl.interface.encodeFunctionData('initialize');

      await waitForTx(
        await aaveIncentivesProxy.functions['initialize(address,address,bytes)'](
          aaveIncentivesControllerImpl.address,
          admin,
          encodedParams
        )
      );

      console.log(`\tFinished ${id} deployment and initialization`);
      console.log(`\t- Proxy: ${aaveIncentivesProxy.address}`);
      console.log(`\t- Impl: ${aaveIncentivesControllerImpl.address}`);
    }
  );
