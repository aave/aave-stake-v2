import rawBRE from 'hardhat';
import { Signer, ethers } from 'ethers';
import { getEthersSigners } from '../helpers/contracts-helpers';
import { initializeMakeSuite } from './helpers/make-suite';
import { deployMintableErc20, deployATokenMock } from '../helpers/contracts-accessors';
import { waitForTx } from '../helpers/misc-utils';
import { MintableErc20 } from '../types/MintableErc20';
import { testDeployAaveStakeV2, testDeployAaveStakeV1 } from './helpers/deploy';

const topUpWalletsWithAave = async (
  wallets: Signer[],
  aaveToken: MintableErc20,
  amount: string
) => {
  for (const wallet of wallets) {
    await waitForTx(await aaveToken.connect(wallet).mint(amount));
  }
};

const buildTestEnv = async (deployer: Signer, vaultOfRewards: Signer, restWallets: Signer[]) => {
  console.time('setup');

  const aaveToken = await deployMintableErc20(['Aave', 'aave', 18]);

  await waitForTx(await aaveToken.connect(vaultOfRewards).mint(ethers.utils.parseEther('1000000')));
  await topUpWalletsWithAave(
    [
      restWallets[0],
      restWallets[1],
      restWallets[2],
      restWallets[3],
      restWallets[4],
      restWallets[5],
    ],
    aaveToken,
    ethers.utils.parseEther('100').toString()
  );

  await testDeployAaveStakeV2(aaveToken, deployer, vaultOfRewards, restWallets);

  const { aaveIncentivesControllerProxy } = await testDeployAaveStakeV1(
    aaveToken,
    deployer,
    vaultOfRewards,
    restWallets
  );

  await deployATokenMock(aaveIncentivesControllerProxy.address, 'aDai');
  await deployATokenMock(aaveIncentivesControllerProxy.address, 'aWeth');

  console.timeEnd('setup');
};

before(async () => {
  await rawBRE.run('set-dre');
  const [deployer, rewardsVault, ...restWallets] = await getEthersSigners();
  console.log('-> Deploying test environment...');
  await buildTestEnv(deployer, rewardsVault, restWallets);
  await initializeMakeSuite();
  console.log('\n***************');
  console.log('Setup and snapshot finished');
  console.log('***************\n');
});
