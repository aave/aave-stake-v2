import { task } from 'hardhat/config';

import { eContractid, eEthereumNetwork } from '../../helpers/types';
import { registerContractInJsonDb } from '../../helpers/contracts-helpers';
import { getAaveTokenPerNetwork, ZERO_ADDRESS } from '../../helpers/constants';
import { deployStakeUIHelper } from '../../helpers/contracts-accessors';
import { checkVerification } from '../../helpers/etherscan-verification';

const { StakeUIHelper, StakedAave } = eContractid;

task(`deploy-${StakeUIHelper}`, `Deploys the ${StakeUIHelper} contract`)
  .addParam('stkAave', `The address of the ${StakedAave} contract.`)
  .addParam('aaveOracle', `The address of the AaveOracle contract.`)
  .addFlag('verify', 'Verify StakedAave contract via Etherscan API.')
  .setAction(
    async ({ stkAave: stkAaveAddress, aaveOracle: aaveOracleAddress, verify }, localBRE) => {
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
      console.log(`\n- ${StakeUIHelper} deployment`);
      console.log(`\tDeploying ${StakeUIHelper} implementation ...`);

      const aaveToken = getAaveTokenPerNetwork(network);

      const stakedAaveHelper = await deployStakeUIHelper(
        [aaveOracleAddress, ZERO_ADDRESS, aaveToken, stkAaveAddress, ZERO_ADDRESS, ZERO_ADDRESS],
        verify
      );

      await stakedAaveHelper.deployTransaction.wait();
      await registerContractInJsonDb(StakeUIHelper, stakedAaveHelper);

      console.log('StakeUIHelper deployed to', stakedAaveHelper.address);
    }
  );
