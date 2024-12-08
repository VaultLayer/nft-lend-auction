const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("NFTLendAuction", function () {
  let NFTLendAuction, nftLendAuction, owner, borrower, lender1, lender2, nftContract, anotherNFTContract;

  beforeEach(async function () {
    [owner, borrower, lender1, lender2] = await ethers.getSigners();

    // Deploy MockNFT contract
    const MockNFT = await ethers.getContractFactory("MockNFT");
    nftContract = await MockNFT.deploy();
    await nftContract.deployed();

    // Deploy another NFT contract for testing disallowed cases
    anotherNFTContract = await MockNFT.deploy();
    await anotherNFTContract.deployed();

    // Mint an NFT to the borrower
    await nftContract.connect(borrower).mint();
    await anotherNFTContract.connect(borrower).mint();

    // Deploy the NFTLendAuction contract
    const NFTLendAuction = await ethers.getContractFactory("NFTLendAuction");
    nftLendAuction = await NFTLendAuction.deploy();
    await nftLendAuction.deployed();

    // Allow the first NFT contract by the owner
    await nftLendAuction.connect(owner).updateAllowedNFT(nftContract.address, true);
  });

  it("should allow a borrower to list a loan with an allowed NFT", async function () {
    await nftContract.connect(borrower).approve(nftLendAuction.address, 1);
    await nftLendAuction
      .connect(borrower)
      .listLoan(nftContract.address, 1, ethers.utils.parseEther("10"), 1000, 604800);

    const loan = await nftLendAuction.loans(0);
    expect(loan.borrower).to.equal(borrower.address);
    expect(loan.loanAmount).to.equal(ethers.utils.parseEther("10"));
  });

  it("should prevent a borrower from listing a loan with a disallowed NFT", async function () {
    await anotherNFTContract.connect(borrower).approve(nftLendAuction.address, 1);

    await expect(
      nftLendAuction
        .connect(borrower)
        .listLoan(anotherNFTContract.address, 1, ethers.utils.parseEther("10"), 1000, 604800)
    ).to.be.revertedWith("NFT contract not allowed");
  });

  it("should allow the owner to update the allowed NFT list", async function () {
    // Disallow the previously allowed contract
    await nftLendAuction.connect(owner).updateAllowedNFT(nftContract.address, false);

    await nftContract.connect(borrower).approve(nftLendAuction.address, 1);

    await expect(
      nftLendAuction
        .connect(borrower)
        .listLoan(nftContract.address, 1, ethers.utils.parseEther("10"), 1000, 604800)
    ).to.be.revertedWith("NFT contract not allowed");

    // Re-allow the contract
    await nftLendAuction.connect(owner).updateAllowedNFT(nftContract.address, true);

    await nftLendAuction
      .connect(borrower)
      .listLoan(nftContract.address, 1, ethers.utils.parseEther("10"), 1000, 604800);

    const loan = await nftLendAuction.loans(0);
    expect(loan.borrower).to.equal(borrower.address);
  });

  it("should prevent non-owners from updating the allowed NFT list", async function () {
    await expect(
      nftLendAuction.connect(borrower).updateAllowedNFT(nftContract.address, false)
    ).to.be.revertedWithCustomError(nftLendAuction, "AccessControlUnauthorizedAccount");
  });
  
  it("should emit an event when updating the allowed NFT list", async function () {
    await expect(
      nftLendAuction.connect(owner).updateAllowedNFT(nftContract.address, false)
    )
      .to.emit(nftLendAuction, "AllowedNFTUpdated")
      .withArgs(nftContract.address, false);
  });

  it("should refund escrowed funds when delisting a loan", async function () {
    const loanAmount = ethers.utils.parseEther("10");
    await nftContract.connect(borrower).approve(nftLendAuction.address, 1);
    await nftLendAuction.connect(borrower).listLoan(nftContract.address, 1, loanAmount, 1000, 604800);

    await nftLendAuction.connect(lender1).placeBid(0, 800, { value: loanAmount });

    const lenderBalanceBefore = await ethers.provider.getBalance(lender1.address);

    await nftLendAuction.connect(borrower).delistLoan(0);

    const lenderBalanceAfter = await ethers.provider.getBalance(lender1.address);
    expect(lenderBalanceAfter).to.be.above(lenderBalanceBefore);
  });

  it("should transfer escrow amount to borrower upon loan acceptance", async function () {
    const loanAmount = ethers.utils.parseEther("10");

    await nftContract.connect(borrower).approve(nftLendAuction.address, 1);
    await nftLendAuction
        .connect(borrower)
        .listLoan(nftContract.address, 1, loanAmount, 1000, 604800);

    await nftLendAuction.connect(lender1).placeBid(0, 800, { value: loanAmount });

    const borrowerBalanceBefore = await ethers.provider.getBalance(borrower.address);

    // Borrower accepts the loan
    const tx = await nftLendAuction.connect(borrower).acceptLoan(0);
    const receipt = await tx.wait();

    // Calculate gas cost
    const gasUsed = receipt.gasUsed;
    const gasPrice = tx.gasPrice;
    const gasCost = gasUsed.mul(gasPrice);

    const borrowerBalanceAfter = await ethers.provider.getBalance(borrower.address);

    // Borrower's balance difference should match the loan amount minus gas costs
    expect(borrowerBalanceAfter.sub(borrowerBalanceBefore).add(gasCost)).to.equal(loanAmount);
  });

  it("should refund the previous bidder when a new bid is placed", async function () {
    const loanAmount = ethers.utils.parseEther("10");

    await nftContract.connect(borrower).approve(nftLendAuction.address, 1);
    await nftLendAuction
      .connect(borrower)
      .listLoan(nftContract.address, 1, loanAmount, 1000, 604800); // 1 week

    // First lender places a bid
    await nftLendAuction.connect(lender1).placeBid(0, 900, { value: loanAmount });

    // Track balances before second bid
    const lender1BalanceBefore = await ethers.provider.getBalance(lender1.address);

    // Second lender places a better bid
    await nftLendAuction.connect(lender2).placeBid(0, 800, { value: loanAmount });

    // Validate refund to the first lender
    const lender1BalanceAfter = await ethers.provider.getBalance(lender1.address);
    expect(lender1BalanceAfter).to.be.above(lender1BalanceBefore);
  });

  it("should allow lenders to cancel bids and refund escrowed funds", async function () {
    const loanAmount = ethers.utils.parseEther("10");
    await nftContract.connect(borrower).approve(nftLendAuction.address, 1);
    await nftLendAuction.connect(borrower).listLoan(nftContract.address, 1, loanAmount, 1000, 604800);

    await nftLendAuction.connect(lender1).placeBid(0, 800, { value: loanAmount });

    const lenderBalanceBefore = await ethers.provider.getBalance(lender1.address);

    await nftLendAuction.connect(lender1).cancelBid(0);

    const lenderBalanceAfter = await ethers.provider.getBalance(lender1.address);
    expect(lenderBalanceAfter).to.be.above(lenderBalanceBefore);

    const loan = await nftLendAuction.loans(0);
    expect(loan.lender).to.equal(ethers.constants.AddressZero);
    expect(loan.currentInterestRate).to.equal(loan.maxInterestRate);
  });

  it("should prevent non-lenders from canceling bids", async function () {
    const loanAmount = ethers.utils.parseEther("10");
    await nftContract.connect(borrower).approve(nftLendAuction.address, 1);
    await nftLendAuction.connect(borrower).listLoan(nftContract.address, 1, loanAmount, 1000, 604800);

    await nftLendAuction.connect(lender1).placeBid(0, 800, { value: loanAmount });

    await expect(
        nftLendAuction.connect(lender2).cancelBid(0)
    ).to.be.revertedWith("Not loan lender");
  });

  it("should prevent bid cancellation for accepted loans", async function () {
    const loanAmount = ethers.utils.parseEther("10");
    await nftContract.connect(borrower).approve(nftLendAuction.address, 1);
    await nftLendAuction.connect(borrower).listLoan(nftContract.address, 1, loanAmount, 1000, 604800);

    await nftLendAuction.connect(lender1).placeBid(0, 800, { value: loanAmount });
    await nftLendAuction.connect(borrower).acceptLoan(0);

    await expect(
        nftLendAuction.connect(lender1).cancelBid(0)
    ).to.be.revertedWith("Loan already accepted");
  });
  
  it("should repay the lender and reclaim NFT upon loan repayment", async function () {
    const loanAmount = ethers.utils.parseEther("10");
    const interestRate = 800; // 8% interest
    const protocolFeeRate = 200; // 2% protocol fee

    const repaymentAmount = loanAmount.add(loanAmount.mul(interestRate).div(10000)); // Principal + Interest
    const borrowerProtocolFee = repaymentAmount.mul(protocolFeeRate).div(10000);
    const lenderProtocolFee = repaymentAmount.mul(protocolFeeRate).div(10000);
    const totalRepayment = repaymentAmount.add(borrowerProtocolFee);

    await nftContract.connect(borrower).approve(nftLendAuction.address, 1);
    await nftLendAuction
        .connect(borrower)
        .listLoan(nftContract.address, 1, loanAmount, 1000, 604800);

    await nftLendAuction.connect(lender1).placeBid(0, 800, { value: loanAmount });
    await nftLendAuction.connect(borrower).acceptLoan(0);

    const lenderBalanceBefore = await ethers.provider.getBalance(lender1.address);

    // Borrower repays the loan
    await nftLendAuction.connect(borrower).repayLoan(0, { value: totalRepayment });

    const lenderBalanceAfter = await ethers.provider.getBalance(lender1.address);

    // Verify lender received the repayment minus protocol fee
    expect(lenderBalanceAfter.sub(lenderBalanceBefore)).to.equal(repaymentAmount.sub(lenderProtocolFee));

    // Verify NFT ownership returned to borrower
    expect(await nftContract.ownerOf(1)).to.equal(borrower.address);
  });


  it("should require lender to pay protocol fee upon claiming a defaulted loan", async function () {
    const loanAmount = ethers.utils.parseEther("10");
    const interestRate = 800; // 8% interest
    const protocolFeeRate = 200; // 5% protocol fee

    // Calculate hypothetical repayment and lender's protocol fee
    const interestAmount = loanAmount.mul(interestRate).div(10000);
    const totalRepayment = loanAmount.add(interestAmount);
    const lenderProtocolFee = totalRepayment.mul(protocolFeeRate).div(10000);

    await nftContract.connect(borrower).approve(nftLendAuction.address, 1);
    await nftLendAuction
        .connect(borrower)
        .listLoan(nftContract.address, 1, loanAmount, 1000, 2); // 2 seconds duration

    await nftLendAuction.connect(lender1).placeBid(0, interestRate, { value: loanAmount });
    await nftLendAuction.connect(borrower).acceptLoan(0);

    // Advance time beyond the loan duration
    await ethers.provider.send("evm_increaseTime", [3]);
    await ethers.provider.send("evm_mine", []);

    // Lender claims the defaulted loan
    const tx = await nftLendAuction.connect(lender1).claimDefaultedLoan(0, {
        value: lenderProtocolFee,
    });

    const receipt = await tx.wait();

    // Verify protocol fee balance updated
    const protocolFeeBalance = await nftLendAuction.protocolFeeBalance();
    expect(protocolFeeBalance).to.equal(lenderProtocolFee);

    // Verify NFT transferred to lender
    expect(await nftContract.ownerOf(1)).to.equal(lender1.address);
  });


  it("should correctly track active loans", async function () {
    const loanAmount = ethers.utils.parseEther("10");
    const interestRate = 800; // 8% interest rate
    const protocolFeeRate = 200; // 2% protocol fee

    // Calculate repayment details
    const interestAmount = loanAmount.mul(interestRate).div(10000); // Interest = loanAmount * rate / 10000
    const totalRepayment = loanAmount.add(interestAmount); // Total repayment = principal + interest
    const borrowerProtocolFee = totalRepayment.mul(protocolFeeRate).div(10000); // Borrower's protocol fee
    const requiredRepayment = totalRepayment.add(borrowerProtocolFee); // Total payment required from borrower

    // Approve and list two loans
    await nftContract.connect(borrower).approve(nftLendAuction.address, 1);
    await nftContract.connect(borrower).mint(); // Mint a second NFT for testing
    await nftContract.connect(borrower).approve(nftLendAuction.address, 2);

    await nftLendAuction
        .connect(borrower)
        .listLoan(nftContract.address, 1, loanAmount, 1000, 604800); // Loan 1
    await nftLendAuction
        .connect(borrower)
        .listLoan(nftContract.address, 2, ethers.utils.parseEther("20"), 1000, 604800); // Loan 2

    // Verify both loans are active
    let activeLoans = await nftLendAuction.getActiveLoans();
    expect(activeLoans.length).to.equal(2);

    // Place a bid and accept the first loan
    await nftLendAuction.connect(lender1).placeBid(0, interestRate, { value: loanAmount });
    await nftLendAuction.connect(borrower).acceptLoan(0);

    // Repay the first loan
    await nftLendAuction.connect(borrower).repayLoan(0, { value: requiredRepayment });

    // Verify only one loan is active
    activeLoans = await nftLendAuction.getActiveLoans();
    expect(activeLoans.length).to.equal(1);

    // Verify the remaining loan is still active
    expect(activeLoans[0].toNumber()).to.equal(1);
  });


  it("should deduct the protocol fee upon loan repayment", async function () {
    const loanAmount = ethers.utils.parseEther("10");
    const interestRate = 800; // 8% interest rate
    const protocolFeeRate = 200; // 2% protocol fee

    // Calculate repayment details
    const interestAmount = loanAmount.mul(interestRate).div(10000); // Interest = loanAmount * rate / 10000
    const totalRepayment = loanAmount.add(interestAmount); // Total repayment = principal + interest
    const borrowerProtocolFee = totalRepayment.mul(protocolFeeRate).div(10000); // Borrower's protocol fee
    const lenderProtocolFee = totalRepayment.mul(protocolFeeRate).div(10000); // Lender's protocol fee
    const requiredRepayment = totalRepayment.add(borrowerProtocolFee); // Total payment required from borrower
    const lenderPayout = totalRepayment.sub(lenderProtocolFee); // Amount lender receives after fee

    // Approve and list loan
    await nftContract.connect(borrower).approve(nftLendAuction.address, 1);
    await nftLendAuction
        .connect(borrower)
        .listLoan(nftContract.address, 1, loanAmount, 1000, 604800); // 1 week duration

    // Place bid and accept loan
    await nftLendAuction.connect(lender1).placeBid(0, interestRate, { value: loanAmount });
    await nftLendAuction.connect(borrower).acceptLoan(0);

    // Record balances before repayment
    const protocolFeeBalanceBefore = await nftLendAuction.protocolFeeBalance();
    const lenderBalanceBefore = await ethers.provider.getBalance(lender1.address);
    const borrowerBalanceBefore = await ethers.provider.getBalance(borrower.address);

    // Borrower repays loan
    const tx = await nftLendAuction.connect(borrower).repayLoan(0, { value: requiredRepayment });
    const receipt = await tx.wait();

    // Calculate gas cost
    const gasUsed = receipt.gasUsed;
    const gasPrice = tx.effectiveGasPrice || tx.gasPrice; // Compatibility with networks
    const gasCost = gasUsed.mul(gasPrice);

    // Record balances after repayment
    const protocolFeeBalanceAfter = await nftLendAuction.protocolFeeBalance();
    const lenderBalanceAfter = await ethers.provider.getBalance(lender1.address);
    const borrowerBalanceAfter = await ethers.provider.getBalance(borrower.address);

    // Validate protocol fee balance update
    const totalFees = borrowerProtocolFee.add(lenderProtocolFee);
    expect(protocolFeeBalanceAfter.sub(protocolFeeBalanceBefore)).to.equal(totalFees);

    // Validate lender payout
    expect(lenderBalanceAfter.sub(lenderBalanceBefore)).to.equal(lenderPayout);

    // Validate borrower's balance after repayment (subtracting gas cost)
    const borrowerSpent = requiredRepayment.add(gasCost);
    expect(borrowerBalanceBefore.sub(borrowerBalanceAfter)).to.equal(borrowerSpent);

    // Validate NFT ownership returned to borrower
    expect(await nftContract.ownerOf(1)).to.equal(borrower.address);
  });




  it("should allow the owner to update the protocol fee rate", async function () {
    const newFeeRate = 300; // 3%
    await nftLendAuction.connect(owner).setProtocolFeeRate(newFeeRate);

    const updatedFeeRate = await nftLendAuction.protocolFeeRate();
    expect(updatedFeeRate).to.equal(newFeeRate);
  });

  it("should prevent non-owners from updating the protocol fee rate", async function () {
    await expect(
      nftLendAuction.connect(borrower).setProtocolFeeRate(300)
    ).to.be.revertedWithCustomError(nftLendAuction, "AccessControlUnauthorizedAccount");
  });


  it("should allow the owner to withdraw accumulated protocol fees", async function () {
    const ownerBalanceBefore = await ethers.provider.getBalance(owner.address);
    const protocolFeeBalance = await nftLendAuction.protocolFeeBalance();

    const tx = await nftLendAuction.connect(owner).withdrawProtocolFees(owner.address);
    const receipt = await tx.wait();
    const gasCost = receipt.gasUsed.mul(receipt.effectiveGasPrice);

    const ownerBalanceAfter = await ethers.provider.getBalance(owner.address);

    expect(ownerBalanceAfter).to.equal(
        ownerBalanceBefore.add(protocolFeeBalance).sub(gasCost)
    ); // Account for gas costs
  });


  it("should prevent non-owners from withdrawing protocol fees", async function () {
    await expect(
      nftLendAuction.connect(borrower).withdrawProtocolFees(borrower.address)
    ).to.be.revertedWithCustomError(nftLendAuction, "AccessControlUnauthorizedAccount");
  });

  
});
