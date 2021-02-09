const { expect } = require('chai');

import { makeSuite } from '../helpers/make-suite';
import { getRewards } from '../DistributionManager/data-helpers/base-math';
import { getUserIndex } from '../DistributionManager/data-helpers/asset-user-data';
import { getAssetsData } from '../DistributionManager/data-helpers/asset-data';
import { advanceBlock, timeLatest, waitForTx, increaseTimeAndMine } from '../../helpers/misc-utils';
import { getNormalizedDistribution } from '../helpers/ray-math';
import { getBlockTimestamp } from '../../helpers/contracts-helpers';

type ScenarioAction = {
  caseName: string;
  emissionPerSecond: string;
};

const getRewardsBalanceScenarios: ScenarioAction[] = [
  {
    caseName: 'Accrued rewards are 0',
    emissionPerSecond: '0',
  },
  {
    caseName: 'Accrued rewards are not 0',
    emissionPerSecond: '2432424',
  },
  {
    caseName: 'Accrued rewards are not 0',
    emissionPerSecond: '2432424',
  },
];

makeSuite('AaveIncentivesController getRewardsBalance tests', (testEnv) => {
  for (const { caseName, emissionPerSecond } of getRewardsBalanceScenarios) {
    it(caseName, async () => {
      await increaseTimeAndMine(100);

      const { aaveIncentivesController, users, aDaiMock } = testEnv;

      const distributionEndTimestamp = await aaveIncentivesController.DISTRIBUTION_END();
      const userAddress = users[1].address;
      const stakedByUser = 22 * caseName.length;
      const totalStaked = 33 * caseName.length;
      const underlyingAsset = aDaiMock.address;

      // update emissionPerSecond in advance to not affect user calculations
      await advanceBlock((await timeLatest()).plus(100).toNumber());
      if (emissionPerSecond) {
        await aaveIncentivesController.configureAssets([
          { emissionPerSecond, underlyingAsset, totalStaked },
        ]);
      }
      await aDaiMock.handleActionOnAic(userAddress, stakedByUser, totalStaked);
      await advanceBlock((await timeLatest()).plus(100).toNumber());

      const lastTxReceipt = await waitForTx(
        await aDaiMock.setUserBalanceAndSupply(stakedByUser, totalStaked)
      );
      const lastTxTimestamp = await getBlockTimestamp(lastTxReceipt.blockNumber);

      const unclaimedRewardsBefore = await aaveIncentivesController.getUserUnclaimedRewards(
        userAddress
      );

      const unclaimedRewards = await aaveIncentivesController.getRewardsBalance(
        [underlyingAsset],
        userAddress
      );

      const userIndex = await getUserIndex(aaveIncentivesController, userAddress, underlyingAsset);
      const assetData = (await getAssetsData(aaveIncentivesController, [{ underlyingAsset }]))[0];

      await aDaiMock.cleanUserState();

      const expectedAssetIndex = getNormalizedDistribution(
        totalStaked,
        assetData.index,
        assetData.emissionPerSecond,
        assetData.lastUpdateTimestamp,
        lastTxTimestamp,
        distributionEndTimestamp
      );
      const expectedAccruedRewards = getRewards(
        stakedByUser,
        expectedAssetIndex,
        userIndex
      ).toString();

      expect(unclaimedRewards.toString()).to.be.equal(
        unclaimedRewardsBefore.add(expectedAccruedRewards).toString()
      );
    });
  }
});
