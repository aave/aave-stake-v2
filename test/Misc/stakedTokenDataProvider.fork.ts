import rawBRE from 'hardhat';
import { makeSuite, TestEnv } from '../helpers/make-suite';

import { ZERO_ADDRESS } from '../../helpers/constants';
import {
  getStakedTokenDataProvider,
  deployStakedTokenDataProvider,
} from '../../helpers/contracts-accessors';

rawBRE.run('set-dre').then(async () => {
  makeSuite('Deploy stake ui provider', async (testEnv: TestEnv) => {
    before(async () => {
      const [
        aaveToken,
        stkAaveAddress,
        bptToken,
        stkBptToken,
        ethUsdPriceFeed,
        aavePriceFeed,
        bptPriceFeed,
        bptWstETH,
        bptWstETHPriceFeed,
      ] = [
        '0x9c0435779F5E52CEC404D957C9bAa6f7d674C8bA', // aave tokeb
        '0x4da27a545c0c5b758a6ba100e3a049001de870f5', //proxy
        '0x41a08648c3766f9f9d85598ff102a08f4ef84f84', // bpt
        '0xa1116930326d21fb917d5a27f1e9943a9595fb47', // stkbpt
        '0x5f4ec3df9cbd43714fe2740f5e3616155c5b8419', // https://data.chain.link/ethereum/mainnet/crypto-usd/eth-usd
        '0xa50ba011c48153de246e5192c8f9258a2ba79ca9', // aave oracle
        ZERO_ADDRESS, // TODO use bptPriceFeed,
        '0x41a08648c3766f9f9d85598ff102a08f4ef84f84', // TODO use actual pool mocking current bpt
        ZERO_ADDRESS, // TODO use actual price feed
      ];
      const stakedTokenDataProvider = await deployStakedTokenDataProvider([
        aaveToken,
        stkAaveAddress,
        bptToken,
        stkBptToken,
        ethUsdPriceFeed,
        aavePriceFeed,
        bptPriceFeed,
        bptWstETH,
        bptWstETHPriceFeed,
      ]);
      await stakedTokenDataProvider.deployTransaction.wait();
      console.log('staked token provider deployed', stakedTokenDataProvider.address);
    });

    it('Checks stkAaveData methods fetch data correctly', async () => {
      const stakedDataProvider = await getStakedTokenDataProvider();
      try {
        const aave = await stakedDataProvider.AAVE();
        console.log('aave -->', aave);

        const foo = await stakedDataProvider.foo();
        console.log('foo', foo);

        const getAave = await stakedDataProvider.getStkAaveData();

        console.log('getAaave', getAave);
      } catch (err) {
        console.error('err', err);
      }
    });
  });
});
