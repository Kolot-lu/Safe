// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title Safe.kolot.lu -/ Optimized
 * @dev Decentralized escrow contract for secure milestone-based project payments.
 *      Facilitates secure transactions between clients and executors with transparent
 *      and fair fund management using ERC20/TRC20 tokens and native network currency.
 */

interface IERC20 {
    function transfer(address recipient, uint256 amount) external returns (bool);
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
}

contract Safe {
    // Using uint8 for status flags
    struct Project {
        address client;             // Address of the client
        address executor;           // Address of the executor
        IERC20 token;               // Address of the ERC20/TRC20 token used for payments (zero for native currency)
        uint256 totalAmount;        // Total amount for the project
        uint256 platformFeePercent; // Platform fee percentage for the project
        uint256 currentMilestone;   // Index of the current milestone
        uint256[] milestoneAmounts; // Array of milestone payments
        uint8 statusFlags;          // 1 byte (flags for isCompleted, isCancelled, etc.)
    }

    uint8 constant IS_COMPLETED_FLAG = 1 << 0;       // 1
    uint8 constant IS_CANCELLED_FLAG = 1 << 1;       // 2
    uint8 constant IS_FUNDED_FLAG = 1 << 2;          // 4
    uint8 constant IS_NATIVE_CURRENCY_FLAG = 1 << 3; // 8

    mapping(uint256 => Project) public projects;        // Mapping of project ID to Project struct
    uint256 public projectCount;                        // Counter for the total number of projects
    address public owner;                               // Address of the contract owner
    mapping(IERC20 => uint256) public platformFunds;    // Accumulated platform fees for tokens
    uint256 public nativeCurrencyPlatformFunds;         // Accumulated platform fees for native currency

    // Events
    event ProjectCreated(uint256 indexed projectId, address indexed client, address indexed executor, address token);
    event MilestoneCompleted(uint256 indexed projectId, uint256 milestoneIndex);
    event ProjectCancelled(uint256 indexed projectId);
    event PlatformWithdrawal(address token, uint256 amount);

    // Modifier to restrict access to owner-only functions
    modifier onlyOwner() {
        require(msg.sender == owner, "Only the owner can call this function");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    /**
     * @dev Creates a new project with support for both native currency and tokens.
     * @param _executor Address of the executor
     * @param _totalAmount Total budget for the project
     * @param _milestoneAmounts Array of amounts for each milestone
     * @param _platformFeePercent Platform fee percentage (as a whole number, e.g., 50 for 0.5%)
     * @param _token Address of the ERC20/TRC20 token (set to address(0) for native currency)
     */
    function createProject(
        address _executor,
        uint256 _totalAmount,
        uint256[] calldata _milestoneAmounts,
        uint256 _platformFeePercent,
        IERC20 _token
    ) external payable {
        require(_platformFeePercent >= 100, "Platform fee percent must be at least 1%");
        require(_milestoneAmounts.length > 0, "At least one milestone required");

        uint256 platformFee = (_totalAmount * _platformFeePercent) / 10000;
        uint256 remainingAmount = _totalAmount - platformFee;

        uint256 sumMilestones;
        for (uint256 i = 0; i < _milestoneAmounts.length; i++) {
            sumMilestones += _milestoneAmounts[i];
        }
        require(sumMilestones == remainingAmount, "Milestones must sum to the remaining amount after platform fee");

        uint8 statusFlags;

        if (address(_token) == address(0)) {
            require(msg.value == _totalAmount, "Incorrect native currency value sent");
            nativeCurrencyPlatformFunds += platformFee;
            statusFlags |= IS_NATIVE_CURRENCY_FLAG;
        } else {
            require(msg.value == 0, "Native currency not required for token projects");
            require(_token.transferFrom(msg.sender, address(this), _totalAmount), "Transfer failed");
            platformFunds[_token] += platformFee;
        }

        statusFlags |= IS_FUNDED_FLAG;

        projects[projectCount] = Project({
            client: msg.sender,
            executor: _executor,
            totalAmount: remainingAmount,
            milestoneAmounts: _milestoneAmounts,
            currentMilestone: 0,
            token: _token,
            platformFeePercent: _platformFeePercent,
            statusFlags: statusFlags
        });

        emit ProjectCreated(projectCount, msg.sender, _executor, address(_token));
        projectCount++;
    }

    /**
     * @dev Confirms the completion of a milestone, releasing funds to the executor.
     * @param _projectId ID of the project with the milestone to confirm
     */
    function confirmMilestone(uint256 _projectId) external {
        Project storage project = projects[_projectId];
        require(msg.sender == project.client, "Only client can confirm milestone");
        require((project.statusFlags & IS_FUNDED_FLAG) != 0, "Project must be funded");
        require((project.statusFlags & IS_CANCELLED_FLAG) == 0, "Project is cancelled");
        require((project.statusFlags & IS_COMPLETED_FLAG) == 0, "Project is completed");
        require(project.currentMilestone < project.milestoneAmounts.length, "All milestones completed");

        uint256 milestoneAmount = project.milestoneAmounts[project.currentMilestone];
        project.currentMilestone++;

        if (project.currentMilestone == project.milestoneAmounts.length) {
            project.statusFlags |= IS_COMPLETED_FLAG;
        }

        if ((project.statusFlags & IS_NATIVE_CURRENCY_FLAG) != 0) {
            (bool success, ) = project.executor.call{value: milestoneAmount}("");
            require(success, "Transfer failed");
        } else {
            require(project.token.transfer(project.executor, milestoneAmount), "Transfer failed");
        }

        emit MilestoneCompleted(_projectId, project.currentMilestone);
    }

    /**
     * @dev Cancels a project, refunding the client for any remaining balance.
     * @param _projectId ID of the project to cancel
     */
    function cancelProject(uint256 _projectId) external {
        Project storage project = projects[_projectId];
        require(msg.sender == project.client || msg.sender == project.executor, "Only involved parties can cancel");
        require((project.statusFlags & IS_CANCELLED_FLAG) == 0, "Project is already cancelled");
        require((project.statusFlags & IS_COMPLETED_FLAG) == 0, "Project is completed");

        project.statusFlags |= IS_CANCELLED_FLAG;

        uint256 refundAmount = project.totalAmount;
        for (uint256 i = 0; i < project.currentMilestone; i++) {
            refundAmount -= project.milestoneAmounts[i];
        }

        if ((project.statusFlags & IS_NATIVE_CURRENCY_FLAG) != 0) {
            (bool success, ) = project.client.call{value: refundAmount}("");
            require(success, "Refund failed");
        } else {
            require(project.token.transfer(project.client, refundAmount), "Refund failed");
        }

        emit ProjectCancelled(_projectId);
    }

    /**
     * @dev Allows the owner to withdraw accumulated platform fees.
     * @param _token Address of the ERC20/TRC20 token to withdraw
     */
    function withdrawPlatformFunds(IERC20 _token) external onlyOwner {
        uint256 amount = platformFunds[_token];
        platformFunds[_token] = 0;
        require(_token.transfer(owner, amount), "Withdrawal failed");
        emit PlatformWithdrawal(address(_token), amount);
    }

    /**
     * @dev Allows the owner to withdraw accumulated platform fees for native currency.
     */
    function withdrawNativeCurrencyFunds() external onlyOwner {
        uint256 amount = nativeCurrencyPlatformFunds;
        nativeCurrencyPlatformFunds = 0;
        (bool success, ) = owner.call{value: amount}("");
        require(success, "Withdrawal failed");
        emit PlatformWithdrawal(address(0), amount);
    }

    /**
     * @dev Returns the milestones of a project.
     * @param projectId ID of the project
     */
    function getMilestoneAmounts(uint256 projectId) external view returns (uint256[] memory) {
        return projects[projectId].milestoneAmounts;
    }
}
