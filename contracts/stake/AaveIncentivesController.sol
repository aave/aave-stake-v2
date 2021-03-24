// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.7.5;
pragma experimental ABIEncoderV2;

import {DistributionTypes} from '../lib/DistributionTypes.sol';
import {SafeMath} from '../lib/SafeMath.sol';

import {IERC20} from '../interfaces/IERC20.sol';
import {IAToken} from '../interfaces/IAToken.sol';
import {IAaveIncentivesController} from '../interfaces/IAaveIncentivesController.sol';
import {IStakedToken} from '../interfaces/IStakedToken.sol';
import {VersionedInitializable} from '../utils/VersionedInitializable.sol';
import {AaveDistributionManagerV2} from './AaveDistributionManagerV2.sol';
import {RoleManager} from '../utils/RoleManager.sol';

/**
 * @title AaveIncentivesController
 * @notice Distributor contract for rewards to the Aave protocol
 * @author Aave
 **/
contract AaveIncentivesController is
  IAaveIncentivesController,
  VersionedInitializable,
  AaveDistributionManagerV2,
  RoleManager
{
  using SafeMath for uint256;
  uint256 public constant REVISION = 1;

  IStakedToken public immutable PSM;

  IERC20 public immutable REWARD_TOKEN;
  address internal _rewardsVault;
  uint256 public immutable EXTRA_PSM_REWARD;

  mapping(address => uint256) internal _usersUnclaimedRewards;

  uint256 constant REWARDS_ADMIN_ROLE = 4;

  event RewardsAccrued(address indexed user, uint256 amount);
  event RewardsClaimed(address indexed user, address indexed to, uint256 amount);
  event RewardsVaultUpdate(address indexed vault);

  modifier onlyRewardsAdmin {
    require(msg.sender == getAdmin(REWARDS_ADMIN_ROLE), 'CALLER_NOT_REWARDS_ADMIN');
    _;
  }

  constructor(
    IERC20 rewardToken,
    IStakedToken psm,
    uint256 extraPsmReward,
    address emissionManager
  ) public AaveDistributionManagerV2(emissionManager) {
    REWARD_TOKEN = rewardToken;
    PSM = psm;
    EXTRA_PSM_REWARD = extraPsmReward;
  }

  /**
   * @dev Initialize AaveIncentivesController
   * @param rewardsVault rewards vault to pull funds
   * @param distributionDuration unix timestamp of the duration of the distribution
   * @param rewardsAdmin address of the admin that controls the rewards vault and extending the distribution
   **/
  function initialize(
    address rewardsVault,
    uint256 distributionDuration,
    address rewardsAdmin
  ) external initializer {
    _rewardsVault = rewardsVault;
    _extendDistribution(distributionDuration);

    uint256[] memory adminsRoles = new uint256[](1);
    address[] memory adminsAddresses = new address[](1);

    adminsRoles[0] = REWARDS_ADMIN_ROLE;
    adminsAddresses[0] = rewardsAdmin;

    _initAdmins(adminsRoles, adminsAddresses);

    // to unlock possibility to stake on behalf of the user
    REWARD_TOKEN.approve(address(PSM), type(uint256).max);
  }

  /**
   * @dev Called by the corresponding asset on any update that affects the rewards distribution
   * @param user The address of the user
   * @param totalSupply The total supply of the asset in the lending pool
   * @param userBalance The balance of the user of the asset in the lending pool
   **/
  function handleAction(
    address user,
    uint256 totalSupply,
    uint256 userBalance
  ) external override {
    uint256 accruedRewards = _updateUserAssetInternal(user, msg.sender, userBalance, totalSupply);
    if (accruedRewards != 0) {
      _usersUnclaimedRewards[user] = _usersUnclaimedRewards[user].add(accruedRewards);
      emit RewardsAccrued(user, accruedRewards);
    }
  }

  /**
   * @dev Returns the total of rewards of an user, already accrued + not yet accrued
   * @param user The address of the user
   * @return The rewards
   **/
  function getRewardsBalance(address[] calldata assets, address user)
    external
    view
    override
    returns (uint256)
  {
    uint256 unclaimedRewards = _usersUnclaimedRewards[user];

    DistributionTypes.UserStakeInput[] memory userState =
      new DistributionTypes.UserStakeInput[](assets.length);
    for (uint256 i = 0; i < assets.length; i++) {
      userState[i].underlyingAsset = assets[i];
      (userState[i].stakedByUser, userState[i].totalStaked) = IAToken(assets[i])
        .getScaledUserBalanceAndSupply(user);
    }
    unclaimedRewards = unclaimedRewards.add(_getUnclaimedRewards(user, userState));
    return unclaimedRewards;
  }

  /**
   * @dev Claims reward for an user, on all the assets of the lending pool, accumulating the pending rewards
   * @param amount Amount of rewards to claim
   * @param to Address that will be receiving the rewards
   * @param stake Boolean flag to determined if the claimed rewards should be staked in the Safety Module or not
   * @return Rewards claimed
   **/
  function claimRewards(
    address[] calldata assets,
    uint256 amount,
    address to,
    bool stake
  ) external override returns (uint256) {
    if (amount == 0) {
      return 0;
    }
    address user = msg.sender;
    uint256 unclaimedRewards = _usersUnclaimedRewards[user];

    DistributionTypes.UserStakeInput[] memory userState =
      new DistributionTypes.UserStakeInput[](assets.length);
    for (uint256 i = 0; i < assets.length; i++) {
      userState[i].underlyingAsset = assets[i];
      (userState[i].stakedByUser, userState[i].totalStaked) = IAToken(assets[i])
        .getScaledUserBalanceAndSupply(user);
    }

    uint256 accruedRewards = _claimRewards(user, userState);
    if (accruedRewards != 0) {
      unclaimedRewards = unclaimedRewards.add(accruedRewards);
      emit RewardsAccrued(user, accruedRewards);
    }

    if (unclaimedRewards == 0) {
      return 0;
    }

    uint256 amountToClaim = amount > unclaimedRewards ? unclaimedRewards : amount;
    _usersUnclaimedRewards[user] = unclaimedRewards - amountToClaim; // Safe due to the previous line

    if (stake) {
      amountToClaim = amountToClaim.add(amountToClaim.mul(EXTRA_PSM_REWARD).div(100));
      REWARD_TOKEN.transferFrom(_rewardsVault, address(this), amountToClaim);
      PSM.stake(to, amountToClaim);
    } else {
      REWARD_TOKEN.transferFrom(_rewardsVault, to, amountToClaim);
    }
    emit RewardsClaimed(msg.sender, to, amountToClaim);

    return amountToClaim;
  }

  /**
   * @dev returns the unclaimed rewards of the user
   * @param _user the address of the user
   * @return the unclaimed user rewards
   */
  function getUserUnclaimedRewards(address _user) external view returns (uint256) {
    return _usersUnclaimedRewards[_user];
  }

  /**
   * @dev returns the revision of the implementation contract
   */
  function getRevision() internal pure override returns (uint256) {
    return REVISION;
  }

  /**
   * @dev update the rewards vault address
   * @param rewardsVault The rewards vault address to replace current une
   **/
  function _setRewardsVault(address rewardsVault) internal {
    _rewardsVault = rewardsVault;
  }

  /**
   * @dev returns the current rewards vault contract
   * @return address
   */
  function getRewardsVault() external view returns (address) {
    return _rewardsVault;
  }

  /**
   * @dev update the rewards vault address, only allowed by the Rewards admin
   * @param rewardsVault The address of the rewards vault
   **/
  function setRewardsVault(address rewardsVault) external onlyRewardsAdmin {
    _setRewardsVault(rewardsVault);
  }

  /**
   * @dev Extends the end of the distribution in regards of current timestamp.
   * @param distributionDuration The timestamp duration of the new distribution
   **/
  function extendDistribution(uint256 distributionDuration) external onlyRewardsAdmin {
    _extendDistribution(distributionDuration);
  }
}
