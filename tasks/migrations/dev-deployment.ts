import { task } from 'hardhat/config';
import { eContractid } from '../../helpers/types';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { StakedAave } from '../../types/StakedAave';

task('dev-deployment', 'Deployment in hardhat').setAction(async (_, localBRE) => {
  const DRE: HardhatRuntimeEnvironment = await localBRE.run('set-dre');

  const aaveStake = (await DRE.run(`deploy-${eContractid.StakedAave}`)) as StakedAave;
});
