import { task } from 'hardhat/config';

import { eContractid, eEthereumNetwork } from '../../helpers/types';
import { registerContractInJsonDb } from '../../helpers/contracts-helpers';
import { getAaveTokenPerNetwork } from '../../helpers/constants';
import { deployAaveStakingHelper } from '../../helpers/contracts-accessors';
import { checkVerification } from '../../helpers/etherscan-verification';

const { AaveStakingHelper, StakedAave } = eContractid;

task(`deploy-${AaveStakingHelper}`, `Deploys the ${AaveStakingHelper} contract`)
  .addParam('stkAave', `The address of the ${StakedAave} contract.`)
  .addFlag('verify', 'Verify StakedAave contract via Etherscan API.')
  .setAction(async ({ stkAave: stkAaveAddress, verify }, localBRE) => {
    await localBRE.run('set-dre');

    // If Etherscan verification is enabled, check needed enviroments to prevent loss of gas in failed deployments.
    if (verify) {
      checkVerification();
    }

    if (!localBRE.network.config.chainId) {
      throw new Error('INVALID_CHAIN_ID');
    }

    const network = localBRE.network.name as eEthereumNetwork;

    console.log(`\n- ${network} network`);
    console.log(`\n- ${AaveStakingHelper} deployment`);
    console.log(`\tDeploying ${AaveStakingHelper} implementation ...`);

    const aaveToken = getAaveTokenPerNetwork(network);

    const stakedAaveHelper = await deployAaveStakingHelper([stkAaveAddress, aaveToken], verify);

    await stakedAaveHelper.deployTransaction.wait();
    await registerContractInJsonDb(AaveStakingHelper, stakedAaveHelper);

    console.log('AaveStakingHelper deployed to', stakedAaveHelper.address);
  });
