import { task } from 'hardhat/config';
import { DRE } from '../../helpers/misc-utils';
import {
  deployStakedTokenBptRevision2,
  deployStakedTokenV2Revision3,
} from '../../helpers/contracts-accessors';

task('proposal-stk-extensions', 'Deploy implementations and create proposal')
  .addFlag('defender')
  .setAction(async ({ defender }, localBRE: any) => {
    await localBRE.run('set-dre');
    const {
      AAVE_TOKEN = '0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9',
      IPFS_HASH = 'QmT9qk3CRYbFDWpDFYeAv8T8H1gnongwKhh5J68NLkLir6', // WIP
      AAVE_GOVERNANCE_V2 = '0xEC568fffba86c094cf06b22134B23074DFE2252c', // mainnet
      AAVE_LONG_EXECUTOR = '0x61910ecd7e8e942136ce7fe7943f956cea1cc2f7', // mainnet
    } = process.env;

    if (!AAVE_TOKEN || !IPFS_HASH || !AAVE_GOVERNANCE_V2 || !AAVE_LONG_EXECUTOR) {
      throw new Error('You have not set correctly the .env file, make sure to read the README.md');
    }

    const AAVE_STAKE = '0x4da27a545c0c5B758a6BA100e3a049001de870f5';
    const STK_BPT_STAKE = '0xa1116930326D21fB917d5A27F1E9943A9595fb47';

    // Deploy StkAave V2 Revision 3 implementation
    const stakedAaveV2Revision3Implementation = await deployStakedTokenV2Revision3(
      [
        '0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9',
        '0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9',
        '864000',
        '172800',
        '0x25F2226B597E8F9514B3F68F00f494cF4f286491',
        '0xEE56e2B3D491590B5b31738cC34d5232F378a8D5',
        '3153600000',
        'Staked AAVE',
        'stkAAVE',
        '18',
        '0x0000000000000000000000000000000000000000',
      ],
      true
    );

    // Deploy StkBPT V2 Revision 2 implementation f
    const stakedBptv2Revision2Implementation = await deployStakedTokenBptRevision2(
      [
        '0x41a08648c3766f9f9d85598ff102a08f4ef84f84',
        '0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9',
        '864000',
        '172800',
        '0x25F2226B597E8F9514B3F68F00f494cF4f286491',
        '0xEE56e2B3D491590B5b31738cC34d5232F378a8D5',
        '3153600000', // 100 years from now
        'Aave stakedToken',
        'stkToken',
        '18',
        '0xec568fffba86c094cf06b22134b23074dfe2252c',
      ],
      true
    );

    await DRE.run('propose-extension', {
      stkAaveProxy: AAVE_STAKE,
      stkAaveImpl: stakedAaveV2Revision3Implementation.address,
      stkBptProxy: STK_BPT_STAKE,
      stkBptImpl: stakedBptv2Revision2Implementation.address,
      aaveGovernance: AAVE_GOVERNANCE_V2,
      longExecutor: AAVE_LONG_EXECUTOR,
      ipfsHash: IPFS_HASH,
      defender: defender,
    });

    return {
      stkAaveImpl: stakedAaveV2Revision3Implementation.address,
      stkBptImpl: stakedBptv2Revision2Implementation.address,
    };
  });
