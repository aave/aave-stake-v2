import { task } from 'hardhat/config';
import { eContractid } from '../../helpers/types';
import { waitForTx } from '../../helpers/misc-utils';
import {
  deployAaveIncentivesController,
  deployInitializableAdminUpgradeabilityProxy,
} from '../../helpers/contracts-accessors';
import { isAddress } from '@ethersproject/address';
import { ZERO_ADDRESS } from '../../helpers/constants';

const { AaveIncentivesController: id } = eContractid;

task(`deploy-incentives`, `Deploy and initializes the ${id} contract`)
  .addFlag('verify')
  .addParam('rewardToken')
  .addParam('rewardsVault')
  .addParam('emissionManager')
  .addParam('proxyAdmin', `The address to be added as an Admin role in ${id} Transparent Proxy.`)
  .setAction(
    async ({ verify, rewardToken, rewardsVault, emissionManager, proxyAdmin }, localBRE) => {
      await localBRE.run('set-dre');
      if (!isAddress(proxyAdmin)) {
        throw Error('Missing or incorrect admin param');
      }
      if (!isAddress(rewardToken)) {
        throw Error('Missing or incorrect rewardToken param');
      }
      if (!isAddress(rewardsVault)) {
        throw Error('Missing or incorrect rewardsVault param');
      }
      emissionManager = isAddress(emissionManager) ? emissionManager : ZERO_ADDRESS;

      console.log(`\n- ${id} implementation deployment:`);

      const aaveIncentivesControllerImpl = await deployAaveIncentivesController(
        [rewardToken, emissionManager],
        verify
      );

      console.log(`\tInitializing ${id} proxy`);

      const aaveIncentivesProxy = await deployInitializableAdminUpgradeabilityProxy(verify);

      const encodedParams = aaveIncentivesControllerImpl.interface.encodeFunctionData(
        'initialize',
        [rewardsVault]
      );

      await waitForTx(
        await aaveIncentivesProxy.functions['initialize(address,address,bytes)'](
          aaveIncentivesControllerImpl.address,
          proxyAdmin,
          encodedParams
        )
      );

      console.log(`\tFinished ${id} deployment and initialization`);
      console.log(`\t- Proxy: ${aaveIncentivesProxy.address}`);
      console.log(`\t- Impl: ${aaveIncentivesControllerImpl.address}`);
    }
  );
