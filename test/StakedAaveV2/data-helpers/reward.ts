const chai = require('chai');
const { expect, assert } = chai;
const ChaiBigNumber = require('chai-bignumber');

import { ethers, ContractTransaction, BigNumberish, BigNumber } from 'ethers';

import { StakedAave } from '../../../types/StakedAave';

import { getRewards } from '../../DistributionManager/data-helpers/base-math';
import { getUserIndex } from '../../DistributionManager/data-helpers/asset-user-data';
import { eventChecker } from '../../helpers/comparator-engine';
import { waitForTx, increaseTime } from '../../../helpers/misc-utils';
import { SignerWithAddress } from '../../helpers/make-suite';
import { StakedAaveV2 } from '../../../types/StakedAaveV2';
import { solidity } from 'ethereum-waffle';

chai.use(solidity);

type AssetConfig = {
  totalStaked: BigNumberish;
  emissionPerSecond: BigNumberish;
};

export const compareRewardsAtAction = async (
  stakedAaveV2: StakedAaveV2,
  userAddress: string,
  actions: () => Promise<ContractTransaction>[],
  shouldReward?: boolean,
  assetConfig?: AssetConfig
): Promise<void> => {
  const underlyingAsset = stakedAaveV2.address;
  // To prevent coverage to fail, add 5 seconds per comparisson.
  await increaseTime(5);

  const rewardsBalanceBefore = BigNumber.from(
    await (await stakedAaveV2.getTotalRewardsBalance(userAddress)).toString()
  );

  // Configure assets of stake token
  const assetConfiguration = assetConfig
    ? {
        ...assetConfig,
        underlyingAsset,
      }
    : {
        emissionPerSecond: '100',
        totalStaked: await stakedAaveV2.totalSupply(),
        underlyingAsset,
      };
  await stakedAaveV2.configureAssets([assetConfiguration]);

  const userBalance = await stakedAaveV2.balanceOf(userAddress);
  // Get index before actions
  const userIndexBefore = await getUserIndex(stakedAaveV2, userAddress, underlyingAsset);

  // Dispatch actions that can or not update the user index
  const receipts: ethers.ContractReceipt[] = await Promise.all(
    await actions().map(async (action) => waitForTx(await action))
  );
  // Get index after actions
  const userIndexAfter = await getUserIndex(stakedAaveV2, userAddress, underlyingAsset);

  // Compare calculated JS rewards versus Solidity user rewards
  const rewardsBalanceAfter = BigNumber.from(
    await (await stakedAaveV2.getTotalRewardsBalance(userAddress)).toString()
  );
  const expectedAccruedRewards = getRewards(userBalance, userIndexAfter, userIndexBefore);

  expect(rewardsBalanceAfter).to.eq(rewardsBalanceBefore.add(expectedAccruedRewards));

  // Explicit check rewards when the test case expects rewards to the user
  if (shouldReward) {
    expect(expectedAccruedRewards).to.be.gt(0);
  } else {
    expect(expectedAccruedRewards).to.be.eq(0);
    expect(rewardsBalanceAfter).to.be.eq(rewardsBalanceBefore);
  }

  // Check the reward event values if any in the latest tx receipt
  if (expectedAccruedRewards.gt('0')) {
    const latestReceipt = receipts[receipts.length - 1];
    const eventAccrued = latestReceipt.events?.find(({ event }) => event === 'RewardsAccrued');
    if (eventAccrued) {
      eventChecker(eventAccrued, 'RewardsAccrued', [
        userAddress,
        expectedAccruedRewards.toString(),
      ]);
    } else {
      assert.fail('RewardsAccrued event must be emitted');
    }
  }
};

export const compareRewardsAtTransfer = async (
  stakedAaveV2: StakedAaveV2,
  from: SignerWithAddress,
  to: SignerWithAddress,
  amount: BigNumberish,
  fromShouldReward?: boolean,
  toShouldReward?: boolean,
  assetConfig?: AssetConfig
): Promise<void> => {
  // Increase time to prevent coverage to fail
  await increaseTime(5);

  const fromAddress = from.address;
  const toAddress = to.address;
  const underlyingAsset = stakedAaveV2.address;
  const fromSavedBalance = await stakedAaveV2.balanceOf(fromAddress);
  const toSavedBalance = await stakedAaveV2.balanceOf(toAddress);
  const fromSavedRewards = BigNumber.from(
    await (await stakedAaveV2.getTotalRewardsBalance(fromAddress)).toString()
  );
  const toSavedRewards = BigNumber.from(
    await (await stakedAaveV2.getTotalRewardsBalance(toAddress)).toString()
  );
  // Get index before actions
  const fromIndexBefore = await getUserIndex(stakedAaveV2, fromAddress, underlyingAsset);
  const toIndexBefore = await getUserIndex(stakedAaveV2, toAddress, underlyingAsset);

  // Load actions that can or not update the user index
  const actions = () => [stakedAaveV2.connect(from.signer).transfer(toAddress, amount)];

  // Fire reward comparator
  await compareRewardsAtAction(stakedAaveV2, fromAddress, actions, fromShouldReward, assetConfig);

  // Check rewards after transfer

  // Get index after actions
  const fromIndexAfter = await getUserIndex(stakedAaveV2, fromAddress, underlyingAsset);
  const toIndexAfter = await getUserIndex(stakedAaveV2, toAddress, underlyingAsset);

  // FROM: Compare calculated JS rewards versus Solidity user rewards
  const fromRewardsBalanceAfter = BigNumber.from(
    await (await stakedAaveV2.getTotalRewardsBalance(fromAddress)).toString()
  );
  const fromExpectedAccruedRewards = getRewards(fromSavedBalance, fromIndexAfter, fromIndexBefore);
  expect(fromRewardsBalanceAfter).to.bignumber.eq(fromSavedRewards.add(fromExpectedAccruedRewards));

  // TO: Compare calculated JS rewards versus Solidity user rewards
  const toRewardsBalanceAfter = BigNumber.from(
    await (await stakedAaveV2.getTotalRewardsBalance(toAddress)).toString()
  );
  const toExpectedAccruedRewards = getRewards(toSavedBalance, toIndexAfter, toIndexBefore);
  expect(toRewardsBalanceAfter).to.bignumber.eq(toSavedRewards.add(toExpectedAccruedRewards));

  // Explicit check rewards when the test case expects rewards to the user
  if (fromShouldReward) {
    expect(fromExpectedAccruedRewards).to.be.gt(0);
  } else {
    expect(fromExpectedAccruedRewards).to.be.eq(0);
  }

  // Explicit check rewards when the test case expects rewards to the user
  if (toShouldReward) {
    expect(toExpectedAccruedRewards).to.be.gt(0);
  } else {
    expect(toExpectedAccruedRewards).to.be.eq(0);
  }

  // Expect new balances
  if (fromAddress === toAddress) {
    expect(fromSavedBalance.toString()).to.be.equal(toSavedBalance.toString());
  } else {
    const fromNewBalance = await (await stakedAaveV2.balanceOf(fromAddress)).toString();
    const toNewBalance = await (await stakedAaveV2.balanceOf(toAddress)).toString();
    expect(fromNewBalance).to.be.equal(fromSavedBalance.sub(amount).toString());
    expect(toNewBalance).to.be.equal(toSavedBalance.add(amount).toString());
  }
};
