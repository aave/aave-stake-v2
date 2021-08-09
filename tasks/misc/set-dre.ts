import { formatEther } from 'ethers/lib/utils';
import { task } from 'hardhat/config';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DRE, setDRE } from '../../helpers/misc-utils';

task(`set-dre`, `Inits the DRE, to have access to all the plugins' objects`).setAction(
  async (_, _DRE) => {
    if (DRE.config) {
      return;
    }
    if (
      (_DRE as HardhatRuntimeEnvironment).network.name.includes('tenderly') ||
      process.env.TENDERLY === 'true'
    ) {
      console.log('- Setting up Tenderly provider');
      const net = _DRE.tenderly.network();

      if (process.env.TENDERLY_FORK_ID && process.env.TENDERLY_HEAD_ID) {
        console.log('- Connecting to a Tenderly Fork');
        await net.setFork(process.env.TENDERLY_FORK_ID);
        await net.setHead(process.env.TENDERLY_HEAD_ID);
      } else {
        console.log('- Creating a new Tenderly Fork');
        await net.initializeFork();
      }
      const provider = new _DRE.ethers.providers.Web3Provider(net);
      _DRE.ethers.provider = provider;
      console.log('- Initialized Tenderly fork:');
      console.log('  - Fork: ', net.getFork());
      console.log('  - Head: ', net.getHead());
      console.log('  - First account:', await (await _DRE.ethers.getSigners())[0].getAddress());
      console.log(
        '  - Balance:',
        formatEther(await (await _DRE.ethers.getSigners())[0].getBalance())
      );
    }

    await setDRE(_DRE);
    return _DRE;
  }
);
