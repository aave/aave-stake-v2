import { makeSuite, TestEnv } from '../helpers/make-suite';
import { MAX_UINT_AMOUNT, ZERO_ADDRESS } from '../../helpers/constants';

const { expect } = require('chai');

makeSuite('AaveIncentivesController initialize', (testEnv: TestEnv) => {
  // TODO: useless or not?
  it('Tries to call initialize second time, should be reverted', async () => {
    const { aaveIncentivesController } = testEnv;
    await expect(aaveIncentivesController.initialize(ZERO_ADDRESS)).to.be.reverted;
  });
});
