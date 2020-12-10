import { BigNumber, BigNumberish } from 'ethers';
import { comparatorEngine, CompareRules } from '../../helpers/comparator-engine';
import { getNormalizedDistribution } from '../../helpers/ray-math';
import { AaveDistributionManager } from '../../../types/AaveDistributionManager';
import { StakedAave } from '../../../types/StakedAave';
import { AaveIncentivesController } from '../../../types/AaveIncentivesController';

export type AssetUpdateData = {
  emissionPerSecond: BigNumberish;
  totalStaked: BigNumberish;
  underlyingAsset: string;
};
export type AssetData = {
  emissionPerSecond: BigNumber;
  index: BigNumber;
  lastUpdateTimestamp: BigNumber;
};

export async function getAssetsData<T extends { underlyingAsset: string }>(
  peiContract: AaveDistributionManager | AaveIncentivesController | StakedAave,
  assets: T[]
) {
  return await Promise.all(
    assets.map(async ({ underlyingAsset }) => ({
      ...(await peiContract.assets(underlyingAsset)),
      underlyingAsset,
    }))
  );
}

export function assetDataComparator<
  Input extends { underlyingAsset: string; totalStaked: BigNumberish },
  State extends AssetData
>(
  assetConfigUpdateInput: Input,
  assetConfigBefore: State,
  assetConfigAfter: State,
  actionBlockTimestamp: number,
  emissionEndTimestamp: number,
  compareRules: CompareRules<Input, State>
) {
  return comparatorEngine(
    ['emissionPerSecond', 'index', 'lastUpdateTimestamp'],
    assetConfigUpdateInput,
    assetConfigBefore,
    assetConfigAfter,
    actionBlockTimestamp,
    {
      ...compareRules,
      fieldsWithCustomLogic: [
        // should happen on any update
        {
          fieldName: 'lastUpdateTimestamp',
          logic: (stateUpdate, stateBefore, stateAfter, txTimestamp) => txTimestamp.toString(),
        },
        {
          fieldName: 'index',
          logic: async (stateUpdate, stateBefore, stateAfter, txTimestamp) => {
            return getNormalizedDistribution(
              stateUpdate.totalStaked.toString(),
              stateBefore.index,
              stateBefore.emissionPerSecond,
              stateBefore.lastUpdateTimestamp,
              txTimestamp,
              emissionEndTimestamp
            ).toString(10);
          },
        },
        ...(compareRules.fieldsWithCustomLogic || []),
      ],
    }
  );
}
