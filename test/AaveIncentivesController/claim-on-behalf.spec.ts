import { makeSuite, SignerWithAddress, TestEnv } from '../helpers/make-suite';
import { getRewards } from '../DistributionManager/data-helpers/base-math';
import { getUserIndex } from '../DistributionManager/data-helpers/asset-user-data';
import { getAssetsData } from '../DistributionManager/data-helpers/asset-data';
import {
  advanceBlock,
  timeLatest,
  waitForTx,
  increaseTimeAndMine,
  DRE,
} from '../../helpers/misc-utils';
import { getNormalizedDistribution } from '../helpers/ray-math';
import { getBlockTimestamp } from '../../helpers/contracts-helpers';
import { ZERO_ADDRESS } from '../../helpers/constants';
import { Signer } from 'ethers/lib/ethers';
import { solidity } from 'ethereum-waffle';
import { parseEther } from '@ethersproject/units';

const chai = require('chai');

chai.use(solidity);

const { expect } = chai;

type ScenarioAction = {
  caseName: string;
  caller: number;
  userOnBehalf: number | string;
  revertReason?: string;
  whitelisted?: boolean;
};

const getRewardsBalanceScenarios: ScenarioAction[] = [
  {
    caseName: 'User is ZERO ADDRESS',
    caller: 2,
    userOnBehalf: ZERO_ADDRESS,
    revertReason: 'USER_OR_CALLER_NOT_ZERO_ADDRESS',
  },
  {
    caseName: 'Claimer is NOT allowed to claim user rewards',
    caller: 1,
    userOnBehalf: 2,
    revertReason: 'CALLER_NOT_ALLOWED_TO_CLAIM_ON_BEHALF',
  },
  {
    caseName: 'Claimer is allowed to claim user rewards',
    caller: 3,
    userOnBehalf: 4,
    whitelisted: true,
  },
];

makeSuite('AaveIncentivesController - Claim on behalf', (testEnv: TestEnv) => {
  for (const {
    caseName,
    caller: _caller,
    userOnBehalf: _userOnBehalf,
    whitelisted,
    revertReason,
  } of getRewardsBalanceScenarios) {
    it(caseName, async () => {
      await increaseTimeAndMine(100);

      const { aaveIncentivesController, aDaiMock, rewardsAdmin, users } = testEnv;

      const underlyingAsset = aDaiMock.address;
      const totalStaked = 33 * caseName.length;
      const emissionPerSecond = '1000';

      await aaveIncentivesController.configureAssets([
        { emissionPerSecond, underlyingAsset, totalStaked },
      ]);

      const caller = users[_caller];
      const userOnBehalf =
        _userOnBehalf === ZERO_ADDRESS ? ZERO_ADDRESS : users[_userOnBehalf].address;

      if (whitelisted) {
        await aaveIncentivesController
          .connect(rewardsAdmin.signer)
          .allowClaimOnBehalf(userOnBehalf, caller.address);
      }

      if (revertReason) {
        await expect(
          aaveIncentivesController
            .connect(caller.signer)
            .claimRewardsOnBehalf([underlyingAsset], '0', userOnBehalf, userOnBehalf)
        ).to.be.revertedWith(revertReason);
      } else {
        await aaveIncentivesController
          .connect(caller.signer)
          .claimRewardsOnBehalf([underlyingAsset], '0', userOnBehalf, userOnBehalf);
      }
    });
  }
});
