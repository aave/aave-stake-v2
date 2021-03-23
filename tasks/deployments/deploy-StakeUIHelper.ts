import { task } from 'hardhat/config';
import { deployStakeUIHelper } from '../../helpers/contracts-accessors';
import { eEthereumNetwork } from '../../helpers/types';

task(`deploy-StakeUIHelper`, `Deploys the StakeUIHelper contract`)
  .addFlag('verify', 'Verify StakeUIHelper contract via Etherscan API.')
  .setAction(async ({ verify }, localBRE) => {
    await localBRE.run('set-dre');

    if (!localBRE.network.config.chainId) {
      throw new Error('INVALID_CHAIN_ID');
    }

    const stakeTokens: {
      [network: string]: {
        priceOracle: string;
        bptPriceFeed: string;
        aave: string;
        stkAave: string;
        bpt: string;
        stkBpt: string;
      };
    } = {
      [eEthereumNetwork.kovan]: {
        priceOracle: '0x276c4793f2ee3d5bf18c5b879529dd4270ba4814',
        bptPriceFeed: '0x0000000000000000000000000000000000000000',
        aave: '0xb597cd8d3217ea6477232f9217fa70837ff667af',
        stkAave: '0xf2fbf9a6710afda1c4aab2e922de9d69e0c97fd2',
        bpt: '0xb597cd8d3217ea6477232f9217fa70837ff667af',
        stkBpt: '0xCe7021eDabaf82D28adBBea449Bc4dF70261F33E',
      },
      [eEthereumNetwork.main]: {
        priceOracle: '0x0000000000000000000000000000000000000000',
        bptPriceFeed: '0x0000000000000000000000000000000000000000',
        aave: '0x0000000000000000000000000000000000000000',
        stkAave: '0x0000000000000000000000000000000000000000',
        bpt: '0x0000000000000000000000000000000000000000',
        stkBpt: '0x0000000000000000000000000000000000000000',
      },
    };

    console.log(`\tDeploying StakeUIHelper ...`);
    const StakeUIHelper = await deployStakeUIHelper(
      [
        stakeTokens[localBRE.network.name].priceOracle,
        stakeTokens[localBRE.network.name].bptPriceFeed,
        stakeTokens[localBRE.network.name].aave,
        stakeTokens[localBRE.network.name].stkAave,
        stakeTokens[localBRE.network.name].bpt,
        stakeTokens[localBRE.network.name].stkBpt,
      ],
      verify
    );

    console.log(`\tFinished StakeUIHelper deployment: ${StakeUIHelper.address}`);
  });
