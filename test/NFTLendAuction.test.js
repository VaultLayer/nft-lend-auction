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
    ).to.be.revertedWithCustomError(nftLendAuction, "OwnableUnauthorizedAccount").withArgs(borrower.address);
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
      .listLoan(nftContract.address, 1, loanAmount, 1000, 604800); // 1 week

    // Lender places a bid
    await nftLendAuction.connect(lender1).placeBid(0, 800, { value: loanAmount });

    // Track balances before acceptance
    const borrowerBalanceBefore = await ethers.provider.getBalance(borrower.address);
    const contractBalanceBefore = await ethers.provider.getBalance(nftLendAuction.address);

    // Borrower accepts the loan
    await nftLendAuction.connect(borrower).acceptLoan(0);
    const loan = await nftLendAuction.loans(0);
    expect(loan.isAccepted).to.equal(true);

    // Validate fund transfer
    const borrowerBalanceAfter = await ethers.provider.getBalance(borrower.address);
    const contractBalanceAfter = await ethers.provider.getBalance(nftLendAuction.address);

    expect(borrowerBalanceAfter).to.be.above(borrowerBalanceBefore); // Borrower receives funds
    expect(contractBalanceAfter).to.equal(contractBalanceBefore.sub(loanAmount)); // Escrow amount is released
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
    ).to.be.revertedWith("Only the lender can cancel the bid");
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
    const repaymentAmount = ethers.utils.parseEther("10.8"); // Loan + 8% interest

    await nftContract.connect(borrower).approve(nftLendAuction.address, 1);
    await nftLendAuction
      .connect(borrower)
      .listLoan(nftContract.address, 1, loanAmount, 1000, 604800); // 1 week

    await nftLendAuction.connect(lender1).placeBid(0, 800, { value: loanAmount });
    await nftLendAuction.connect(borrower).acceptLoan(0);

    // Track lender balance before repayment
    const lenderBalanceBefore = await ethers.provider.getBalance(lender1.address);

    // Borrower repays the loan
    await nftLendAuction.connect(borrower).repayLoan(0, { value: repaymentAmount });

    // Validate repayment to the lender
    const lenderBalanceAfter = await ethers.provider.getBalance(lender1.address);
    expect(lenderBalanceAfter).to.be.above(lenderBalanceBefore);

    // Validate NFT ownership returns to borrower
    expect(await nftContract.ownerOf(1)).to.equal(borrower.address);
  });

  it("should allow repayment of a loan", async function () {
    await nftContract.connect(borrower).approve(nftLendAuction.address, 1);
    await nftLendAuction
      .connect(borrower)
      .listLoan(nftContract.address, 1, ethers.utils.parseEther("10"), 1000, 604800); // 1 week

    await nftLendAuction
      .connect(lender1)
      .placeBid(0, 800, { value: ethers.utils.parseEther("10") });

    await nftLendAuction.connect(borrower).acceptLoan(0);

    const repaymentAmount = ethers.utils.parseEther("10.8"); // Includes interest
    await nftLendAuction.connect(borrower).repayLoan(0, { value: repaymentAmount });

    const loan = await nftLendAuction.loans(0);
    expect(loan.isAccepted).to.equal(false);
    expect(await nftContract.ownerOf(1)).to.equal(borrower.address);
  });

  it("should allow the lender to claim collateral on default", async function () {
    await nftContract.connect(borrower).approve(nftLendAuction.address, 1);
    await nftLendAuction
      .connect(borrower)
      .listLoan(nftContract.address, 1, ethers.utils.parseEther("10"), 1000, 2); // 2 seconds duration

    await nftLendAuction
      .connect(lender1)
      .placeBid(0, 800, { value: ethers.utils.parseEther("10") });

    await nftLendAuction.connect(borrower).acceptLoan(0);

    // Wait for loan duration to expire
    await ethers.provider.send("evm_increaseTime", [3]);
    await ethers.provider.send("evm_mine", []);

    // Lender claims collateral
    await nftLendAuction.connect(lender1).claimDefaultedLoan(0);

    const loan = await nftLendAuction.loans(0);
    expect(loan.isAccepted).to.equal(false);
    expect(await nftContract.ownerOf(1)).to.equal(lender1.address);
  });

  it("should correctly track active loans", async function () {
    // Approve and list two loans
    await nftContract.connect(borrower).approve(nftLendAuction.address, 1);
    await nftContract.connect(borrower).mint(); // Mint a second NFT for the borrower
    await nftContract.connect(borrower).approve(nftLendAuction.address, 2);
  
    await nftLendAuction
      .connect(borrower)
      .listLoan(nftContract.address, 1, ethers.utils.parseEther("10"), 1000, 604800); // 1 week
  
    await nftLendAuction
      .connect(borrower)
      .listLoan(nftContract.address, 2, ethers.utils.parseEther("20"), 1000, 604800); // 1 week
  
    // Fetch active loans
    let activeLoans = await nftLendAuction.getActiveLoans();
    expect(activeLoans.map((id) => id.toNumber())).to.include.members([0, 1]);
  
    // Place a bid and accept the first loan
    await nftLendAuction
      .connect(lender1)
      .placeBid(0, 800, { value: ethers.utils.parseEther("10") });
  
    await nftLendAuction.connect(borrower).acceptLoan(0);
  
    // Repay the first loan
    const repaymentAmount = ethers.utils.parseEther("10.8"); // Loan + 8% interest
    await nftLendAuction.connect(borrower).repayLoan(0, { value: repaymentAmount });
  
    // Fetch active loans again
    activeLoans = await nftLendAuction.getActiveLoans();
    expect(activeLoans.map((id) => id.toNumber())).to.include.members([1]);
    expect(activeLoans.map((id) => id.toNumber())).to.not.include(0);
  
    // Place a bid and accept the second loan
    await nftLendAuction
      .connect(lender2)
      .placeBid(1, 900, { value: ethers.utils.parseEther("20") });
  
    await nftLendAuction.connect(borrower).acceptLoan(1);
  
    // Wait for the loan duration to expire and claim the second loan as defaulted
    await ethers.provider.send("evm_increaseTime", [604801]); // Fast forward 1 week + 1 second
    await ethers.provider.send("evm_mine", []);
  
    await nftLendAuction.connect(lender2).claimDefaultedLoan(1);
  
    // Fetch active loans one last time
    activeLoans = await nftLendAuction.getActiveLoans();
    expect(activeLoans.map((id) => id.toNumber())).to.be.empty;
  });
  
});
