# NFTLendAuction Smart Contract

This repository contains the NFTLendAuction smart contract, a decentralized lending platform where borrowers can list NFTs as collateral for loans, and lenders can bid by offering loans at competitive interest rates.

## Features
- Borrowers can list NFTs as collateral for loans.
- Lenders can bid by offering loans at lower interest rates.
- Borrowers can accept loans, locking in the terms.
- Lenders can cancel bids if the loan is not accepted.
- Borrowers can delist unaccepted loans, refunding escrowed funds to the lender.
- Lenders can claim NFT collateral if the borrower defaults.

## Contract Summary
- **Loan Struct**:
  - Stores loan details, including borrower, lender, NFT address, token ID, loan amount, interest rate, and duration.
- **Key Functions**:
  - `listLoan`: Allows a borrower to list an NFT for a loan.
  - `placeBid`: Allows a lender to offer a loan at a lower interest rate.
  - `acceptLoan`: Allows a borrower to accept a loan offer.
  - `repayLoan`: Allows a borrower to repay the loan and reclaim their NFT.
  - `cancelBid`: Allows lenders to cancel their bids for unaccepted loans.
  - `delistLoan`: Allows borrowers to delist their loans and refund escrowed funds to lenders.

## Getting Started
### Prerequisites
- [Node.js](https://nodejs.org/) and npm
- [Hardhat](https://hardhat.org/)
- Core Chain node endpoint (RPC URL)

### Setup
1. Install:
```bash
npm install
npm run test
```

## License

This project is licensed under the MIT License.
Copyright (c) 2024 VaultLayer
