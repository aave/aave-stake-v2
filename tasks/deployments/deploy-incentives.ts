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
  .addFlag('deployProxy')
  .addParam('rewardToken')
  .addParam('emissionManager')
  .addOptionalParam('rewardsVault')
  .addOptionalParam(
    'proxyAdmin',
    `The address to be added as an Admin role in ${id} Transparent Proxy.`
  )
  .setAction(
    async (
      { deployProxy, verify, rewardToken, rewardsVault, emissionManager, proxyAdmin },
      localBRE
    ) => {
      await localBRE.run('set-dre');

      if (!isAddress(rewardToken)) {
        throw Error('Missing or incorrect rewardToken param');
      }
      if (!isAddress(emissionManager)) {
        throw Error('Missing or incorrect emissionManager param');
      }
      if (deployProxy && !isAddress(proxyAdmin)) {
        throw Error('Missing or incorrect admin param');
      }
      if (deployProxy && !isAddress(rewardsVault)) {
        throw Error('Missing or incorrect rewardsVault param');
      }

      console.log(`\n- ${id} implementation deployment:`);

      const aaveIncentivesControllerImpl = await deployAaveIncentivesController(
        [rewardToken, emissionManager],
        verify
      );

      if (deployProxy) {
        console.log(`\tDeploying${id} proxy`);
        const aaveIncentivesProxy = await deployInitializableAdminUpgradeabilityProxy(verify);

        console.log(`\tInitializing ${id} proxy`);
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
      } else {
        console.log(`\tFinished ${id} deployment and initialization`);
        console.log(`\t- Impl: ${aaveIncentivesControllerImpl.address}`);
      }
    }
  );
