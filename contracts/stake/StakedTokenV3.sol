// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.7.5;
pragma experimental ABIEncoderV2;

import {ERC20} from '@aave/aave-token/contracts/open-zeppelin/ERC20.sol';

import {IERC20} from '../interfaces/IERC20.sol';
import {IERC20WithPermit} from '../interfaces/IERC20WithPermit.sol';
import {IStakedTokenV3} from '../interfaces/IStakedTokenV3.sol';
import {IStakedToken} from '../interfaces/IStakedToken.sol';
import {ITransferHook} from '../interfaces/ITransferHook.sol';

import {DistributionTypes} from '../lib/DistributionTypes.sol';
import {SafeMath} from '../lib/SafeMath.sol';
import {SafeERC20} from '../lib/SafeERC20.sol';
import {PercentageMath} from '../lib/PercentageMath.sol';
import {StakedTokenV2} from './StakedTokenV2.sol';

import {VersionedInitializable} from '../utils/VersionedInitializable.sol';
import {AaveDistributionManager} from './AaveDistributionManager.sol';
import {GovernancePowerWithSnapshot} from '../lib/GovernancePowerWithSnapshot.sol';
import {RoleManager} from '../utils/RoleManager.sol';

/**
 * @title StakedToken
 * @notice Contract to stake Aave token, tokenize the position and get rewards, inheriting from a distribution manager contract
 * @author Aave
 **/
