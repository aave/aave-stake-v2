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
  .addParam('admin', `The address to be added as an Admin role in proxies.`)
  .setAction(
    async (
      {
        verify,
        admin,
        controller,
        rewardToken,
        psm,
        extraPsmReward,
        emissionManager,
        distributionDuration,
      },
      localBRE
    ) => {
      const DRE: HardhatRuntimeEnvironment = await localBRE.run('set-dre');

      const reserveAddress = await DRE.run('deploy-reserve', { verify, admin, controller });

      await DRE.run('deploy-incentives', {
        verify,
        admin,
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
