import { ethers } from "ethers";
import NFTLendAuction from "../contracts/NFTLendAuction.json";

export function getContract(signerOrProvider: ethers.Signer | ethers.providers.Provider) {
  const contractAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS!;
  const abi = NFTLendAuction.abi;

  return new ethers.Contract(contractAddress, abi, signerOrProvider);
}
