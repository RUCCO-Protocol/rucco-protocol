/**
 * RUCCO Protocol Foundation - Educational Example
 * 
 * Basic Token-2022 Creation with Transfer Fee Extension
 * 
 * ⚠️ EDUCATIONAL PURPOSE ONLY ⚠️
 * This code is provided for learning purposes only.
 * Always test thoroughly in development environments.
 * Refer to official Solana documentation for production use.
 * 
 * This example is not affiliated with any commercial token implementations.
 */

import {
  Connection,
  Keypair,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';

import {
  TOKEN_2022_PROGRAM_ID,
  createInitializeMintInstruction,
  createInitializeTransferFeeConfigInstruction,
  getMintLen,
  ExtensionType,
} from '@solana/spl-token';

/**
 * Educational example: Create a Token-2022 mint with Transfer Fee extension
 * 
 * This demonstrates the basic pattern for creating tokens with automatic
 * fee collection capabilities using Solana's Token-2022 program.
 */
async function createTokenWithTransferFee() {
  // ⚠️ DEVELOPMENT ONLY - Use your own RPC endpoint
  const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
  
  // Generate keypairs for this example
  const payer = Keypair.generate();
  const mint = Keypair.generate();
  const mintAuthority = Keypair.generate();
  const transferFeeConfigAuthority = Keypair.generate();
  const withdrawWithheldAuthority = Keypair.generate();
  
  console.log('🏗️  Creating Token-2022 mint with Transfer Fee extension...');
  console.log('Mint address:', mint.publicKey.toBase58());
  
  try {
    // Step 1: Fund the payer account (devnet only)
    console.log('💰 Requesting devnet SOL...');
    const airdropSignature = await connection.requestAirdrop(
      payer.publicKey,
      2 * LAMPORTS_PER_SOL
    );
    await connection.confirmTransaction(airdropSignature);
    
    // Step 2: Calculate required space for mint account with extensions
    const extensions = [ExtensionType.TransferFeeConfig];
    const mintLen = getMintLen(extensions);
    const mintLamports = await connection.getMinimumBalanceForRentExemption(mintLen);
    
    console.log('📏 Mint account space required:', mintLen, 'bytes');
    
    // Step 3: Configure transfer fee parameters
    const transferFeeConfig = {
      transferFeeBasisPoints: 100,    // 1% fee (100 basis points)
      maximumFee: BigInt(1000000),    // Maximum 1 token fee (assuming 6 decimals)
    };
    
    console.log('💸 Transfer fee:', transferFeeConfig.transferFeeBasisPoints / 100, '%');
    console.log('💸 Maximum fee:', transferFeeConfig.maximumFee.toString(), 'units');
    
    // Step 4: Build transaction with all required instructions
    const transaction = new Transaction();
    
    // Create mint account
    transaction.add(
      SystemProgram.createAccount({
        fromPubkey: payer.publicKey,
        newAccountPubkey: mint.publicKey,
        space: mintLen,
        lamports: mintLamports,
        programId: TOKEN_2022_PROGRAM_ID,
      })
    );
    
    // Initialize transfer fee configuration (must be done before mint initialization)
    transaction.add(
      createInitializeTransferFeeConfigInstruction(
        mint.publicKey,
        transferFeeConfigAuthority.publicKey,
        withdrawWithheldAuthority.publicKey,
        transferFeeConfig.transferFeeBasisPoints,
        transferFeeConfig.maximumFee,
        TOKEN_2022_PROGRAM_ID
      )
    );
    
    // Initialize mint
    transaction.add(
      createInitializeMintInstruction(
        mint.publicKey,
        6,                          // decimals
        mintAuthority.publicKey,    // mint authority
        null,                       // freeze authority (disabled)
        TOKEN_2022_PROGRAM_ID
      )
    );
    
    // Step 5: Send transaction
    console.log('📡 Sending transaction...');
    const signature = await sendAndConfirmTransaction(
      connection,
      transaction,
      [payer, mint], // Required signers
      {
        commitment: 'confirmed',
      }
    );
    
    console.log('✅ Token created successfully!');
    console.log('🔗 Transaction signature:', signature);
    console.log('🏷️  Mint address:', mint.publicKey.toBase58());
    console.log('🔑 Mint authority:', mintAuthority.publicKey.toBase58());
    console.log('⚙️  Transfer fee authority:', transferFeeConfigAuthority.publicKey.toBase58());
    console.log('💰 Withdraw authority:', withdrawWithheldAuthority.publicKey.toBase58());
    
    return {
      mint: mint.publicKey,
      mintAuthority: mintAuthority.publicKey,
      transferFeeConfigAuthority: transferFeeConfigAuthority.publicKey,
      withdrawWithheldAuthority: withdrawWithheldAuthority.publicKey,
      signature,
    };
    
  } catch (error) {
    console.error('❌ Error creating token:', error);
    
    // Common error handling
    if (error.message.includes('insufficient funds')) {
      console.log('💡 Tip: Ensure the payer account has sufficient SOL');
    }
    
    if (error.message.includes('InvalidAccountOwner')) {
      console.log('💡 Tip: Ensure you are using TOKEN_2022_PROGRAM_ID');
    }
    
    throw error;
  }
}

/**
 * Educational helper: Validate fee configuration
 * 
 * This function demonstrates proper validation of fee parameters
 * before attempting to create a token.
 */
function validateFeeConfiguration(basisPoints, maxFee) {
  console.log('🔍 Validating fee configuration...');
  
  // Basis points must be between 0 and 10000 (0% to 100%)
  if (basisPoints < 0 || basisPoints > 10000) {
    throw new Error(`Invalid basis points: ${basisPoints}. Must be between 0 and 10000.`);
  }
  
  // Maximum fee must be non-negative
  if (maxFee < 0) {
    throw new Error(`Invalid maximum fee: ${maxFee}. Must be non-negative.`);
  }
  
  // Log warnings for extreme values
  if (basisPoints > 1000) { // More than 10%
    console.warn('⚠️  Warning: High transfer fee may impact token adoption');
  }
  
  if (basisPoints === 0) {
    console.log('ℹ️  Info: Zero transfer fee - fees disabled');
  }
  
  console.log('✅ Fee configuration valid');
  return true;
}

/**
 * Educational main function
 * Demonstrates the complete token creation process
 */
async function main() {
  console.log('🎓 RUCCO Protocol Foundation - Educational Example');
  console.log('📚 Token-2022 Creation with Transfer Fee Extension');
  console.log('⚠️  Educational purposes only - not for production use');
  console.log('');
  
  try {
    // Validate configuration before proceeding
    validateFeeConfiguration(100, BigInt(1000000));
    
    // Create the token
    const result = await createTokenWithTransferFee();
    
    console.log('');
    console.log('🎉 Example completed successfully!');
    console.log('📖 Next steps: Explore token transfers and fee collection');
    console.log('📚 See documentation for more integration patterns');
    
  } catch (error) {
    console.error('💥 Example failed:', error.message);
    console.log('📚 Check the documentation for troubleshooting tips');
  }
}

// Export for use in other educational examples
export {
  createTokenWithTransferFee,
  validateFeeConfiguration,
};

// Run example if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

/**
 * 📚 EDUCATIONAL NOTES:
 * 
 * 1. Extension Order: Transfer fee configuration must be initialized 
 *    before the mint initialization instruction.
 * 
 * 2. Authority Management: Consider using multisig for production 
 *    authorities to enhance security.
 * 
 * 3. Fee Collection: Fees are automatically collected on transfers.
 *    Use withdrawWithheldTokensFromMint to collect accumulated fees.
 * 
 * 4. Space Calculation: Token-2022 requires additional space for 
 *    extensions. Always use getMintLen() for accurate calculations.
 * 
 * 5. Error Handling: Always implement proper error handling for 
 *    production applications.
 * 
 * 🔗 Additional Resources:
 * - Solana Token-2022 Documentation: https://spl.solana.com/token-2022
 * - Transfer Fee Extension Guide: https://spl.solana.com/token-2022/extensions#transfer-fee
 * - RUCCO Protocol Documentation: https://github.com/ruccoprotocol/ruccoprotocol
 * 
 * ⚠️ DISCLAIMER:
 * This code is provided for educational purposes only. Always test 
 * thoroughly in development environments and refer to official Solana 
 * documentation for production implementations.
 */
