import { task } from 'hardhat/config';
import { eContractid } from '../../helpers/types';
import { waitForTx } from '../../helpers/misc-utils';
import {
  deployAaveEcosystemReserve,
  deployAaveIncentivesController,
  deployInitializableAdminUpgradeabilityProxy,
} from '../../helpers/contracts-accessors';
import { isAddress } from '@ethersproject/address';
import { ZERO_ADDRESS } from '../../helpers/constants';
import { BigNumber } from '@ethersproject/bignumber';

const { AaveEcosystemReserve: id } = eContractid;
task(`deploy-reserve`, `Deploy and initializes the ${id} contract`)
  .addFlag('verify')
  .addParam('controller')
  .addParam('admin', `The address to be added as an Admin role in ${id} Transparent Proxy.`)
  .setAction(async ({ verify, admin, controller }, localBRE) => {
    await localBRE.run('set-dre');
    if (!isAddress(admin)) {
      throw Error('Missing or incorrect admin param');
    }
    if (!isAddress(controller)) {
      throw Error('Missing or incorrect controller param');
    }
    console.log(`\n- ${id} implementation deployment:`);

    const aaveEcosystemReserveImpl = await deployAaveEcosystemReserve(verify);

    console.log(`\tInitializing ${id} proxy`);

    const aaveEcosystemReserveProxy = await deployInitializableAdminUpgradeabilityProxy(verify);

    const encodedParams = aaveEcosystemReserveImpl.interface.encodeFunctionData('initialize', [
      controller,
    ]);

    await waitForTx(
      await aaveEcosystemReserveProxy.functions['initialize(address,address,bytes)'](
        aaveEcosystemReserveImpl.address,
        admin,
        encodedParams
      )
    );

    console.log(`\tFinished ${id} deployment and initialization`);
    console.log(`\t- Proxy: ${aaveEcosystemReserveProxy.address}`);
    console.log(`\t- Impl: ${aaveEcosystemReserveImpl.address}`);

    // Return Aave Ecosystem Reserve Proxy address
    return aaveEcosystemReserveProxy.address;
  });
