import { task } from 'hardhat/config';
import { deployClaimHelper } from '../../helpers/contracts-accessors';
import { eEthereumNetwork } from '../../helpers/types';

task(`deploy-ClaimHelper`, `Deploys the ClaimStakingRewardsHelper contract`)
  .addFlag('verify', 'Verify ClaimStakingRewardsHelper contract via Etherscan API.')
  .setAction(async ({ verify }, localBRE) => {
    await localBRE.run('set-dre');

    if (!localBRE.network.config.chainId) {
      throw new Error('INVALID_CHAIN_ID');
    }

    const stakeTokens: {
      [network: string]: { aaveStakeTokenAddress: string; bptStakeTokenAddress: string };
    } = {
      [eEthereumNetwork.kovan]: {
        aaveStakeTokenAddress: '0xf2fbf9A6710AfDa1c4AaB2E922DE9D69E0C97fd2',
        bptStakeTokenAddress: '0x31ce45Ab6E26C72c47C52c27498D460099545ef2',
      },
      [eEthereumNetwork.main]: {
        aaveStakeTokenAddress: '0x4da27a545c0c5b758a6ba100e3a049001de870f5',
        bptStakeTokenAddress: '0xa1116930326D21fB917d5A27F1E9943A9595fb47',
      },
    };

    console.log(`\tDeploying ClaimHelper implementation ...`);
    const ClaimHelper = await deployClaimHelper(
      [
        stakeTokens[localBRE.network.name].aaveStakeTokenAddress,
        stakeTokens[localBRE.network.name].bptStakeTokenAddress,
      ],
      verify
    );

    console.log(`\tFinished ClaimHelper deployment: ${ClaimHelper.address}`);
  });
