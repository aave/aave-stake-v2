import { BigNumber } from 'ethers';
import { AaveDistributionManager } from '../../../types/AaveDistributionManager';
import { StakedAave } from '../../../types/StakedAave';
import { AaveIncentivesController } from '../../../types/AaveIncentivesController';
import { StakedAaveV2 } from '../../../types/StakedAaveV2';
import { StakedAaveV3 } from '../../../types/StakedAaveV3';

export type UserStakeInput = {
  underlyingAsset: string;
  stakedByUser: string;
  totalStaked: string;
};

export type UserPositionUpdate = UserStakeInput & {
  user: string;
};
export async function getUserIndex(
  distributionManager:
    | AaveDistributionManager
    | AaveIncentivesController
    | StakedAave
    | StakedAaveV2
    | StakedAaveV3,
  user: string,
  asset: string
): Promise<BigNumber> {
  return await distributionManager.getUserAssetData(user, asset);
}
