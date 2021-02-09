// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.7.5;
pragma experimental ABIEncoderV2;

import {ERC20} from '@aave/aave-token/contracts/open-zeppelin/ERC20.sol';

import {IERC20} from '../interfaces/IERC20.sol';
import {ISlashableStakeToken} from '../interfaces/ISlashableStakeToken.sol';
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
contract StakedTokenV3 is StakedTokenV2,
  ISlashableStakeToken,
  RoleManager
{
  using SafeMath for uint256;
  using SafeERC20 for IERC20;
  using PercentageMath for uint256;

  uint256 public constant SLASH_ADMIN_ROLE = 0;
  uint256 public constant COOLDOWN_ADMIN_ROLE = 1;
  
  function REVISION() public virtual override pure returns(uint256) {
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


  event Staked(address indexed from, address indexed onBehalfOf, uint256 amount, uint256 sharesMinted);
  event Redeem(address indexed from, address indexed to, uint256 amount, uint256 underlyingTransferred);
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
  ) public StakedTokenV2(stakedToken,
     rewardToken,
     cooldownSeconds,
     unstakeWindow,
     rewardsVault,
     emissionManager,
     distributionDuration,
      name,
      symbol,
     decimals,
     governance) {
  }
  /**
   * @dev Inherited from StakedTokenV2, deprecated
   **/
  function initialize() external override {
    revert("DEPRECATED");
  }

  /**
   * @dev Called by the proxy contract
   **/
  function initialize(
    address slashingAdmin,
    address cooldownPauseAdmin,
    uint256 maxSlashablePercentage,
    string calldata name,
    string calldata symbol,
    uint8 decimals) external initializer {
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
    
    address[] memory adminsAddresses = new address[](2);
    uint256[] memory adminsRoles = new uint256[](2);

    adminsAddresses[0] = slashingAdmin;
    adminsAddresses[1] = cooldownPauseAdmin;

    adminsRoles[0] = SLASH_ADMIN_ROLE;
    adminsRoles[1] = COOLDOWN_ADMIN_ROLE;

    _initAdmins(adminsRoles, adminsAddresses);

    _maxSlashablePercentage = maxSlashablePercentage;
  }

  /**
  * @dev allows a user to stake STAKED_TOKEN 
  * @param onBehalfOf address of the user that will receive stake token shares 
  * @param amount the amount to be staked
  **/
  function stake(address onBehalfOf, uint256 amount) external override(IStakedToken,StakedTokenV2) {
    require(amount != 0, 'INVALID_ZERO_AMOUNT');
    uint256 balanceOfUser = balanceOf(onBehalfOf);

    uint256 accruedRewards = _updateUserAssetInternal(
      onBehalfOf,
      address(this),
      balanceOfUser,
      totalSupply()
    );
    if (accruedRewards != 0) {
      emit RewardsAccrued(onBehalfOf, accruedRewards);
      stakerRewardsToClaim[onBehalfOf] = stakerRewardsToClaim[onBehalfOf].add(accruedRewards);
    }

    stakersCooldowns[onBehalfOf] = getNextCooldownTimestamp(0, amount, onBehalfOf, balanceOfUser);

    uint256 sharesToMint = amount.mul(1e18).div(exchangeRate());
    _mint(onBehalfOf, sharesToMint);

    IERC20(STAKED_TOKEN).safeTransferFrom(msg.sender, address(this), amount);

    emit Staked(msg.sender, onBehalfOf, amount, sharesToMint);
  }

  /**
   * @dev Redeems staked tokens, and stop earning rewards
   * @param to Address to redeem to
   * @param amount Amount to redeem
   **/
  function redeem(address to, uint256 amount) external override(IStakedToken,StakedTokenV2) {
    require(amount != 0, 'INVALID_ZERO_AMOUNT');
    //solium-disable-next-line
    uint256 cooldownStartTimestamp = stakersCooldowns[msg.sender];

    require(
      !_cooldownPaused && block.timestamp > cooldownStartTimestamp.add(COOLDOWN_SECONDS),
      'INSUFFICIENT_COOLDOWN'
    );
    require(
      block.timestamp.sub(cooldownStartTimestamp.add(COOLDOWN_SECONDS)) <= UNSTAKE_WINDOW,
      'UNSTAKE_WINDOW_FINISHED'
    );
    uint256 balanceOfMessageSender = balanceOf(msg.sender);

    uint256 amountToRedeem = (amount > balanceOfMessageSender) ? balanceOfMessageSender : amount;

    _updateCurrentUnclaimedRewards(msg.sender, balanceOfMessageSender, true);

    uint256 underlyingToRedeem = amountToRedeem.mul(exchangeRate()).div(1e18);

    _burn(msg.sender, amountToRedeem);

    if (balanceOfMessageSender.sub(amountToRedeem) == 0) {
      stakersCooldowns[msg.sender] = 0;
    }

    IERC20(STAKED_TOKEN).safeTransfer(to, underlyingToRedeem);

    emit Redeem(msg.sender, to, amountToRedeem, underlyingToRedeem);
  }

  /**
   * @dev Calculates the exchange rate between the amount of STAKED_TOKEN and the the StakeToken total supply.
   * Slashing will reduce the exchange rate. Supplying STAKED_TOKEN to the stake contract
   * can replenish the slashed STAKED_TOKEN and bring the exchange rate back to 1
   **/
  function exchangeRate() public override view returns (uint256) {
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

    uint256 balance = IERC20(STAKED_TOKEN).balanceOf(address(this));

    uint256 maxSlashable = balance.percentMul(_maxSlashablePercentage);

    require(amount <= maxSlashable, "INVALID_SLASHING_AMOUNT");

    IERC20(STAKED_TOKEN).safeTransfer(destination, amount);

    emit Slashed(destination, amount);
  }

  /**
  * @dev returns true if the unstake cooldown is paused
  */ 
  function getCooldownPaused() external override view returns(bool) {
    return  _cooldownPaused;
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
    require(percentage <= PercentageMath.PERCENTAGE_FACTOR, "INVALID_SLASHING_PERCENTAGE");

    _maxSlashablePercentage = percentage;
    emit MaxSlashablePercentageChanged(percentage);
  }

  /**
  * @dev returns the current maximum slashable percentage of the stake
  */ 
  function getMaxSlashablePercentage() external override view returns(uint256) {
    return _maxSlashablePercentage;
  }

    
    /**
   * @dev returns the revision of the implementation contract
   * @return The revision
   */
  function getRevision() internal virtual pure override returns (uint256) {
    return REVISION();
  }

}
