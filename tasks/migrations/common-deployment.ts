import { task } from 'hardhat/config';
import { HardhatRuntimeEnvironment } from 'hardhat/types';

import { eContractid, eEthereumNetwork } from '../../helpers/types';
import { checkVerification } from '../../helpers/etherscan-verification';
import { getAaveAdminPerNetwork } from '../../helpers/constants';

task('common-deployment', 'Deployment in for Main, Kovan and Ropsten networks')
  .addFlag('verify', 'Verify StakedAave and InitializableAdminUpgradeabilityProxy contract.')
  .addOptionalParam(
    'vaultAddress',
    'Use AaveIncentivesVault address by param instead of configuration.'
  )
  .addOptionalParam('aaveAddress', 'Use AaveToken address by param instead of configuration.')
  .setAction(async ({ verify, vaultAddress, aaveAddress }, localBRE) => {
    const DRE: HardhatRuntimeEnvironment = await localBRE.run('set-dre');
    const network = DRE.network.name as eEthereumNetwork;
    const aaveAdmin = getAaveAdminPerNetwork(network);

    if (!aaveAdmin) {
      throw Error(
        'The --admin parameter must be set. Set an Ethereum address as --admin parameter input.'
      );
    }

    // If Etherscan verification is enabled, check needed enviroments to prevent loss of gas in failed deployments.
    if (verify) {
      checkVerification();
    }

    await DRE.run(`deploy-${eContractid.StakedAave}`, { verify, vaultAddress, aaveAddress });

    await DRE.run(`initialize-${eContractid.StakedAave}`, {
      admin: aaveAdmin,
    });

    console.log(`\n✔️ Finished the deployment of the Aave Token ${network} Enviroment. ✔️`);
  });
