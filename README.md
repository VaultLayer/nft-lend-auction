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

## Protocol Fees and Interest Calculations

This section explains how protocol fees and interest are calculated in the **NFT Lending Protocol**.

### Borrower Repayment Amount

The **borrower** is responsible for repaying the loan amount along with the interest. The repayment amount is calculated as:

```
Repayment Amount = Loan Amount + (Loan Amount × (Interest Rate / 10000))
```

- **Loan Amount:** The principal amount borrowed.
- **Interest Rate:** The interest rate agreed upon, expressed in **basis points (bps)**.

### Protocol Fee Deduction

A **protocol fee** is applied to the repayment amount and deducted from the amount sent to the lender. The protocol fee is calculated as:

```
Protocol Fee = Repayment Amount × (Protocol Fee Rate / 10000)
```

- **Protocol Fee Rate:** The fee rate charged by the protocol, expressed in **basis points (bps)**.

### Lender's Receivable Amount

The **lender** receives the repayment amount after deducting the protocol fee. This is calculated as:

```
Lender Receives = Repayment Amount - Protocol Fee
```

### Example Calculation

#### Given:
- **Loan Amount:** `10 CORE`
- **Interest Rate:** `800 bps` (8%)
- **Protocol Fee Rate:** `500 bps` (5%)

#### Steps:
1. **Calculate Repayment Amount:**
   ```
   Repayment Amount = 10 + (10 × 800 / 10000) = 10 + 0.8 = 10.8 CORE
   ```

2. **Calculate Protocol Fee:**
   ```
   Protocol Fee = 10.8 × 500 / 10000 = 10.8 × 0.05 = 0.54 CORE
   ```

3. **Calculate Lender's Receivable Amount:**
   ```
   Lender Receives = 10.8 - 0.54 = 10.26 CORE
   ```

### Summary of Calculations

| **Parameter**         | **Value**   |
|------------------------|-------------|
| Loan Amount           | `10 CORE`   |
| Interest Amount       | `0.8 CORE`  |
| Repayment Amount      | `10.8 CORE` |
| Protocol Fee          | `0.54 CORE` |
| Lender Receives       | `10.26 CORE` |


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
