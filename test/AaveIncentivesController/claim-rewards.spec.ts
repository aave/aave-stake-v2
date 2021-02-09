import { MAX_UINT_AMOUNT, PSM_STAKER_PREMIUM, RANDOM_ADDRESSES } from '../../helpers/constants';

const { expect } = require('chai');

import { makeSuite } from '../helpers/make-suite';
import { BigNumber } from 'ethers';
import { waitForTx, increaseTimeAndMine } from '../../helpers/misc-utils';
import { comparatorEngine, eventChecker } from '../helpers/comparator-engine';
import { getUserIndex } from '../DistributionManager/data-helpers/asset-user-data';
import { assetDataComparator, getAssetsData } from '../DistributionManager/data-helpers/asset-data';
import { getBlockTimestamp } from '../../helpers/contracts-helpers';
import { getRewards } from '../DistributionManager/data-helpers/base-math';
import { fail } from 'assert';

type ScenarioAction = {
  caseName: string;
  emissionPerSecond?: string;
  amountToClaim: string;
  to?: string;
  toStake?: boolean;
};

const getRewardsBalanceScenarios: ScenarioAction[] = [
  {
    caseName: 'Accrued rewards are 0, claim 0',
    emissionPerSecond: '0',
    amountToClaim: '0',
  },
  {
    caseName: 'Accrued rewards are 0, claim not 0',
    emissionPerSecond: '0',
    amountToClaim: '100',
  },
  {
    caseName: 'Accrued rewards are not 0',
    emissionPerSecond: '2432424',
    amountToClaim: '10',
  },
  {
    caseName: 'Should allow -1',
    emissionPerSecond: '2432424',
    amountToClaim: MAX_UINT_AMOUNT,
    toStake: false,
  },
  {
    caseName: 'Should add extra premium on withdrawal to stake',
    emissionPerSecond: '1200',
    amountToClaim: '1034',
    toStake: true,
  },
  {
    caseName: 'Should withdraw everything if amountToClaim more then rewards balance',
    emissionPerSecond: '100',
    amountToClaim: '1034',
    toStake: true,
  },
  {
    caseName: 'Should withdraw to another user',
    emissionPerSecond: '100',
    amountToClaim: '1034',
    to: RANDOM_ADDRESSES[5],
  },
  {
    caseName: 'Should withdraw to another user and stake',
    emissionPerSecond: '100',
    amountToClaim: '1034',
    to: RANDOM_ADDRESSES[5],
    toStake: true,
  },
];