contract StakedTokenV3 is StakedTokenV2, IStakedTokenV3, RoleManager {
  using SafeMath for uint256;
  using SafeERC20 for IERC20;
  using PercentageMath for uint256;

  uint256 public constant SLASH_ADMIN_ROLE = 0;
  uint256 public constant COOLDOWN_ADMIN_ROLE = 1;
  uint256 public constant CLAIM_HELPER_ROLE = 2;

  function REVISION() public pure virtual override returns (uint256) {
    return 3;
  }

  //maximum percentage of the underlying that can be slashed in a single realization event
  uint256 internal _maxSlashablePercentage;
  bool _cooldownPaused;

  modifier onlySlashingAdmin {
    require(msg.sender == getAdmin(SLASH_ADMIN_ROLE), 'CALLER_NOT_SLASHING_ADMIN');
    _;
  }

  modifier onlyCooldownAdmin {
    require(msg.sender == getAdmin(COOLDOWN_ADMIN_ROLE), 'CALLER_NOT_COOLDOWN_ADMIN');
    _;
  }

  modifier onlyClaimHelper {
    require(msg.sender == getAdmin(CLAIM_HELPER_ROLE), 'CALLER_NOT_CLAIM_HELPER');
    _;
  }

  event Staked(address indexed from, address indexed to, uint256 amount, uint256 sharesMinted);
  event Redeem(
    address indexed from,
    address indexed to,
    uint256 amount,
    uint256 underlyingTransferred
  );
  event CooldownPauseChanged(bool pause);
  event MaxSlashablePercentageChanged(uint256 newPercentage);
  event Slashed(address indexed destination, uint256 amount);
  event CooldownPauseAdminChanged(address indexed newAdmin);
  event SlashingAdminChanged(address indexed newAdmin);

  constructor(
    IERC20 stakedToken,
    IERC20 rewardToken,
    uint256 cooldownSeconds,
    uint256 unstakeWindow,
    address rewardsVault,
    address emissionManager,
    uint128 distributionDuration,
    string memory name,
    string memory symbol,
    uint8 decimals,
    address governance
  )
    public
    StakedTokenV2(
      stakedToken,
      rewardToken,
      cooldownSeconds,
      unstakeWindow,
      rewardsVault,
      emissionManager,
      distributionDuration,
      name,
      symbol,
      decimals,
      governance
    )
  {}

  /**
   * @dev Inherited from StakedTokenV2, deprecated
   **/
  function initialize() external override {
    revert('DEPRECATED');
  }

  /**
   * @dev Called by the proxy contract
   **/
  function initialize(
    address slashingAdmin,
    address cooldownPauseAdmin,
    address claimHelper,
    uint256 maxSlashablePercentage,
    string calldata name,
    string calldata symbol,
    uint8 decimals
  ) external initializer {
    uint256 chainId;

    //solium-disable-next-line
    assembly {
      chainId := chainid()
    }

    DOMAIN_SEPARATOR = keccak256(
      abi.encode(
        EIP712_DOMAIN,
        keccak256(bytes(super.name())),
        keccak256(EIP712_REVISION),
        chainId,
        address(this)
      )
    );

    if (REVISION() == 1) {
      _name = name;
      _symbol = symbol;
      _setupDecimals(decimals);
    }

    address[] memory adminsAddresses = new address[](3);
    uint256[] memory adminsRoles = new uint256[](3);

    adminsAddresses[0] = slashingAdmin;
    adminsAddresses[1] = cooldownPauseAdmin;
    adminsAddresses[2] = claimHelper;

    adminsRoles[0] = SLASH_ADMIN_ROLE;
    adminsRoles[1] = COOLDOWN_ADMIN_ROLE;
    adminsRoles[2] = CLAIM_HELPER_ROLE;

    _initAdmins(adminsRoles, adminsAddresses);

    _maxSlashablePercentage = maxSlashablePercentage;
  }

  /**
   * @dev Allows a from to stake STAKED_TOKEN
   * @param to Address of the from that will receive stake token shares
   * @param amount The amount to be staked
   **/
  function stake(address to, uint256 amount) external override(IStakedToken, StakedTokenV2) {
    _stake(msg.sender, to, amount, true);
  }

  /**
   * @dev Allows a from to stake STAKED_TOKEN with gasless approvals (permit)
   * @param to Address of the from that will receive stake token shares
   * @param amount The amount to be staked
   * @param deadline The permit execution deadline
   * @param v The v component of the signed message
   * @param r The r component of the signed message
   * @param s The s component of the signed message
   **/
  function stakeWithPermit(
    address from,
    address to,
    uint256 amount,
    uint256 deadline,
    uint8 v,
    bytes32 r,
    bytes32 s
  ) external override {
    IERC20WithPermit(address(STAKED_TOKEN)).permit(from, address(this), amount, deadline, v, r, s);
    _stake(from, to, amount, false);
  }

  /**
   * @dev Redeems staked tokens, and stop earning rewards
   * @param to Address to redeem to
   * @param amount Amount to redeem
   **/
  function redeem(address to, uint256 amount) external override(IStakedToken, StakedTokenV2) {
    _redeem(msg.sender, to, amount);
  }

  /**
   * @dev Redeems staked tokens for a user. Only the claim helper contract is allowed to call this function
   * @param from Address to redeem from
   * @param to Address to redeem to
   * @param amount Amount to redeem
   **/
  function redeemOnBehalf(
    address from,
    address to,
    uint256 amount
  ) external override onlyClaimHelper {
    _redeem(from, to, amount);
  }

  /**
   * @dev Claims an `amount` of `REWARD_TOKEN` to the address `to`
   * @param to Address to send the claimed rewards
   * @param amount Amount to stake
   **/
  function claimRewards(address to, uint256 amount) external override(StakedTokenV2, IStakedToken) {
    _claimRewards(msg.sender, to, amount);
  }

  /**
   * @dev Claims an `amount` of `REWARD_TOKEN` to the address `to` on behalf of the user. Only the claim helper contract is allowed to call this function
   * @param from The address of the user from to claim
   * @param to Address to send the claimed rewards
   * @param amount Amount to claim
   **/
  function claimRewardsOnBehalf(
    address from,
    address to,
    uint256 amount
  ) external override onlyClaimHelper {
    _claimRewards(from, to, amount);
  }

  /**
   * @dev Claims an `amount` of `REWARD_TOKEN` amd restakes
   * @param to Address to stake to
   * @param amount Amount to claim
   **/
  function claimRewardsAndStake(address to, uint256 amount)
    external
    override
  {
    require(REWARD_TOKEN == STAKED_TOKEN, 'REWARD_TOKEN_IS_NOT_STAKED_TOKEN');

    uint256 rewardsClaimed = _claimRewards(msg.sender, address(this), amount);
    _stake(address(this), to, rewardsClaimed, false);
  }

  /**
   * @dev Claims an `amount` of `REWARD_TOKEN` and restakes. Only the claim helper contract is allowed to call this function
   * @param from The address of the from from which to claim
   * @param to Address to stake to
   * @param amount Amount to claim
   **/
  function claimRewardsAndStakeOnBehalf(
    address from,
    address to,
    uint256 amount
  ) external override onlyClaimHelper {
    require(REWARD_TOKEN == STAKED_TOKEN, 'REWARD_TOKEN_IS_NOT_STAKED_TOKEN');

    uint256 rewardsClaimed = _claimRewards(from, address(this), amount);
    _stake(address(this), to, rewardsClaimed, false);
  }

  /**
   * @dev Claims an `amount` of `REWARD_TOKEN` amd redeem
   * @param claimAmount Amount to claim
   * @param redeemAmount Amount to redeem
   * @param to Address to claim and unstake to
   **/
  function claimRewardsAndRedeem(
    address to,
    uint256 claimAmount,
    uint256 redeemAmount
  ) external override {
    _claimRewards(msg.sender, to, claimAmount);
    _redeem(msg.sender, to, redeemAmount);
  }

  /**
   * @dev Claims an `amount` of `REWARD_TOKEN` and redeem. Only the claim helper contract is allowed to call this function
   * @param from The address of the from
   * @param to Address to claim and unstake to
   * @param claimAmount Amount to claim
   * @param redeemAmount Amount to redeem
   **/
  function claimRewardsAndRedeemOnBehalf(
    address from,
    address to,
    uint256 claimAmount,
    uint256 redeemAmount
  ) external override onlyClaimHelper {
    _claimRewards(from, to, claimAmount);
    _redeem(from, to, redeemAmount);
  }

  /**
   * @dev Calculates the exchange rate between the amount of STAKED_TOKEN and the the StakeToken total supply.
   * Slashing will reduce the exchange rate. Supplying STAKED_TOKEN to the stake contract
   * can replenish the slashed STAKED_TOKEN and bring the exchange rate back to 1
   **/
  function exchangeRate() public view override returns (uint256) {
    uint256 currentSupply = totalSupply();

    if (currentSupply == 0) {
      return 1e18; //initial exchange rate is 1:1
    }

    return STAKED_TOKEN.balanceOf(address(this)).mul(1e18).div(currentSupply);
  }

  /**
   * @dev Executes a slashing of the underlying of a certain amount, transferring the seized funds
   * to destination. Decreasing the amount of underlying will automatically adjust the exchange rate
   * @param destination the address where seized funds will be transferred
   * @param amount the amount
   **/
  function slash(address destination, uint256 amount) external override onlySlashingAdmin {
    uint256 balance = STAKED_TOKEN.balanceOf(address(this));

    uint256 maxSlashable = balance.percentMul(_maxSlashablePercentage);

    require(amount <= maxSlashable, 'INVALID_SLASHING_AMOUNT');

    STAKED_TOKEN.safeTransfer(destination, amount);

    emit Slashed(destination, amount);
  }

  /**
   * @dev returns true if the unstake cooldown is paused
   */
  function getCooldownPaused() external view override returns (bool) {
    return _cooldownPaused;
  }

  /**
   * @dev sets the state of the cooldown pause
   * @param paused true if the cooldown needs to be paused, false otherwise
   */
  function setCooldownPause(bool paused) external override onlyCooldownAdmin {
    _cooldownPaused = paused;
    emit CooldownPauseChanged(paused);
  }

  /**
   * @dev sets the admin of the slashing pausing function
   * @param percentage the new maximum slashable percentage
   */
  function setMaxSlashablePercentage(uint256 percentage) external override onlySlashingAdmin {
    require(percentage <= PercentageMath.PERCENTAGE_FACTOR, 'INVALID_SLASHING_PERCENTAGE');

    _maxSlashablePercentage = percentage;
    emit MaxSlashablePercentageChanged(percentage);
  }

  /**
   * @dev returns the current maximum slashable percentage of the stake
   */
  function getMaxSlashablePercentage() external view override returns (uint256) {
    return _maxSlashablePercentage;
  }

  /**
   * @dev returns the revision of the implementation contract
   * @return The revision
   */
  function getRevision() internal pure virtual override returns (uint256) {
    return REVISION();
  }

  function _claimRewards(
    address from,
    address to,
    uint256 amount
  ) internal returns (uint256) {
    uint256 newTotalRewards = _updateCurrentUnclaimedRewards(from, balanceOf(from), false);
    uint256 amountToClaim = (amount == type(uint256).max) ? newTotalRewards : amount;

    stakerRewardsToClaim[from] = newTotalRewards.sub(amountToClaim, 'INVALID_AMOUNT');
    REWARD_TOKEN.safeTransferFrom(REWARDS_VAULT, to, amountToClaim);
    emit RewardsClaimed(from, to, amountToClaim);
    return (amountToClaim);
  }

  function _stake(
    address from,
    address to,
    uint256 amount,
    bool pullFunds
  ) internal {
    require(amount != 0, 'INVALID_ZERO_AMOUNT');

    uint256 balanceOfUser = balanceOf(to);

    uint256 accruedRewards =
      _updateUserAssetInternal(to, address(this), balanceOfUser, totalSupply());

    if (accruedRewards != 0) {
      emit RewardsAccrued(to, accruedRewards);
      stakerRewardsToClaim[to] = stakerRewardsToClaim[to].add(accruedRewards);
    }

    stakersCooldowns[to] = getNextCooldownTimestamp(0, amount, to, balanceOfUser);

    uint256 sharesToMint = amount.mul(1e18).div(exchangeRate());
    _mint(to, sharesToMint);

    if (pullFunds) {
      STAKED_TOKEN.safeTransferFrom(from, address(this), amount);
    }

    emit Staked(from, to, amount, sharesToMint);
  }

  /**
   * @dev Redeems staked tokens, and stop earning rewards
   * @param to Address to redeem to
   * @param amount Amount to redeem
   **/
  function _redeem(
    address from,
    address to,
    uint256 amount
  ) internal {
    require(amount != 0, 'INVALID_ZERO_AMOUNT');
    //solium-disable-next-line
    uint256 cooldownStartTimestamp = stakersCooldowns[from];

    require(
      !_cooldownPaused && block.timestamp > cooldownStartTimestamp.add(COOLDOWN_SECONDS),
      'INSUFFICIENT_COOLDOWN'
    );
    require(
      block.timestamp.sub(cooldownStartTimestamp.add(COOLDOWN_SECONDS)) <= UNSTAKE_WINDOW,
      'UNSTAKE_WINDOW_FINISHED'
    );
    uint256 balanceOfFrom = balanceOf(from);

    uint256 amountToRedeem = (amount > balanceOfFrom) ? balanceOfFrom : amount;

    _updateCurrentUnclaimedRewards(from, balanceOfFrom, true);

    uint256 underlyingToRedeem = amountToRedeem.mul(exchangeRate()).div(1e18);

    _burn(from, amountToRedeem);

    if (balanceOfFrom.sub(amountToRedeem) == 0) {
      stakersCooldowns[from] = 0;
    }

    IERC20(STAKED_TOKEN).safeTransfer(to, underlyingToRedeem);

    emit Redeem(from, to, amountToRedeem, underlyingToRedeem);
  }
}
