// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title NFTLendAuction
 * @notice A decentralized lending platform where borrowers can list NFTs as collateral for loans.
 *         Lenders compete to provide loans by bidding with lower interest rates.
 *         Loans can be repaid or claimed by lenders in case of default.
 */
contract NFTLendAuction is ReentrancyGuard, Ownable {
    struct Loan {
        address borrower;          // Borrower's address
        address lender;            // Current lender (bidder offering the lowest rate)
        address nftAddress;        // Address of the NFT contract
        uint256 tokenId;           // Token ID of the NFT used as collateral
        uint256 loanAmount;        // Amount of the loan in wei
        uint256 maxInterestRate;   // Maximum acceptable interest rate (basis points)
        uint256 currentInterestRate; // Current best bid interest rate (basis points)
        uint256 duration;          // Duration of the loan in seconds
        uint256 startTime;         // Loan start time (0 if not accepted)
        bool isAccepted;             // Whether the loan is accepted
    }

    uint256 public loanCounter; // Counter to track the total number of loans created
    mapping(uint256 => Loan) public loans; // Mapping of loan IDs to loan details
    mapping(uint256 => uint256) public escrowedFunds; // Mapping of loan IDs to escrowed lender funds
    mapping(address => bool) public allowedNFTs; // Tracks which NFT contracts are allowed
    uint256[] public activeLoanIds; // List of IDs for currently active loans
    mapping(uint256 => bool) public activeLoans; // Tracks whether a loan ID is active

    uint256 public protocolFeeRate = 200; // Protocol fee rate in basis points (5%)
    uint256 public protocolFeeBalance; // Accumulated protocol fees


    // Events
    event LoanListed(uint256 loanId, Loan loan);
    event LoanDelisted(uint256 loanId, Loan loan); 
    event LoanBidPlaced(uint256 loanId, Loan loan);
    event LoanBidCancelled(uint256 loanId, Loan loan);
    event LoanAccepted(uint256 loanId, Loan loan);
    event LoanRepaid(uint256 loanId, Loan loan);
    event LoanDefaulted(uint256 loanId, Loan loan);
    event AllowedNFTUpdated(address nftAddress, bool allowed);
    event ProtocolFeeRateUpdated(uint256 newFeeRate);
    event ProtocolFeesWithdrawn(address to, uint256 amount);

    // Modifiers
    modifier onlyBorrower(uint256 loanId) {
        require(msg.sender == loans[loanId].borrower, "Not loan borrower");
        _;
    }

    modifier loanExists(uint256 loanId) {
        require(loans[loanId].borrower != address(0), "Loan does not exist");
        _;
    }

    modifier isNotAccepted(uint256 loanId) {
        require(!loans[loanId].isAccepted, "Loan already accepted");
        _;
    }

    modifier isAllowedNFT(address nftAddress) {
        require(allowedNFTs[nftAddress], "NFT contract not allowed");
        _;
    }

    /**
     * @notice Initializes the contract and sets the owner.
     */
    constructor() Ownable(msg.sender) {}

    /**
     * @notice Updates the list of allowed NFT contracts.
     * @param nftAddress Address of the NFT contract.
     * @param allowed Whether the NFT contract is allowed.
     */
    function updateAllowedNFT(address nftAddress, bool allowed) external onlyOwner {
        allowedNFTs[nftAddress] = allowed;
        emit AllowedNFTUpdated(nftAddress, allowed);
    }

    /**
     * @notice Sets the protocol fee rate.
     * @param newFeeRate New protocol fee rate in basis points.
     */
    function setProtocolFeeRate(uint256 newFeeRate) external onlyOwner {
        require(newFeeRate <= 1000, "Fee rate too high"); // Max 10%
        protocolFeeRate = newFeeRate;
        emit ProtocolFeeRateUpdated(newFeeRate);
    }

    /**
     * @notice Lists a new loan by depositing an NFT as collateral.
     * @param nftAddress Address of the NFT contract.
     * @param tokenId Token ID of the NFT.
     * @param loanAmount Desired loan amount in wei.
     * @param maxInterestRate Maximum acceptable interest rate (basis points).
     * @param duration Loan duration in seconds.
     */
    function listLoan(
        address nftAddress,
        uint256 tokenId,
        uint256 loanAmount,
        uint256 maxInterestRate,
        uint256 duration
    ) external nonReentrant isAllowedNFT(nftAddress) {
        require(IERC721(nftAddress).ownerOf(tokenId) == msg.sender, "Not NFT owner");

        // Transfer the NFT to the contract
        IERC721(nftAddress).transferFrom(msg.sender, address(this), tokenId);

        // Create a new loan
        loans[loanCounter] = Loan({
            borrower: msg.sender,
            lender: address(0),
            nftAddress: nftAddress,
            tokenId: tokenId,
            loanAmount: loanAmount,
            maxInterestRate: maxInterestRate,
            currentInterestRate: maxInterestRate,
            duration: duration,
            startTime: 0,
            isAccepted: false
        });

        // Track active loan
        activeLoans[loanCounter] = true;
        activeLoanIds.push(loanCounter);

        emit LoanListed(loanCounter, loans[loanCounter]);

        loanCounter++;
    }

    /**
     * @notice Places a bid to offer a loan at a specified interest rate.
     * @param loanId ID of the loan to bid on.
     * @param interestRate Proposed interest rate (basis points).
     */
    function placeBid(uint256 loanId, uint256 interestRate)
        external
        payable
        nonReentrant
        loanExists(loanId)
        isNotAccepted(loanId)
    {
        Loan storage loan = loans[loanId];
        require(
            interestRate < loan.currentInterestRate && interestRate <= loan.maxInterestRate,
            "Bid interest rate invalid"
        );
        require(msg.value == loan.loanAmount, "Incorrect loan amount");

        // Refund the previous lender if there is one
        if (loan.lender != address(0)) {
            payable(loan.lender).transfer(escrowedFunds[loanId]);
        }

        // Update loan details
        loan.lender = msg.sender;
        loan.currentInterestRate = interestRate;
        escrowedFunds[loanId] = msg.value;

        emit LoanBidPlaced(loanId, loan);
    }

    /**
     * @notice Delist a loan
     * @param loanId ID of the loan to delist.
     */
    function delistLoan(uint256 loanId) external nonReentrant loanExists(loanId) isNotAccepted(loanId) onlyBorrower(loanId) {
        Loan storage loan = loans[loanId];

        // Refund escrowed funds to the last bidder (if any)
        if (loan.lender != address(0)) {
            uint256 escrowAmount = escrowedFunds[loanId];
            escrowedFunds[loanId] = 0; // Clear escrow
            payable(loan.lender).transfer(escrowAmount);
        }

        // Return the NFT to the borrower
        IERC721(loan.nftAddress).transferFrom(address(this), loan.borrower, loan.tokenId);

        // Clean up loan data
        delete loans[loanId];
        _removeActiveLoan(loanId);

        emit LoanDelisted(loanId, loan);
    }

    /**
     * @notice Accepts a loan bid, starting the loan.
     * @param loanId ID of the loan to accept.
     */
    function acceptLoan(uint256 loanId)
        external
        nonReentrant
        loanExists(loanId)
        isNotAccepted(loanId)
        onlyBorrower(loanId)
    {
        Loan storage loan = loans[loanId];
        require(loan.lender != address(0), "No lender bid yet");

        loan.isAccepted = true;
        loan.startTime = block.timestamp;

        uint256 loanAmount = escrowedFunds[loanId];
        escrowedFunds[loanId] = 0;
        payable(loan.borrower).transfer(loanAmount);

        emit LoanAccepted(loanId, loan);
    }

    /**
     * @notice Get the total required repayment for a loan.
     * @param loanId ID of the loan to repay.
     */
    function getRequiredRepayment(uint256 loanId) 
        public 
        view 
        loanExists(loanId) 
        returns (uint256)
    {
        Loan storage loan = loans[loanId];
        require(loan.isAccepted, "Loan not accepted yet");

        // Calculate total repayment: principal + interest
        uint256 interestAmount = (loan.loanAmount * loan.currentInterestRate) / 10000;
        uint256 totalRepayment = loan.loanAmount + interestAmount;

        // Calculate borrower protocol fee
        uint256 borrowerProtocolFee = (totalRepayment * protocolFeeRate) / 10000;

        // Return the required payment: total repayment + borrower protocol fee
        return totalRepayment + borrowerProtocolFee;
    }

    /**
     * @notice Repays a loan and returns the NFT collateral to the borrower.
     * @param loanId ID of the loan to repay.
     */
    function repayLoan(uint256 loanId)
        external
        payable
        nonReentrant
        loanExists(loanId)
        onlyBorrower(loanId)
    {
        Loan storage loan = loans[loanId];
        require(loan.isAccepted, "Loan not accepted yet");
        require(block.timestamp <= loan.startTime + loan.duration, "Loan duration expired");

        uint256 requiredPayment = getRequiredRepayment(loanId);
        require(msg.value == requiredPayment, "Incorrect repayment amount");

        // Calculate total repayment: principal + interest
        uint256 interestAmount = (loan.loanAmount * loan.currentInterestRate) / 10000;
        uint256 totalRepayment = loan.loanAmount + interestAmount;

        // Calculate lender protocol fee
        uint256 lenderProtocolFee = (totalRepayment * protocolFeeRate) / 10000;
        uint256 lenderPayout = totalRepayment - lenderProtocolFee;

        // Update protocol fee balance
        uint256 borrowerProtocolFee = (totalRepayment * protocolFeeRate) / 10000;
        protocolFeeBalance += (borrowerProtocolFee + lenderProtocolFee);

        // Transfer NFT back to borrower
        loan.isAccepted = false;
        IERC721(loan.nftAddress).transferFrom(address(this), loan.borrower, loan.tokenId);

        // Transfer lender payout
        payable(loan.lender).transfer(lenderPayout);

        emit LoanRepaid(loanId, loan);

        _removeActiveLoan(loanId);
    }

    /**
     * @notice Cancels a bid if the borrower doesn't accept.
     * @param loanId ID of the loan to cancel.
     */
    function cancelBid(uint256 loanId) external nonReentrant loanExists(loanId) isNotAccepted(loanId) {
        Loan storage loan = loans[loanId];
        require(msg.sender == loan.lender, "Only the lender can cancel the bid");

        // Refund escrowed funds to the lender
        uint256 escrowAmount = escrowedFunds[loanId];
        escrowedFunds[loanId] = 0; // Clear escrow
        payable(loan.lender).transfer(escrowAmount);

        // Clear lender information
        loan.lender = address(0);
        loan.currentInterestRate = loan.maxInterestRate; // Reset to max rate

        emit LoanBidCancelled(loanId, loan);
    }


    /**
     * @notice Claims an NFT as collateral if the borrower defaults.
     * @param loanId ID of the loan to claim.
     */
    function claimDefaultedLoan(uint256 loanId)
        external
        payable
        nonReentrant
        loanExists(loanId)
    {
        Loan storage loan = loans[loanId];
        require(loan.isAccepted, "Loan not accepted");
        require(block.timestamp > loan.startTime + loan.duration, "Loan not expired");

        // Calculate the hypothetical repayment amount
        uint256 interestAmount = (loan.loanAmount * loan.currentInterestRate) / 10000;
        uint256 totalRepayment = loan.loanAmount + interestAmount;

        // Calculate the lender's protocol fee
        uint256 lenderProtocolFee = (totalRepayment * protocolFeeRate) / 10000;

        // Ensure the lender sends the required protocol fee
        require(msg.value == lenderProtocolFee, "Incorrect protocol fee sent");

        // Update protocol fee balance
        protocolFeeBalance += lenderProtocolFee;

        // Transfer NFT to the lender
        loan.isAccepted = false;
        IERC721(loan.nftAddress).transferFrom(address(this), loan.lender, loan.tokenId);

        emit LoanDefaulted(loanId, loan);

        _removeActiveLoan(loanId);
    }


    /**
     * @notice Returns the IDs of all active loans.
     */
    function getActiveLoans() external view returns (uint256[] memory) {
        return activeLoanIds;
    }

    /**
     * @dev Removes a loan from the active loan list.
     * @param loanId ID of the loan to remove.
     */
    function _removeActiveLoan(uint256 loanId) private {
        delete activeLoans[loanId];
        for (uint256 i = 0; i < activeLoanIds.length; i++) {
            if (activeLoanIds[i] == loanId) {
                activeLoanIds[i] = activeLoanIds[activeLoanIds.length - 1];
                activeLoanIds.pop();
                break;
            }
        }
    }

    /**
    * @notice Withdraws accumulated protocol fees to the specified address.
    * @param to Address to receive the fees.
    */
    function withdrawProtocolFees(address payable to) external onlyOwner nonReentrant {
        uint256 amount = protocolFeeBalance;
        protocolFeeBalance = 0;
        to.transfer(amount);
        emit ProtocolFeesWithdrawn(to, amount);
    }

}
