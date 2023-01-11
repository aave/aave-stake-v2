import { task } from 'hardhat/config';

import { eContractid, eEthereumNetwork } from '../../helpers/types';
import { registerContractInJsonDb } from '../../helpers/contracts-helpers';
import { getAaveTokenPerNetwork, ZERO_ADDRESS } from '../../helpers/constants';
import { deployStakeUIHelper } from '../../helpers/contracts-accessors';
import { checkVerification } from '../../helpers/etherscan-verification';

const { StakeUIHelper } = eContractid;

task(`deploy-${StakeUIHelper}`, `Deploys the ${StakeUIHelper} contract`)
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
    console.log(`\n- ${StakeUIHelper} deployment`);
    console.log(`\tDeploying ${StakeUIHelper} implementation ...`);

    const aaveToken = getAaveTokenPerNetwork(network);
    const initializableAdminUpgradeabilityProxy = '0x3eF3dcB6237963abbD20B1A67916784fcF9807f4'; // '0x2D77b7172f61baE7D23116015Dd2eCeDA0e5bCf1';
    const aaveOracle = '0xc1c6f3b788FE7F4bB896a2Fad65F5a8c0Ad509C9';

    const stakedAaveHelper = await deployStakeUIHelper(
      [
        aaveOracle,
        ZERO_ADDRESS,
        aaveToken,
        initializableAdminUpgradeabilityProxy,
        ZERO_ADDRESS,
        ZERO_ADDRESS,
      ],
      true
    );

    await stakedAaveHelper.deployTransaction.wait();
    await registerContractInJsonDb(StakeUIHelper, stakedAaveHelper);

    console.log('StakeUIHelper deployed to', stakedAaveHelper.address);
  });
