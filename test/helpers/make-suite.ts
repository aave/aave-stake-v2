import { evmRevert, evmSnapshot, DRE } from '../../helpers/misc-utils';
import { Signer } from 'ethers';
import { getEthersSigners } from '../../helpers/contracts-helpers';
import { tEthereumAddress } from '../../helpers/types';

import chai from 'chai';
// @ts-ignore
import bignumberChai from 'chai-bignumber';
import { StakedAave } from '../../types/StakedAave';
import {
  getAaveIncentivesController,
  getATokenMock,
  getMintableErc20,
  getStakedAave,
  getStakedAaveV2,
} from '../../helpers/contracts-accessors';
import { AaveIncentivesController } from '../../types/AaveIncentivesController';
import { MintableErc20 } from '../../types/MintableErc20';
import { ATokenMock } from '../../types/ATokenMock';
import { StakedAaveV2 } from '../../types/StakedAaveV2';

chai.use(bignumberChai());

export let stakedAaveInitializeTimestamp = 0;
export const setStakedAaveInitializeTimestamp = (timestamp: number) => {
  stakedAaveInitializeTimestamp = timestamp;
};

export interface SignerWithAddress {
  signer: Signer;
  address: tEthereumAddress;
}
export interface TestEnv {
  stakedAaveV2: StakedAaveV2;
  rewardsVault: SignerWithAddress;
  deployer: SignerWithAddress;
  users: SignerWithAddress[];
  aaveToken: MintableErc20;
  aaveIncentivesController: AaveIncentivesController;
  stakedAave: StakedAave;
  aDaiMock: ATokenMock;
  aWethMock: ATokenMock;
}

let buidlerevmSnapshotId: string = '0x1';
const setBuidlerevmSnapshotId = (id: string) => {
  if (DRE.network.name === 'hardhat') {
    buidlerevmSnapshotId = id;
  }
};

const testEnv: TestEnv = {
  deployer: {} as SignerWithAddress,
  users: [] as SignerWithAddress[],
  aaveToken: {} as MintableErc20,
  stakedAave: {} as StakedAave,
  stakedAaveV2: {} as StakedAaveV2,
  aaveIncentivesController: {} as AaveIncentivesController,
  aDaiMock: {} as ATokenMock,
  aWethMock: {} as ATokenMock,
} as TestEnv;

export async function initializeMakeSuite() {
  const [_deployer, _rewardsVault, ...restSigners] = await getEthersSigners();
  const deployer: SignerWithAddress = {
    address: await _deployer.getAddress(),
    signer: _deployer,
  };

  const rewardsVault: SignerWithAddress = {
    address: await _rewardsVault.getAddress(),
    signer: _rewardsVault,
  };

  for (const signer of restSigners) {
    testEnv.users.push({
      signer,
      address: await signer.getAddress(),
    });
  }
  testEnv.deployer = deployer;
  testEnv.rewardsVault = rewardsVault;
  testEnv.stakedAave = await getStakedAave();
  testEnv.stakedAaveV2 = await getStakedAaveV2();
  testEnv.aaveIncentivesController = await getAaveIncentivesController();
  testEnv.aaveToken = await getMintableErc20();
  testEnv.aDaiMock = await getATokenMock({ slug: 'aDai' });
  testEnv.aWethMock = await getATokenMock({ slug: 'aWeth' });
}

export function makeSuite(name: string, tests: (testEnv: TestEnv) => void) {
  describe(name, () => {
    before(async () => {
      setBuidlerevmSnapshotId(await evmSnapshot());
    });
    tests(testEnv);
    after(async () => {
      await evmRevert(buidlerevmSnapshotId);
    });
  });
}
