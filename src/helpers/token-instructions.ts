import {
  AccountLayout,
  NATIVE_MINT,
  Token,
  TOKEN_PROGRAM_ID,
  u64,
} from "@solana/spl-token";
import { Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import { Instruction } from "../web3/transactions/types";

export type ResolvedTokenAddressInstruction = {
  address: PublicKey;
} & Instruction;

// TODO use native-mint instead
export function createWSOLAccountInstructions(
  walletAddress: PublicKey,
  amountIn: u64,
  rentExemptLamports: number
): ResolvedTokenAddressInstruction {
  const tempAccount = new Keypair();

  const createAccountInstruction = SystemProgram.createAccount({
    fromPubkey: walletAddress,
    newAccountPubkey: tempAccount.publicKey,
    lamports: amountIn.toNumber() + rentExemptLamports,
    space: AccountLayout.span,
    programId: TOKEN_PROGRAM_ID,
  });

  const initAccountInstruction = Token.createInitAccountInstruction(
    TOKEN_PROGRAM_ID,
    NATIVE_MINT,
    tempAccount.publicKey,
    walletAddress
  );

  const closeWSOLAccountInstruction = Token.createCloseAccountInstruction(
    TOKEN_PROGRAM_ID,
    tempAccount.publicKey,
    walletAddress,
    walletAddress,
    []
  );

  return {
    address: tempAccount.publicKey,
    instructions: [createAccountInstruction, initAccountInstruction],
    cleanupInstructions: [closeWSOLAccountInstruction],
    signers: [tempAccount],
  };
}
