import { task } from 'hardhat/config';
import { HardhatRuntimeEnvironment } from 'hardhat/types';

task('deploy-reserve-and-incentives', 'Deployment in hardhat')
  .addFlag('verify')
  .addParam('controller')
  .addParam('rewardToken')
  .addOptionalParam('psm')
  .addOptionalParam('extraPsmReward')
  .addOptionalParam('emissionManager')
  .addOptionalParam('distributionDuration')
  .addParam('proxyAdmin', `The address to be added as an Admin role in proxies.`)
  .addParam('rewardsAdmin', `The address to be added as an Admin role in proxies.`)
  .setAction(
    async (
      {
        verify,
        controller,
        rewardToken,
        psm,
        extraPsmReward,
        emissionManager,
        distributionDuration,
        proxyAdmin,
        rewardsAdmin,
      },
      localBRE
    ) => {
      const DRE: HardhatRuntimeEnvironment = await localBRE.run('set-dre');

      const reserveAddress = await DRE.run('deploy-reserve', {
        verify,
        admin: proxyAdmin,
        controller,
      });

      await DRE.run('deploy-incentives', {
        verify,
        proxyAdmin,
        rewardsAdmin,
        rewardToken,
        rewardsVault: reserveAddress,
        psm,
        extraPsmReward,
        emissionManager,
        distributionDuration,
      });

      console.log('Finished migrations to deploy Aave Reserve and Incentives contracts');
    }
  );
