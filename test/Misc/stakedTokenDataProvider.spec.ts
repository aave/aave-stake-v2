import rawBRE from 'hardhat';
import { makeSuite, TestEnv } from '../helpers/make-suite';
import BigNumber from 'bignumber.js';
import { ZERO_ADDRESS } from '../../helpers/constants';
import {
  getStakedTokenDataProvider,
  deployStakedTokenDataProvider,
} from '../../helpers/contracts-accessors';
import { network, ethers } from 'hardhat';
const { expect } = require('chai');

rawBRE.run('set-dre').then(async () => {
  let stakedTokenDataProvider;
  const STK_WHALE = '0xaFDAbFb6227507fF6522b8a242168F6b5F353a6E';
  const BPT_WHALE = '0x741AA7CFB2c7bF2A1E7D4dA2e3Df6a56cA4131F3';
  const STK_BPT = '0xa1116930326d21fb917d5a27f1e9943a9595fb47';
  const AAVE_TOKEN = '0x9c0435779F5E52CEC404D957C9bAa6f7d674C8bA';
  const AAVE_BPT_POOL_TOKEN = '0x41a08648c3766f9f9d85598ff102a08f4ef84f84';

  const STK_WSTEH = '0xa1116930326d21fb917d5a27f1e9943a9595fb47'; // todo change for actual token
  const STK_WSTEH_WHALE = '0x741AA7CFB2c7bF2A1E7D4dA2e3Df6a56cA4131F3';

  const STAKED_AAVE = '0x4da27a545c0c5b758a6ba100e3a049001de870f5';

  const ETH_USD_PRICE_FEED = '0x5f4ec3df9cbd43714fe2740f5e3616155c5b8419';
  const AAVE_ORACLE = '0x6Df09E975c830ECae5bd4eD9d90f3A95a4f88012';
  const BPT_PRICE_FEED = '0x0De156f178a20114eeec0eBF71d7772064476b0D';

  makeSuite('Deploy stake ui provider', async (testEnv: TestEnv) => {
    beforeEach(async () => {
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
        AAVE_TOKEN,
        STAKED_AAVE,
        AAVE_BPT_POOL_TOKEN,
        STK_BPT,
        ETH_USD_PRICE_FEED, // https://data.chain.link/ethereum/mainnet/crypto-usd/eth-usd
        AAVE_ORACLE,
        BPT_PRICE_FEED,
        AAVE_BPT_POOL_TOKEN, // TODO use actual pool mocking current WSTETH
        BPT_PRICE_FEED, // TODO use actual price feed WSTETH
      ];
      stakedTokenDataProvider = await deployStakedTokenDataProvider([
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

    it('Should have property inPostSlashingPeriod and be false', async () => {
      const stakedDataProvider = await getStakedTokenDataProvider();

      const whaleData = await stakedDataProvider.getStakedUserData(STK_WHALE, STAKED_AAVE);

      expect(whaleData[0]).to.have.property('inPostSlashingPeriod');
      expect(whaleData[0].inPostSlashingPeriod).to.equal(false);
    });

    it('Should get STKAAVE data and have property inPostSlashingPeriod and be false', async () => {
      const stakedDataProvider = await getStakedTokenDataProvider();

      const whaleData = await stakedDataProvider.getStakedUserData(STK_WHALE, STAKED_AAVE);

      expect(whaleData).to.be.an('array');
      expect(whaleData).to.have.lengthOf(2);
      expect(whaleData[0]).to.have.property('inPostSlashingPeriod');
      // expect(whaleData[0].inPostSlashingPeriod).to.equal(false);
    });
    it('Should get BPT data', async () => {
      const stakedDataProvider = await getStakedTokenDataProvider();

      const whaleData = await stakedDataProvider.getStakedUserData(BPT_WHALE, STK_BPT);

      expect(whaleData).to.be.an('array');
      expect(whaleData).to.have.lengthOf(2);
      expect(whaleData[0]).to.have.property('inPostSlashingPeriod');
      expect(whaleData[0].inPostSlashingPeriod).to.equal(false);
    });

    it('Should get WSTEH data ', async () => {
      const stakedDataProvider = await getStakedTokenDataProvider();

      const whaleData = await stakedDataProvider.getStakedUserData(STK_WSTEH_WHALE, STK_WSTEH);

      expect(whaleData).to.be.an('array');
      expect(whaleData).to.have.lengthOf(2);
      expect(whaleData[0]).to.have.property('inPostSlashingPeriod');
      expect(whaleData[0].inPostSlashingPeriod).to.equal(false);
    });
  });
});
