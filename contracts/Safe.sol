// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/** 
 * @title Safe.kolot.lu
 * @dev Decentralized escrow contract for secure milestone-based project payments.
 *      Facilitates secure transactions between clients and executors with transparent
 *      and fair fund management using ERC20/TRC20 tokens.
 */

interface IERC20 {
    function transfer(address recipient, uint256 amount) external returns (bool);
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

contract Safe {
    // Struct to store project details
    struct Project {
        address client;              // Address of the client
        address executor;            // Address of the executor (freelancer)
        uint256 totalAmount;         // Total amount for the project
        uint256[] milestoneAmounts;  // Array of milestone payments
        uint256 currentMilestone;    // Index of the current milestone
        bool isCompleted;            // Flag indicating if the project is completed
        bool isCancelled;            // Flag indicating if the project is cancelled
        bool isFunded;               // Flag indicating if the project is funded
        IERC20 token;                // Address of the ERC20/TRC20 token used for payments
    }

    mapping(uint256 => Project) public projects; // Mapping of project ID to Project struct
    uint256 public projectCount;                 // Counter for the total number of projects
    address public owner;                        // Address of the contract owner
    mapping(IERC20 => uint256) public platformFunds; // Accumulated platform fees for each token

    // Events for logging significant contract actions
    event ProjectCreated(uint256 indexed projectId, address indexed client, address indexed executor, address token);
    event MilestoneCompleted(uint256 indexed projectId, uint256 milestoneIndex);
    event ProjectCancelled(uint256 indexed projectId);
    event PlatformWithdrawal(address token, uint256 amount);

    // Modifier to restrict access to owner-only functions
    modifier onlyOwner() {
        require(msg.sender == owner, "Only the owner can call this function");
        _;
    }

    // Constructor sets the contract deployer as the owner
    constructor() {
        owner = msg.sender;
    }

    /**
     * @dev Creates a new project and deducts the platform fee.
     * @param _executor Address of the executor
     * @param _totalAmount Total budget for the project
     * @param _milestoneAmounts Array of amounts for each milestone
     * @param _platformFeePercent Platform fee percentage (as a whole number, e.g., 50 for 0.5%)
     * @param _token Address of the ERC20/TRC20 token used for payments
     */
    function createProject(
        address _executor,
        uint256 _totalAmount,
        uint256[] memory _milestoneAmounts,
        uint256 _platformFeePercent,
        IERC20 _token
    ) public {
        require(_platformFeePercent >= 50, "Platform fee percent must be at least 0.5%");
        require(_milestoneAmounts.length > 0, "At least one milestone required");

        uint256 platformFee = (_totalAmount * _platformFeePercent) / 10000;
        uint256 remainingAmount = _totalAmount - platformFee;

        uint256 sumMilestones = 0;
        for (uint256 i = 0; i < _milestoneAmounts.length; i++) {
            sumMilestones += _milestoneAmounts[i];
        }
        require(sumMilestones == remainingAmount, "Milestones must sum to the remaining amount after platform fee");

        projects[projectCount] = Project({
            client: msg.sender,
            executor: _executor,
            totalAmount: remainingAmount,
            milestoneAmounts: _milestoneAmounts,
            currentMilestone: 0,
            isCompleted: false,
            isCancelled: false,
            isFunded: false,
            token: _token
        });

        // Transfer platform fee to the contract
        require(_token.transferFrom(msg.sender, address(this), platformFee), "Transfer of platform fee failed");
        platformFunds[_token] += platformFee;

        emit ProjectCreated(projectCount, msg.sender, _executor, address(_token));
        projectCount++;
    }

    /**
     * @dev Allows an executor to initiate a project, with funding to be provided by the client later.
     * @param _client Address of the client
     * @param _totalAmount Total budget for the project
     * @param _milestoneAmounts Array of amounts for each milestone
     * @param _platformFeePercent Platform fee percentage (as a whole number, e.g., 50 for 0.5%)
     * @param _token Address of the ERC20/TRC20 token used for payments
     */
    function executorInitiateProject(
        address _client,
        uint256 _totalAmount,
        uint256[] memory _milestoneAmounts,
        uint256 _platformFeePercent,
        IERC20 _token
    ) public {
        require(_platformFeePercent >= 50, "Platform fee percent must be at least 0.5%");
        require(_milestoneAmounts.length > 0, "At least one milestone required");

        uint256 platformFee = (_totalAmount * _platformFeePercent) / 10000;
        uint256 remainingAmount = _totalAmount - platformFee;

        uint256 sumMilestones = 0;
        for (uint256 i = 0; i < _milestoneAmounts.length; i++) {
            sumMilestones += _milestoneAmounts[i];
        }
        require(sumMilestones == remainingAmount, "Milestones must sum to the remaining amount after platform fee");

        projects[projectCount] = Project({
            client: _client,
            executor: msg.sender,
            totalAmount: remainingAmount,
            milestoneAmounts: _milestoneAmounts,
            currentMilestone: 0,
            isCompleted: false,
            isCancelled: false,
            isFunded: false,
            token: _token
        });

        // Transfer platform fee to the contract
        require(_token.transferFrom(msg.sender, address(this), platformFee), "Transfer of platform fee failed");
        platformFunds[_token] += platformFee;

        emit ProjectCreated(projectCount, _client, msg.sender, address(_token));
        projectCount++;
    }

    /**
     * @dev Allows the client to fund the project after it is initiated by the executor.
     * @param _projectId ID of the project to fund
     */
    function fundProject(uint256 _projectId) public {
        Project storage project = projects[_projectId];
        require(msg.sender == project.client, "Only the designated client can fund the project");
        require(!project.isFunded, "Project is already funded");

        uint256 totalAmount = project.totalAmount;
        IERC20 token = project.token;
        require(token.transferFrom(msg.sender, address(this), totalAmount), "Transfer of project funds failed");

        project.isFunded = true;
    }

    /**
     * @dev Confirms the completion of a milestone, releasing funds to the executor.
     * @param _projectId ID of the project with the milestone to confirm
     */
    function confirmMilestone(uint256 _projectId) public {
        Project storage project = projects[_projectId];
        require(msg.sender == project.client, "Only client can confirm milestone");
        require(project.isFunded, "Project must be funded");
        require(!project.isCancelled, "Project is cancelled");
        require(!project.isCompleted, "Project is completed");
        require(project.currentMilestone < project.milestoneAmounts.length, "All milestones completed");

        uint256 milestoneAmount = project.milestoneAmounts[project.currentMilestone];
        project.currentMilestone++;

        if (project.currentMilestone == project.milestoneAmounts.length) {
            project.isCompleted = true;
        }

        require(project.token.transfer(project.executor, milestoneAmount), "Transfer of milestone payment failed");
        emit MilestoneCompleted(_projectId, project.currentMilestone);
    }

    /**
     * @dev Cancels a project, refunding the client for any remaining balance.
     * @param _projectId ID of the project to cancel
     */
    function cancelProject(uint256 _projectId) public {
        Project storage project = projects[_projectId];
        require(msg.sender == project.client || msg.sender == project.executor, "Only involved parties can cancel the project");
        require(!project.isCancelled, "Project is already cancelled");
        require(!project.isCompleted, "Project is completed");

        project.isCancelled = true;

        uint256 refundAmount = project.totalAmount;
        if (project.currentMilestone > 0) {
            for (uint256 i = 0; i < project.currentMilestone; i++) {
                refundAmount -= project.milestoneAmounts[i];
            }
        }

        require(project.token.transfer(project.client, refundAmount), "Refund transfer failed");
        emit ProjectCancelled(_projectId);
    }

    /**
     * @dev Allows the owner to withdraw accumulated platform fees.
     * @param _token Address of the ERC20/TRC20 token to withdraw
     */
    function withdrawPlatformFunds(IERC20 _token) public onlyOwner {
        uint256 amount = platformFunds[_token];
        platformFunds[_token] = 0;
        require(_token.transfer(owner, amount), "Platform funds withdrawal failed");
        emit PlatformWithdrawal(address(_token), amount);
    }

    /**
     * @dev Returns the milestones of a project.
     * @param projectId ID of the project
     */
    function getMilestoneAmounts(uint256 projectId) external view returns (uint256[] memory) {
        return projects[projectId].milestoneAmounts;
    }
}
