import { Signer } from 'ethers';
import { task } from 'hardhat/config';
import { deployStakedTokenBptRevision2 } from '../../helpers/contracts-accessors';
import { getDefenderRelaySigner } from '../../helpers/defender-utils';
import { DRE } from '../../helpers/misc-utils';

task('deploy-staked-bpt-rev2', 'Deploy implementation')
  .addFlag('defender')
  .setAction(async ({ defender }, localBRE: any) => {
    await localBRE.run('set-dre');

    let deployer: Signer;

    [deployer] = await DRE.ethers.getSigners();

    if (defender) {
      const { signer } = await getDefenderRelaySigner();
      deployer = signer;
    }

    // Deploy StkBPT V2 Revision 2 implementation
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
      true,
      deployer
    );

    return stakedBptv2Revision2Implementation.address;
  });