makeSuite('AaveIncentivesController claimRewards tests', (testEnv) => {
  for (const {
    caseName,
    amountToClaim: _amountToClaim,
    to,
    toStake,
    emissionPerSecond,
  } of getRewardsBalanceScenarios) {
    let amountToClaim = _amountToClaim;
    it(caseName, async () => {
      await increaseTimeAndMine(100);
      const { aaveIncentivesController, stakedAave, aaveToken, aDaiMock } = testEnv;

      const distributionEndTimestamp = await aaveIncentivesController.DISTRIBUTION_END();
      const userAddress = await aaveIncentivesController.signer.getAddress();

      const underlyingAsset = aDaiMock.address;
      const stakedByUser = 22 * caseName.length;
      const totalStaked = 33 * caseName.length;

      // update emissionPerSecond in advance to not affect user calculations
      if (emissionPerSecond) {
        await aaveIncentivesController.configureAssets([
          { emissionPerSecond, underlyingAsset, totalStaked },
        ]);
      }

      const destinationAddress = to || userAddress;

      const destinationAddressBalanceBefore = await (toStake ? stakedAave : aaveToken).balanceOf(
        destinationAddress
      );
      await aDaiMock.setUserBalanceAndSupply(stakedByUser, totalStaked);
      const unclaimedRewardsBefore = await aaveIncentivesController.getUserUnclaimedRewards(
        userAddress
      );
      const userIndexBefore = await getUserIndex(
        aaveIncentivesController,
        userAddress,
        underlyingAsset
      );
      const assetDataBefore = (
        await getAssetsData(aaveIncentivesController, [{ underlyingAsset }])
      )[0];

      const claimRewardsReceipt = await waitForTx(
        await aaveIncentivesController.claimRewards(
          [underlyingAsset],
          amountToClaim,
          destinationAddress,
          toStake || false
        )
      );
      const eventsEmitted = claimRewardsReceipt.events || [];
      const actionBlockTimestamp = await getBlockTimestamp(claimRewardsReceipt.blockNumber);

      const userIndexAfter = await getUserIndex(
        aaveIncentivesController,
        userAddress,
        underlyingAsset
      );
      const assetDataAfter = (
        await getAssetsData(aaveIncentivesController, [{ underlyingAsset }])
      )[0];

      const unclaimedRewardsAfter = await aaveIncentivesController.getUserUnclaimedRewards(
        userAddress
      );

      const destinationAddressBalanceAfter = await (toStake ? stakedAave : aaveToken).balanceOf(
        destinationAddress
      );

      const claimedAmount = destinationAddressBalanceAfter.sub(destinationAddressBalanceBefore);

      const expectedAccruedRewards = getRewards(
        stakedByUser,
        userIndexAfter,
        userIndexBefore
      ).toString();

      await aDaiMock.cleanUserState();

      if (amountToClaim === '0') {
        // state should not change
        expect(userIndexBefore.toString()).to.be.equal(
          userIndexAfter.toString(),
          'userIndexAfter should not change'
        );
        expect(unclaimedRewardsBefore.toString()).to.be.equal(
          unclaimedRewardsAfter.toString(),
          'unclaimedRewards should not change'
        );
        expect(destinationAddressBalanceBefore.toString()).to.be.equal(
          destinationAddressBalanceAfter.toString(),
          'destinationAddressBalance should not change'
        );
        await comparatorEngine(
          ['emissionPerSecond', 'index', 'lastUpdateTimestamp'],
          { underlyingAsset, totalStaked },
          assetDataBefore,
          assetDataAfter,
          actionBlockTimestamp,
          {}
        );
        expect(eventsEmitted.length).to.be.equal(0, 'no events should be emitted');
        return;
      }

      // ------- Distribution Manager tests START -----
      await assetDataComparator(
        { underlyingAsset, totalStaked },
        assetDataBefore,
        assetDataAfter,
        actionBlockTimestamp,
        distributionEndTimestamp.toNumber(),
        {}
      );
      expect(userIndexAfter.toString()).to.be.equal(
        assetDataAfter.index.toString(),
        'user index are not correctly updated'
      );
      if (!assetDataAfter.index.eq(assetDataBefore.index)) {
        eventChecker(eventsEmitted[0], 'AssetIndexUpdated', [
          assetDataAfter.underlyingAsset,
          assetDataAfter.index,
        ]);
        eventChecker(eventsEmitted[1], 'UserIndexUpdated', [
          userAddress,
          assetDataAfter.underlyingAsset,
          assetDataAfter.index,
        ]);
      }
      // ------- Distribution Manager tests END -----

      let unclaimedRewardsCalc = unclaimedRewardsBefore.add(expectedAccruedRewards);

      let expectedClaimedAmount: BigNumber;
      if (unclaimedRewardsCalc.lte(amountToClaim)) {
        expectedClaimedAmount = unclaimedRewardsCalc;
        expect(unclaimedRewardsAfter.toString()).to.be.equal(
          '0',
          'unclaimed amount after should go to 0'
        );
      } else {
        expectedClaimedAmount = BigNumber.from(amountToClaim);
        expect(unclaimedRewardsAfter.toString()).to.be.equal(
          unclaimedRewardsCalc.sub(amountToClaim).toString(),
          'unclaimed rewards after are wrong'
        );
      }

      if (toStake) {
        expectedClaimedAmount = expectedClaimedAmount.add(
          expectedClaimedAmount.mul(PSM_STAKER_PREMIUM).div('100')
        );
      }
      expect(claimedAmount.toString()).to.be.equal(
        expectedClaimedAmount.toString(),
        'claimed amount are wrong'
      );
      if (expectedAccruedRewards !== '0') {
        const rewardsAccruedEvent = eventsEmitted.find(({ event }) => event === 'RewardsAccrued');
        // Expect event to exist
        expect(rewardsAccruedEvent).to.be.ok;
        if (rewardsAccruedEvent) {
          eventChecker(rewardsAccruedEvent, 'RewardsAccrued', [
            userAddress,
            expectedAccruedRewards,
          ]);
        } else {
          fail('missing accrued event');
        }
      }
      if (expectedClaimedAmount.gt(0)) {
        const rewardsClaimedEvent = eventsEmitted.find(({ event }) => event === 'RewardsClaimed');
        // Expect event to exist
        expect(rewardsClaimedEvent).to.be.ok;
        if (rewardsClaimedEvent) {
          eventChecker(rewardsClaimedEvent, 'RewardsClaimed', [
            userAddress,
            destinationAddress,
            expectedClaimedAmount,
          ]);
        } else {
          fail('missing reward event');
        }
      }
    });
  }
});
