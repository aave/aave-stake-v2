import { DRE, timeLatest } from '../../helpers/misc-utils';
const { expect } = require('chai');

import { makeSuite, TestEnv } from '../helpers/make-suite';
import { deployAaveIncentivesController } from '../../helpers/contracts-accessors';
import { RANDOM_ADDRESSES, ZERO_ADDRESS } from '../../helpers/constants';

makeSuite('AaveIncentivesController constructor tests', (testEnv: TestEnv) => {
  it('should assign correct params', async () => {
    const peiEmissionManager = RANDOM_ADDRESSES[1];
    const rewardToken = RANDOM_ADDRESSES[3];
    const psm = RANDOM_ADDRESSES[5];
    const extraPsmReward = '100';

    const aaveIncentivesController = await deployAaveIncentivesController([
      rewardToken,
      psm,
      extraPsmReward,
      peiEmissionManager,
    ]);
    const { blockNumber } = aaveIncentivesController.deployTransaction;
    if (!blockNumber) {
      throw Error('Missing blocknumber');
    }
    const { timestamp } = await DRE.ethers.provider.getBlock(blockNumber);
    await expect(await aaveIncentivesController.REWARD_TOKEN()).to.be.equal(rewardToken);
    await expect(await aaveIncentivesController.PSM()).to.be.equal(psm);
    await expect((await aaveIncentivesController.EXTRA_PSM_REWARD()).toString()).to.be.equal(
      extraPsmReward
    );
    await expect((await aaveIncentivesController.EMISSION_MANAGER()).toString()).to.be.equal(
      peiEmissionManager
    );
    // Next state variables are not inmutable, so should remain as default
    await expect(await aaveIncentivesController.getRewardsVault()).to.be.equal(ZERO_ADDRESS);
    await expect((await aaveIncentivesController.getDistributionEnd()).toString()).to.be.equal('0');
  });
});
