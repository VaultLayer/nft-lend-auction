import { ethereum, BigInt, Bytes, BigDecimal, log } from "@graphprotocol/graph-ts";
import { LoanListed, LoanAccepted, LoanRepaid, LoanDefaulted, LoanBidPlaced, LoanBidCancelled, LoanDelisted, PendingWithdrawalAdded, FundsWithdrawn } from "../generated/NFTLendAuctionV1/NFTLendAuctionV1";
import { Loan, User } from "../generated/schema";


export function handleRawLoanListed(event: ethereum.Event): void {
  let loan = Loan.load('1'); // Mock loan ID
  if (!loan) {
    loan = new Loan('1'); // Create new mock Loan entity
  }

  loan.borrower = "0xd6eef6a4ceb9270776d6b388cfaba62f5bc3357f"; // Mock borrower address
  loan.nftAddress = Bytes.fromHexString("0xcc89552ff8dafd016c91b7694dc0b69e23f2479d"); // Mock NFT contract address
  loan.tokenId = BigInt.fromString("24100"); // Mock NFT token ID
  loan.loanAmount = BigDecimal.fromString("10.0"); // Mock loan amount (10 tokens)
  loan.maxInterestRate = BigDecimal.fromString("0.08"); // Mock max interest rate (8%)
  loan.duration = BigInt.fromString("172800"); // Mock duration (2 days in seconds)
  loan.startTime = BigInt.fromString("0"); // Loan not started yet
  loan.isAccepted = false; // Loan not accepted yet
  loan.loanType = "FIXED"; // Mock loan type
  loan.status = "New"; // Status set to 'New'
  loan.save();

  // Mock User entity
  let user = User.load("0xd6eef6a4ceb9270776d6b388cfaba62f5bc3357f");
  if (!user) {
    user = new User("0xd6eef6a4ceb9270776d6b388cfaba62f5bc3357f");
    user.save();
  }

}


export function handleLoanListed(event: LoanListed): void {
  let loan = new Loan(event.params.loanId.toString());
  loan.borrower = event.params.borrower.toHexString();
  loan.nftAddress = event.params.nftAddress;
  loan.tokenId = event.params.tokenId;
  loan.loanAmount = event.params.loanAmount.toBigDecimal();
  loan.maxInterestRate = event.params.maxInterestRate.toBigDecimal();
  loan.duration = event.params.duration;
  loan.startTime = new BigInt(0); // Default to 0
  loan.isAccepted = false;
  loan.loanType = event.params.loanType == 0 ? "FIXED" : "APR";
  loan.status = "New";
  loan.save();

  let user = User.load(event.params.borrower.toHexString());
  if (!user) {
    user = new User(event.params.borrower.toHexString());
    user.save();
  }
}

export function handleLoanAccepted(event: LoanAccepted): void {
  let loan = Loan.load(event.params.loanId.toString());
  if (loan) {
    loan.lender = event.params.lender.toHexString();
    loan.startTime = event.params.startTime;
    loan.isAccepted = true;
    loan.status = "Accepted";
    loan.save();

    let user = User.load(event.params.lender.toHexString());
    if (!user) {
      user = new User(event.params.lender.toHexString());
      user.save();
    }
  }
}

export function handleLoanRepaid(event: LoanRepaid): void {
  let loan = Loan.load(event.params.loanId.toString());
  if (loan) {
    loan.status = "Repaid";
    loan.save();
  }
}

export function handleLoanDefaulted(event: LoanDefaulted): void {
  let loan = Loan.load(event.params.loanId.toString());
  if (loan) {
    loan.status = "Defaulted";
    loan.save();
  }
}

export function handleLoanBidPlaced(event: LoanBidPlaced): void {
  let loan = Loan.load(event.params.loanId.toString());
  if (loan) {
    loan.currentInterestRate = event.params.currentInterestRate.toBigDecimal();
    loan.lender = event.params.lender.toHexString();
    loan.save();

    let user = User.load(event.params.lender.toHexString());
    if (!user) {
      user = new User(event.params.lender.toHexString());
      user.save();
    }
  }
}

export function handleLoanBidCancelled(event: LoanBidCancelled): void {
  let loan = Loan.load(event.params.loanId.toString());
  if (loan) {
    loan.currentInterestRate = loan.maxInterestRate;
    loan.lender = null;
    loan.save();
  }
}

export function handleLoanDelisted(event: LoanDelisted): void {
  let loan = Loan.load(event.params.loanId.toString());
  if (loan) {
    loan.status = "Delisted";
    loan.save();
  }
}

export function handlePendingWithdrawalAdded(event: PendingWithdrawalAdded): void {
  let user = User.load(event.params.recipient.toHexString());
  if (!user) {
    user = new User(event.params.recipient.toHexString());
    user.totalWithdrawn = BigDecimal.fromString("0");
    user.pendingWithdraw = BigDecimal.fromString("0");
  }
  user.pendingWithdraw = user.pendingWithdraw.plus(event.params.amount.toBigDecimal());
  user.save();
}


export function handleFundsWithdrawn(event: FundsWithdrawn): void {
  let user = User.load(event.params.user.toHexString());
  if (user) {
    user.totalWithdrawn = user.totalWithdrawn.plus(event.params.amount.toBigDecimal());
    user.pendingWithdraw = user.pendingWithdraw.minus(event.params.amount.toBigDecimal());
    user.save();
  }
}
