import { tEthereumAddress } from '../../../helpers/types';
import { MintableErc20 } from '../../../types/MintableErc20';
import { StakedAave } from '../../../types/StakedAave';

export const logAaveTokenBalanceOf = async (
  account: tEthereumAddress,
  aaveToken: MintableErc20
) => {
  console.log(
    `[aaveToken.balanceOf(${account})]: ${(await aaveToken.balanceOf(account)).toString()}`
  );
};

export const logStakedAaveBalanceOf = async (
  staker: tEthereumAddress,
  stakedAaveV2: StakedAave
) => {
  console.log(
    `[stakedAaveV2.balanceOf(${staker})]: ${(await stakedAaveV2.balanceOf(staker)).toString()}`
  );
};

export const logGetStakeTotalRewardsBalance = async (
  staker: tEthereumAddress,
  stakedAaveV2: StakedAave
) => {
  console.log(
    `[stakedAaveV2.getTotalRewardsBalance(${staker})]: ${(
      await stakedAaveV2.getTotalRewardsBalance(staker)
    ).toString()}`
  );
};

export const logRewardPerStakedAave = async (stakedAaveV2: StakedAave) => {
  console.log(
    `[stakedAaveV2.getRewardPerStakedAave()]: ${(
      await stakedAaveV2.getRewardPerStakedAave()
    ).toString()}`
  );
};
