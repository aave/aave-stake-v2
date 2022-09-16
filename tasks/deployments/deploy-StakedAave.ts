import { task } from 'hardhat/config';

import { eContractid, eEthereumNetwork, tEthereumAddress } from '../../helpers/types';
import { registerContractInJsonDb } from '../../helpers/contracts-helpers';
import {
  getAaveTokenPerNetwork,
  getCooldownSecondsPerNetwork,
  getUnstakeWindowPerNetwork,
  getAaveAdminPerNetwork,
  getDistributionDurationPerNetwork,
  getAaveIncentivesVaultPerNetwork,
} from '../../helpers/constants';
import {
  deployStakedAave,
  deployInitializableAdminUpgradeabilityProxy,
} from '../../helpers/contracts-accessors';
import { checkVerification } from '../../helpers/etherscan-verification';

const { StakedAave, StakedAaveImpl } = eContractid;

task(`deploy-${StakedAave}`, `Deploys the ${StakedAave} contract`)
  .addFlag('verify', 'Verify StakedAave contract via Etherscan API.')
  .addOptionalParam(
    'vaultAddress',
    'Use AaveIncentivesVault address by param instead of configuration.'
  )
  .addOptionalParam('aaveAddress', 'Use AaveToken address by param instead of configuration.')
  .setAction(async ({ verify, vaultAddress, aaveAddress }, localBRE) => {
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

    console.log(`\n- ${StakedAave} deployment`);

    console.log(`\tDeploying ${StakedAave} implementation ...`);

    console.log('PARAM', getAaveTokenPerNetwork(network));
    console.log('PARAM', getAaveTokenPerNetwork(network));
    console.log('PARAM', getCooldownSecondsPerNetwork(network));
    console.log('PARAM', getUnstakeWindowPerNetwork(network));
    console.log('PARAM', getAaveIncentivesVaultPerNetwork(network));
    console.log('PARAM', getAaveAdminPerNetwork(network));
    console.log('PARAM', getDistributionDurationPerNetwork(network));

    const stakedAaveImpl = await deployStakedAave(
      [
        aaveAddress || getAaveTokenPerNetwork(network),
        aaveAddress || getAaveTokenPerNetwork(network),
        getCooldownSecondsPerNetwork(network),
        getUnstakeWindowPerNetwork(network),
        vaultAddress || getAaveIncentivesVaultPerNetwork(network),
        getAaveAdminPerNetwork(network),
        getDistributionDurationPerNetwork(network),
      ],
      false // disable verify due not supported by current buidler etherscan plugin
    );

    await stakedAaveImpl.deployTransaction.wait();
    await registerContractInJsonDb(StakedAaveImpl, stakedAaveImpl);

    console.log('staked aave deployed to', stakedAaveImpl.address);

    console.log(`\tDeploying ${StakedAave} Transparent Proxy ...`);
    const stakedAaveProxy = await deployInitializableAdminUpgradeabilityProxy(verify);
    await registerContractInJsonDb(StakedAave, stakedAaveProxy);

    console.log(`\tFinished ${StakedAave} proxy and implementation deployment`);

    console.log('StakeAaveProxy deplyed to', stakedAaveProxy.address);
  });
