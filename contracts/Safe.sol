// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title Safe.kolot.lu
 * @dev Decentralized escrow contract for secure milestone-based project payments.
 *      Facilitates secure transactions between clients and executors with transparent
 *      and fair fund management using ERC20/TRC20 tokens and native network currency.
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
        bool isNativeCurrency;       // Flag indicating if the project uses native currency
        IERC20 token;                // Address of the ERC20/TRC20 token used for payments (zero for native currency)
        uint256 platformFeePercent;  // Platform fee percentage for the project
    }

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

    // Constructor sets the contract deployer as the owner
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
        uint256[] memory _milestoneAmounts,
        uint256 _platformFeePercent,
        IERC20 _token
    ) public payable {
        require(_platformFeePercent >= 100, "Platform fee percent must be at least 1%");
        require(_milestoneAmounts.length > 0, "At least one milestone required");

        uint256 platformFee = (_totalAmount * _platformFeePercent) / 10000;
        uint256 remainingAmount = _totalAmount - platformFee;

        // Check milestone sums
        uint256 sumMilestones = 0;
        for (uint256 i = 0; i < _milestoneAmounts.length; i++) {
            sumMilestones += _milestoneAmounts[i];
        }
        require(sumMilestones == remainingAmount, "Milestones must sum to the remaining amount after platform fee");

        // Handle native currency or token transfer
        if (address(_token) == address(0)) {
            require(msg.value == _totalAmount, "Incorrect native currency value sent");
            nativeCurrencyPlatformFunds += platformFee;
        } else {
            require(msg.value == 0, "Native currency not required for token projects");

            // Transfer the total amount to the contract
            require(
                _token.transferFrom(msg.sender, address(this), _totalAmount),
                "Transfer of total amount failed"
            );

            // Allocate the platform fee
            platformFunds[_token] += platformFee;
        }

        // Store project details
        projects[projectCount] = Project({
            client: msg.sender,
            executor: _executor,
            totalAmount: remainingAmount,
            milestoneAmounts: _milestoneAmounts,
            currentMilestone: 0,
            isCompleted: false,
            isCancelled: false,
            isFunded: true,
            isNativeCurrency: address(_token) == address(0),
            token: _token,
            platformFeePercent: _platformFeePercent
        });

        emit ProjectCreated(projectCount, msg.sender, _executor, address(_token));
        projectCount++;
    }


    /**
     * @dev Allows an executor to initiate a project, with funding and platform fee to be provided by the client later.
     * @param _client Address of the client
     * @param _totalAmount Total budget for the project
     * @param _milestoneAmounts Array of amounts for each milestone
     * @param _platformFeePercent Platform fee percentage (as a whole number, e.g., 100 for 1%)
     * @param _token Address of the ERC20/TRC20 token used for payments
     */
    function executorInitiateProject(
        address _client,
        uint256 _totalAmount,
        uint256[] memory _milestoneAmounts,
        uint256 _platformFeePercent,
        IERC20 _token
    ) public {
        require(_platformFeePercent >= 100, "Platform fee percent must be at least 1%");
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
            totalAmount: _totalAmount, // Store total amount (including platform fee)
            milestoneAmounts: _milestoneAmounts,
            currentMilestone: 0,
            isCompleted: false,
            isCancelled: false,
            isFunded: false,
            isNativeCurrency: address(_token) == address(0),
            token: _token,
            platformFeePercent: _platformFeePercent
        });

        emit ProjectCreated(projectCount, _client, msg.sender, address(_token));
        projectCount++;
    }


    /**
     * @dev Allows the client to fund a project, deducting the platform fee if necessary.
     * @param _projectId ID of the project to fund
     */
    function fundProject(uint256 _projectId) public payable {
        Project storage project = projects[_projectId];
        require(msg.sender == project.client, "Only the designated client can fund the project");
        require(!project.isFunded, "Project is already funded");

        uint256 platformFee = (project.totalAmount * project.platformFeePercent) / 10000;

        if (project.isNativeCurrency) {
            require(msg.value == project.totalAmount, "Incorrect native currency value sent");
            nativeCurrencyPlatformFunds += platformFee;
        } else {
            IERC20 token = project.token;
            require(token.transferFrom(msg.sender, address(this), project.totalAmount), "Transfer of project funds failed");
            platformFunds[token] += platformFee;
        }

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
        require(
            msg.sender == project.client || msg.sender == project.executor,
            "Only involved parties can cancel the project"
        );
        require(!project.isCancelled, "Project is already cancelled");
        require(!project.isCompleted, "Project is completed");

        project.isCancelled = true;

        uint256 refundAmount = project.totalAmount;
        if (project.currentMilestone > 0) {
            for (uint256 i = 0; i < project.currentMilestone; i++) {
                refundAmount -= project.milestoneAmounts[i];
            }
        }

        if (project.isNativeCurrency) {
            // For native currency, refund the client directly
            (bool success, ) = project.client.call{value: refundAmount}("");
            require(success, "Refund transfer failed");
        } else {
            // For ERC20 tokens, transfer the refund amount back to the client
            require(
                project.token.transfer(project.client, refundAmount),
                "Refund transfer failed"
            );
        }

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
     * @dev Allows the owner to withdraw accumulated platform fees for native currency.
     */
    function withdrawNativeCurrencyFunds() public onlyOwner {
        uint256 amount = nativeCurrencyPlatformFunds;
        nativeCurrencyPlatformFunds = 0;
        (bool success, ) = owner.call{value: amount}("");
        require(success, "Native currency withdrawal failed");
        emit PlatformWithdrawal(address(0), amount);
    }

    /**
     * @dev Returns the milestones of a project.
     * @param projectId ID of the project
     */
    function getMilestoneAmounts(uint256 projectId) external view returns (uint256[] memory) {
        return projects[projectId].milestoneAmounts;
    }

    /**
     * @dev Returns the total platform funds available for withdrawal.
     * Includes both native currency and all tracked ERC20 tokens.
     */
    function getPlatformFunds() public view onlyOwner returns (
        uint256 nativeFunds, 
        IERC20[] memory tokens, 
        uint256[] memory amounts
    ) {
        nativeFunds = nativeCurrencyPlatformFunds;

        // Temporary variables to collect tokens and amounts
        IERC20[] memory tempTokens = new IERC20[](projectCount);
        uint256[] memory tempAmounts = new uint256[](projectCount);

        uint256 tokenCount = 0;
        for (uint256 i = 0; i < projectCount; i++) {
            IERC20 token = projects[i].token;

            // Check if token is already tracked
            bool alreadyTracked = false;
            for (uint256 j = 0; j < tokenCount; j++) {
                if (tempTokens[j] == token) {
                    alreadyTracked = true;
                    break;
                }
            }

            // If not tracked, add it
            if (!alreadyTracked) {
                tempTokens[tokenCount] = token;
                tempAmounts[tokenCount] = platformFunds[token];
                tokenCount++;
            }
        }

        // Resize the arrays to the actual count
        tokens = new IERC20[](tokenCount);
        amounts = new uint256[](tokenCount);

        for (uint256 k = 0; k < tokenCount; k++) {
            tokens[k] = tempTokens[k];
            amounts[k] = tempAmounts[k];
        }

        return (nativeFunds, tokens, amounts);
    }

    /**
     * @dev Returns all projects associated with a given user, either as a client or executor.
     * @param user Address of the user to check.
     */
    function getUserProjects(address user) public view returns (Project[] memory userProjects, string[] memory roles) {
        uint256 userProjectCount = 0;

        // First pass: count the number of projects associated with the user
        for (uint256 i = 0; i < projectCount; i++) {
            if (projects[i].client == user || projects[i].executor == user) {
                userProjectCount++;
            }
        }

        // Second pass: collect the projects and roles
        userProjects = new Project[](userProjectCount);
        roles = new string[](userProjectCount);
        uint256 index = 0;
        for (uint256 i = 0; i < projectCount; i++) {
            if (projects[i].client == user || projects[i].executor == user) {
                userProjects[index] = projects[i];
                roles[index] = projects[i].client == user ? "Client" : "Executor";
                index++;
            }
        }

        return (userProjects, roles);
    }

}
