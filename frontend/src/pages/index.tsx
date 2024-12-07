import React, { useEffect, useState } from "react";
import { ethers } from "ethers";
import {
    Container,
    Typography,
    Button,
    Tooltip,
    Box,
    Modal,
    TextField,
    Card,
    CardContent,
    CardActions,
} from "@mui/material";
import { getContract } from "../utils/contract";

type Loan = {
    id: number;
    nftAddress: string;
    tokenId: number;
    borrower: string;
    lender: string;
    loanAmount: string;
    maxInterestRate: string;
    currentInterestRate: string;
    duration: string;
    startTime: string; // Friendly start time
    endTime: string; // Friendly end time
    isAccepted: boolean;
};

const allowedNFTs = process.env.NEXT_PUBLIC_ALLOWED_NFTS?.split(",") || [];

export default function Home() {
    const [walletAddress, setWalletAddress] = useState<string | null>(null);
    const [signer, setSigner] = useState<ethers.Signer | null>(null);
    const [loans, setLoans] = useState<Loan[]>([]);
    const [newLoan, setNewLoan] = useState({
        nftAddress: "",
        tokenId: "",
        loanAmount: "",
        maxInterestRate: "",
        durationDays: "", // Input duration in days
    });
    const [openModal, setOpenModal] = useState(false);

    const fetchLoans = async () => {
        try {
            const provider = new ethers.providers.Web3Provider((window as any).ethereum);
            const contract = getContract(provider);
    
            // Fetch active loan IDs
            const activeLoanIds = await contract.getActiveLoans();
            console.log("Active Loan IDs:", activeLoanIds);
    
            const fetchedLoans: Loan[] = [];
    
            for (const id of activeLoanIds) {
                try {
                    // Fetch loan details for each active loan
                    const loan = await contract.loans(id);
    
                    const startTime = Number(loan.startTime);
                    const duration = Number(loan.duration);
    
                    const startTimeFormatted =
                        startTime > 0
                            ? new Date(startTime * 1000).toLocaleString()
                            : "Not Started";
    
                    const endTimeFormatted =
                        startTime > 0
                            ? new Date((startTime + duration) * 1000).toLocaleString()
                            : "N/A";
    
                    fetchedLoans.push({
                        id: id.toNumber(),
                        borrower: loan.borrower,
                        lender: loan.lender,
                        nftAddress: loan.nftAddress,
                        tokenId: Number(loan.tokenId),
                        loanAmount: ethers.utils.formatEther(loan.loanAmount),
                        maxInterestRate: (Number(loan.maxInterestRate) / 100).toFixed(1), // Convert bps to percentage
                        currentInterestRate: (Number(loan.currentInterestRate) / 100).toFixed(1), // Convert bps to percentage
                        duration: (duration / 86400).toFixed(1), // Convert seconds to days
                        startTime: startTimeFormatted,
                        endTime: endTimeFormatted,
                        isAccepted: loan.isAccepted, // Updated terminology
                    });
                } catch (error) {
                    console.warn(`Error fetching loan ID ${id.toNumber()}:`, error);
                }
            }
    
            setLoans(fetchedLoans);
        } catch (error) {
            console.error("Error fetching loans:", error);
        }
    };
    

    const connectWallet = async () => {
        try {
            const provider = new ethers.providers.Web3Provider((window as any).ethereum);
            await provider.send("eth_requestAccounts", []);
            const signer = provider.getSigner();
            const address = await signer.getAddress();
            setSigner(signer);
            setWalletAddress(address);
            fetchLoans();
        } catch (error) {
            console.error("Error connecting wallet:", error);
        }
    };

    const disconnectWallet = () => {
        setWalletAddress(null);
        setSigner(null);
        console.log("Wallet disconnected");
      };
      

    const handleListLoan = async () => {
        try {
            if (!signer) return;

            const contract = getContract(signer);
            const { nftAddress, tokenId, loanAmount, maxInterestRate, durationDays } = newLoan;

            if (!allowedNFTs.includes(nftAddress)) {
                alert("This NFT contract is not allowed.");
                return;
            }

            const nftContract = new ethers.Contract(
                nftAddress,
                [
                    "function getApproved(uint256 tokenId) public view returns (address)",
                    "function approve(address to, uint256 tokenId) public",
                ],
                signer
            );


            // Check if the token is already approved
            const approvedAddress = await nftContract.getApproved(tokenId);
            if (approvedAddress.toLowerCase() !== contract.address.toLowerCase()) {
                // Approve the token
                const approvalTx = await nftContract.approve(contract.address, tokenId);
                await approvalTx.wait();
                console.log(`NFT approved for loan listing (Token ID: ${tokenId})`);
            }


            const durationInSeconds = Number(durationDays) * 86400; // Convert days to seconds

            // Prepare transaction details
            const transactionData = {
                to: contract.address,
                data: contract.interface.encodeFunctionData("listLoan", [
                    nftAddress,
                    tokenId,
                    ethers.utils.parseEther(loanAmount),
                    Math.round(Number(maxInterestRate) * 100), // Convert percentage to bps
                    durationInSeconds,
                ]),
            };

            // Estimate gas
            let gasEstimate;
            try {
                gasEstimate = await signer.estimateGas(transactionData);
            } catch (error) {
                console.error("Gas estimation failed, using fallback gas limit:", error);
                gasEstimate = ethers.BigNumber.from("300000"); // Set a reasonable default gas limit
            }

            try {
                const tx = await signer.sendTransaction({
                    ...transactionData,
                    gasLimit: gasEstimate,
                });
                await tx.wait();
            } catch (error) {
                if (error.code === ethers.errors.CALL_EXCEPTION) {
                    console.error("Revert reason:", error.reason || error.data || "Unknown");
                } else {
                    console.error("Error:", error);
                }
            }

            setOpenModal(false);
            fetchLoans();
        } catch (error) {
            console.error("Error listing loan:", error);
        }
    };

    const handleDelistLoan = async (loanId: number) => {
        try {
            if (!signer) return;
            const contract = getContract(signer);
            const tx = await contract.delistLoan(loanId);
            await tx.wait();
            fetchLoans();
        } catch (error) {
            console.error("Error delisting loan:", error);
        }
    };

    const handleAcceptLoan = async (loanId: number) => {
        try {
            if (!signer) return;

            const contract = getContract(signer);
            const tx = await contract.acceptLoan(loanId);
            await tx.wait();

            fetchLoans();
        } catch (error) {
            console.error("Error accepting loan:", error);
        }
    };

    const handleRepayLoan = async (loanId: number) => {
        try {
            if (!signer) return;
    
            const contract = getContract(signer);
    
            // Fetch the loan details to calculate the repayment amount
            const loan = await contract.loans(loanId);
    
            const loanAmount = ethers.BigNumber.from(loan.loanAmount);
            const currentInterestRate = ethers.BigNumber.from(loan.currentInterestRate);
    
            // Calculate repayment amount: loanAmount + (loanAmount * currentInterestRate / 10000)
            const repaymentAmount = loanAmount.add(
                loanAmount.mul(currentInterestRate).div(10000)
            );
    
            console.log(`Repayment Amount for Loan ${loanId}:`, ethers.utils.formatEther(repaymentAmount));
    
            // Call repayLoan with the calculated amount
            const tx = await contract.repayLoan(loanId, {
                value: repaymentAmount,
            });
            await tx.wait();
    
            fetchLoans();
        } catch (error) {
            console.error("Error repaying loan:", error);
        }
    };
    

    const handlePlaceBid = async (loanId: number) => {
        try {
            if (!signer) return;
    
            const contract = getContract(signer);
    
            // Fetch the loan details to get the currentInterestRate
            const loan = await contract.loans(loanId);
    
            const currentInterestRate = Number(loan.currentInterestRate); // In bps
    
            // Calculate the new bid amount (1% lower, subtract 100 bps)
            const bidAmount = currentInterestRate - 100;
    
            if (bidAmount <= 0) {
                alert("Cannot place a bid lower than 0 bps.");
                return;
            }
    
            console.log(`Placing bid with interest rate: ${bidAmount / 100}%`);
    
            // Place the bid with the calculated bidAmount
            const tx = await contract.placeBid(loanId, bidAmount, {
                value: ethers.utils.parseEther(ethers.utils.formatEther(loan.loanAmount)),
            });
    
            await tx.wait();
    
            fetchLoans();
        } catch (error) {
            console.error("Error placing bid:", error);
        }
    };
    

    const handleCancelBid = async (loanId: number) => {
        try {
            if (!signer) return;
    
            const contract = getContract(signer);
    
            // Call the cancelBid function
            const tx = await contract.cancelBid(loanId);
            await tx.wait();
    
            console.log(`Bid for Loan ${loanId} successfully canceled`);
            fetchLoans();
        } catch (error) {
            console.error("Error canceling bid:", error);
        }
    };
    

    useEffect(() => {
        if (walletAddress) fetchLoans();
    }, [walletAddress]);

    return (
        <Container>
            <Typography variant="h4" gutterBottom>
                NFT Lend Auction
            </Typography>

            {!walletAddress ? (
                <Button variant="contained" onClick={connectWallet}>
                    Connect Wallet
                </Button>
            ) : (
                <Box>
                    <Typography>Wallet Connected: {walletAddress}</Typography>
                    <Button variant="outlined" color="error" onClick={disconnectWallet} sx={{ marginTop: 2 }}>
                    Disconnect Wallet
                    </Button>
                </Box>
            )}


            <Button variant="contained" onClick={() => setOpenModal(true)} sx={{ marginTop: 2 }}>
                List New Loan
            </Button>

            <Modal open={openModal} onClose={() => setOpenModal(false)}>
                <Box sx={{ padding: 4, backgroundColor: "white", margin: "auto", maxWidth: 400 }}>
                    <Typography variant="h6">List a New Loan</Typography>
                    <TextField
                        fullWidth
                        label="NFT Address"
                        margin="normal"
                        value={newLoan.nftAddress}
                        onChange={(e) => setNewLoan({ ...newLoan, nftAddress: e.target.value })}
                    />
                    <TextField
                        fullWidth
                        label="Token ID"
                        margin="normal"
                        value={newLoan.tokenId}
                        onChange={(e) => setNewLoan({ ...newLoan, tokenId: e.target.value })}
                    />
                    <TextField
                        fullWidth
                        label="Loan Amount ($CORE)"
                        margin="normal"
                        value={newLoan.loanAmount}
                        onChange={(e) => setNewLoan({ ...newLoan, loanAmount: e.target.value })}
                    />
                    <TextField
                        fullWidth
                        label="Max Interest Rate (%)"
                        margin="normal"
                        value={newLoan.maxInterestRate}
                        onChange={(e) => setNewLoan({ ...newLoan, maxInterestRate: e.target.value })}
                    />
                    <TextField
                        fullWidth
                        label="Duration (days)"
                        margin="normal"
                        value={newLoan.durationDays}
                        onChange={(e) => setNewLoan({ ...newLoan, durationDays: e.target.value })}
                    />
                    <Button variant="contained" onClick={handleListLoan} sx={{ marginTop: 2 }}>
                        Submit
                    </Button>
                </Box>
            </Modal>

            <Box sx={{ marginTop: 4 }}>
                {loans.map((loan) => (
                    <Card key={loan.id} sx={{ marginBottom: 2 }}>
                        <CardContent>
                            <Typography>Loan ID: {loan.id}</Typography>
                            <Typography>NFT Contract: {loan.nftAddress}</Typography>
                            <Typography>Token ID: {loan.tokenId}</Typography>
                            <Typography>Borrower: {loan.borrower}</Typography>
                            <Typography>Lender: {loan.lender || "None"}</Typography>
                            <Typography>Loan Amount: {loan.loanAmount} $CORE</Typography>
                            <Typography>Max Interest Rate: {loan.maxInterestRate}%</Typography>
                            <Typography>Current Interest Rate: {loan.currentInterestRate}%</Typography>
                            <Typography>Duration: {loan.duration} days</Typography>
                            <Typography>Start Time: {loan.startTime}</Typography>
                            <Typography>End Time: {loan.endTime}</Typography>
                            <Typography>Status: {loan.isAccepted ? "Accepted" : "Pending"}</Typography>
                        </CardContent>
                        <CardActions>
                            {loan.borrower.toLowerCase() === walletAddress?.toLowerCase() && !loan.isAccepted && (
                                <Button variant="contained" color="error" onClick={() => handleDelistLoan(loan.id)}>
                                    Delist Loan
                                </Button>
                            )}

                            {/* Show "Accept Loan" button for loans owned by the user with bids */}
                            {loan.borrower.toLowerCase() === walletAddress?.toLowerCase() && !loan.isAccepted && loan.lender && (
                                <Button variant="contained" onClick={() => handleAcceptLoan(loan.id)}>
                                    Accept Loan
                                </Button>
                            )}
                            {/* Show "Repay Loan" button for accepted loans owned by the user */}
                            {loan.borrower.toLowerCase() === walletAddress?.toLowerCase() && loan.isAccepted && (
                                <Button variant="contained" onClick={() => handleRepayLoan(loan.id)}>
                                    Repay Loan
                                </Button>
                            )}
                            {/* Show "Place Bid" button for loans not owned by the user and not yet accepted */}
                            {loan.borrower.toLowerCase() !== walletAddress?.toLowerCase() && !loan.isAccepted && (
                                <Tooltip title="Bid with a 1% lower interest rate than the current rate.">
                                    <Button
                                        variant="contained"
                                        onClick={() => handlePlaceBid(loan.id)}
                                    >
                                        Bid 1% Less Rate
                                    </Button>
                                </Tooltip>
                            )}
                            {loan.lender.toLowerCase() === walletAddress?.toLowerCase() && !loan.isAccepted && (
                                <Button variant="outlined" color="error" onClick={() => handleCancelBid(loan.id)}>
                                    Cancel Bid
                                </Button>
                            )}
                        </CardActions>
                    </Card>
                ))}
            </Box>

        </Container>
    );
}
