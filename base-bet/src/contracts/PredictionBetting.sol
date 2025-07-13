// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract PredictionBetting {
    struct Bet {
        address bettor;
        uint256 amount;
        bool position; // true = agree, false = disagree
        uint256 timestamp;
    }
    
    struct Market {
        string prediction;
        string tweetId;
        address creator;
        uint256 deadline;
        bool resolved;
        bool outcome;
        Bet[] bets;
        uint256 totalAgree;
        uint256 totalDisagree;
        bool active;
    }
    
    mapping(string => Market) public markets;
    mapping(address => uint256) public pendingWithdrawals;
    mapping(string => bool) public marketExists;
    
    address public owner;
    uint256 public platformFee = 200; // 2% (200 basis points)
    uint256 public constant BASIS_POINTS = 10000;
    
    event MarketCreated(
        string indexed tweetId, 
        string prediction, 
        address creator,
        uint256 deadline
    );
    
    event BetPlaced(
        string indexed tweetId, 
        address bettor, 
        uint256 amount, 
        bool position
    );
    
    event MarketResolved(string indexed tweetId, bool outcome);
    event Withdrawal(address indexed user, uint256 amount);
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }
    
    modifier marketMustExist(string memory tweetId) {
        require(marketExists[tweetId], "Market does not exist");
        _;
    }
    
    constructor() {
        owner = msg.sender;
    }
    
    function createMarket(
        string memory tweetId,
        string memory prediction,
        uint256 durationDays
    ) external {
        require(!marketExists[tweetId], "Market already exists");
        require(bytes(prediction).length > 0, "Invalid prediction");
        require(durationDays > 0 && durationDays <= 365, "Invalid duration");
        
        uint256 deadline = block.timestamp + (durationDays * 1 days);
        
        Market storage market = markets[tweetId];
        market.prediction = prediction;
        market.tweetId = tweetId;
        market.creator = msg.sender;
        market.deadline = deadline;
        market.resolved = false;
        market.outcome = false;
        market.totalAgree = 0;
        market.totalDisagree = 0;
        market.active = true;
        
        marketExists[tweetId] = true;
        
        emit MarketCreated(tweetId, prediction, msg.sender, deadline);
    }
    
    function placeBet(
        string memory tweetId, 
        bool position
    ) external payable marketMustExist(tweetId) {
        Market storage market = markets[tweetId];
        require(market.active, "Market not active");
        require(block.timestamp < market.deadline, "Betting period ended");
        require(!market.resolved, "Market already resolved");
        require(msg.value > 0, "Bet amount must be > 0");
        require(msg.value >= 0.001 ether, "Minimum bet is 0.001 ETH");
        require(msg.value <= 10 ether, "Maximum bet is 10 ETH");
        
        market.bets.push(Bet({
            bettor: msg.sender,
            amount: msg.value,
            position: position,
            timestamp: block.timestamp
        }));
        
        if (position) {
            market.totalAgree += msg.value;
        } else {
            market.totalDisagree += msg.value;
        }
        
        emit BetPlaced(tweetId, msg.sender, msg.value, position);
    }
    
    function resolveMarket(
        string memory tweetId, 
        bool outcome
    ) external onlyOwner marketMustExist(tweetId) {
        Market storage market = markets[tweetId];
        require(market.active, "Market not active");
        require(!market.resolved, "Already resolved");
        require(block.timestamp >= market.deadline, "Market not yet expired");
        
        market.resolved = true;
        market.outcome = outcome;
        
        uint256 totalPool = market.totalAgree + market.totalDisagree;
        if (totalPool == 0) return;
        
        uint256 winningPool = outcome ? market.totalAgree : market.totalDisagree;
        uint256 losingPool = outcome ? market.totalDisagree : market.totalAgree;
        
        if (winningPool == 0) {
            // No winners, refund everyone
            for (uint i = 0; i < market.bets.length; i++) {
                Bet memory bet = market.bets[i];
                pendingWithdrawals[bet.bettor] += bet.amount;
            }
        } else {
            // Calculate platform fee
            uint256 platformFeeAmount = (losingPool * platformFee) / BASIS_POINTS;
            uint256 prizePool = losingPool - platformFeeAmount;
            
            // Distribute winnings
            for (uint i = 0; i < market.bets.length; i++) {
                Bet memory bet = market.bets[i];
                if (bet.position == outcome) {
                    // Winner gets bet back + proportional share of prize pool
                    uint256 winnings = bet.amount + (bet.amount * prizePool) / winningPool;
                    pendingWithdrawals[bet.bettor] += winnings;
                }
            }
            
            // Platform fee to owner
            pendingWithdrawals[owner] += platformFeeAmount;
        }
        
        emit MarketResolved(tweetId, outcome);
    }
    
    function withdraw() external {
        uint256 amount = pendingWithdrawals[msg.sender];
        require(amount > 0, "No funds to withdraw");
        
        pendingWithdrawals[msg.sender] = 0;
        payable(msg.sender).transfer(amount);
        
        emit Withdrawal(msg.sender, amount);
    }
    
    function getMarketInfo(string memory tweetId) 
        external 
        view 
        marketMustExist(tweetId)
        returns (
            string memory prediction,
            uint256 deadline,
            bool resolved,
            bool outcome,
            uint256 totalAgree,
            uint256 totalDisagree,
            uint256 betCount
        ) 
    {
        Market storage market = markets[tweetId];
        return (
            market.prediction,
            market.deadline,
            market.resolved,
            market.outcome,
            market.totalAgree,
            market.totalDisagree,
            market.bets.length
        );
    }
    
    function getUserBets(string memory tweetId, address user) 
        external 
        view 
        marketMustExist(tweetId)
        returns (uint256[] memory amounts, bool[] memory positions) 
    {
        Market storage market = markets[tweetId];
        uint256 userBetCount = 0;
        
        // Count user bets
        for (uint i = 0; i < market.bets.length; i++) {
            if (market.bets[i].bettor == user) {
                userBetCount++;
            }
        }
        
        amounts = new uint256[](userBetCount);
        positions = new bool[](userBetCount);
        
        uint256 index = 0;
        for (uint i = 0; i < market.bets.length; i++) {
            if (market.bets[i].bettor == user) {
                amounts[index] = market.bets[i].amount;
                positions[index] = market.bets[i].position;
                index++;
            }
        }
    }
    
    function setPlatformFee(uint256 _fee) external onlyOwner {
        require(_fee <= 1000, "Fee cannot exceed 10%"); // Max 10%
        platformFee = _fee;
    }
} 