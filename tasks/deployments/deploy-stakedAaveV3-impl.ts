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
  ZERO_ADDRESS,
} from '../../helpers/constants';
import { deployStakedAaveV3, deployStakedTokenV3 } from '../../helpers/contracts-accessors';
import { checkVerification, verifyContract } from '../../helpers/etherscan-verification';

const { StakedAave, StakedAaveImpl } = eContractid;

task(`deploy-StakeAave-implementation`, `Deploys the ${StakedAave} V3 implementation contract`)
  .addFlag('verify', 'Verify StakedAave contract via Etherscan API.')
  .addOptionalParam(
    'vaultAddress',
    'Use AaveIncentivesVault address by param instead of configuration.'
  )
  .addOptionalParam('aaveAddress', 'Use AaveToken address by param instead of configuration.')
  .setAction(async ({ verify, vaultAddress, aaveAddress }, localBRE) => {
    await localBRE.run('set-dre');

    if (verify) {
      checkVerification();
    }

    if (!localBRE.network.config.chainId) {
      throw new Error('INVALID_CHAIN_ID');
    }

    const network = localBRE.network.name as eEthereumNetwork;

    console.log(`\n- ${StakedAave}-V3 deployment`);

    // stakedAAVE V3 and stakedTokenV3 share the same bytecode, they compete when trying to verify.

    // NOTE : CONFIG WORKING FOR KOVAN, NOT BEEN VERIFIED FOR MAINNET
    console.log(`\tDeploying ${StakedAave} implementation ...`);
    const constructorArguments = [
      aaveAddress || getAaveTokenPerNetwork(network),
      aaveAddress || getAaveTokenPerNetwork(network),
      getCooldownSecondsPerNetwork(network),
      getUnstakeWindowPerNetwork(network),
      vaultAddress || getAaveIncentivesVaultPerNetwork(network),
      getAaveAdminPerNetwork(network),
      getDistributionDurationPerNetwork(network),
      'Staked Aave',
      'stkAAVE',
      '18',
      ZERO_ADDRESS,
    ] as [string, string, string, string, string, string, string, string, string, string, string];

    const stakedAaveImpl = await deployStakedTokenV3(
      constructorArguments,
      false // disable verify due not supported by current buidler etherscan plugin
    );
    await stakedAaveImpl.deployTransaction.wait();
    await registerContractInJsonDb(StakedAaveImpl, stakedAaveImpl);

    if (verify) {
      await verifyContract(stakedAaveImpl.address, constructorArguments);
    }

    console.log(`\tFinished ${StakedAave} proxy and implementation deployment`);
  });
