import { task } from 'hardhat/config';

import { eContractid, eEthereumNetwork } from '../../helpers/types';
import { registerContractInJsonDb } from '../../helpers/contracts-helpers';
import { getAaveTokenPerNetwork } from '../../helpers/constants';
import { deployAaveStakingHelper } from '../../helpers/contracts-accessors';
import { checkVerification } from '../../helpers/etherscan-verification';

const { AaveStakingHelper } = eContractid;

task(`deploy-${AaveStakingHelper}`, `Deploys the ${AaveStakingHelper} contract`)
  .addFlag('verify', 'Verify StakedAave contract via Etherscan API.')
  .setAction(async ({ verify }, localBRE) => {
    await localBRE.run('set-dre');

    // If Etherscan verification is enabled, check needed enviroments to prevent loss of gas in failed deployments.
    if (verify) {
      checkVerification();
    }

    if (!localBRE.network.config.chainId) {
      throw new Error('INVALID_CHAIN_ID');
    }

    const network = localBRE.network.name as eEthereumNetwork;

    console.log('FIREEE', network);

    console.log(`\n- ${network} network`);
    console.log(`\n- ${AaveStakingHelper} deployment`);
    console.log(`\tDeploying ${AaveStakingHelper} implementation ...`);

    const aaveToken = getAaveTokenPerNetwork(network);

    const stakedAaveHelper = await deployAaveStakingHelper(
      ['0x2D77b7172f61baE7D23116015Dd2eCeDA0e5bCf1', aaveToken],
      true
    );

    await stakedAaveHelper.deployTransaction.wait();
    await registerContractInJsonDb(AaveStakingHelper, stakedAaveHelper);

    console.log('stakedAaveHelper deployed to', stakedAaveHelper.address);
  });
