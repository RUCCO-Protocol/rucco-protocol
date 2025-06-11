# Token-2022 Integration Guide

## Overview

This document provides integration patterns for Solana's Token-2022 program, focusing on Transfer Fee and Metadata extensions for decentralized coordination use cases.

## Prerequisites

### Required Dependencies

```json
{
  "@solana/web3.js": "^1.87.0",
  "@solana/spl-token": "^0.3.9"
}
```

### Network Requirements

- Solana RPC endpoint with Token-2022 support
- Minimum Solana CLI version 1.16+
- Node.js 16+ for development

## Basic Setup

### Connection and Program ID

```javascript
import { Connection, PublicKey } from '@solana/web3.js';
import { TOKEN_2022_PROGRAM_ID } from '@solana/spl-token';

const connection = new Connection('https://api.mainnet-beta.solana.com');

// Token-2022 Program ID
const TOKEN_PROGRAM_ID = TOKEN_2022_PROGRAM_ID;
// TPkAHBxTTWEhzxPWGHy9T7jd1TWhWCnJfx7J8M8WNWbC (mainnet)
```

### Verify Token-2022 Availability

```javascript
async function verifyToken2022Support(connection) {
  try {
    const programInfo = await connection.getAccountInfo(TOKEN_2022_PROGRAM_ID);
    if (!programInfo) {
      throw new Error('Token-2022 program not available on this network');
    }
    return true;
  } catch (error) {
    console.error('Token-2022 verification failed:', error);
    return false;
  }
}
```

## Transfer Fee Extension

### Extension Configuration

```javascript
import { 
  ExtensionType,
  createInitializeTransferFeeConfigInstruction,
  getMintLen
} from '@solana/spl-token';

async function setupTransferFeeExtension(
  connection,
  payer,
  mint,
  transferFeeConfigAuthority,
  withdrawWithheldAuthority,
  transferFeeBasisPoints,
  maxFee
) {
  // Initialize transfer fee configuration
  const instruction = createInitializeTransferFeeConfigInstruction(
    mint.publicKey,
    transferFeeConfigAuthority,
    withdrawWithheldAuthority,
    transferFeeBasisPoints,  // 0-10000 (0% to 100%)
    maxFee,                 // Maximum fee in token units
    TOKEN_2022_PROGRAM_ID
  );
  
  return instruction;
}
```

### Fee Parameters

```javascript
// Example fee configurations
const feeConfigs = {
  // 1% fee with 1000 token maximum
  standard: {
    basisPoints: 100,
    maxFee: BigInt(1000 * Math.pow(10, 6)) // Assuming 6 decimals
  },
  
  // 0.5% fee with 500 token maximum  
  reduced: {
    basisPoints: 50,
    maxFee: BigInt(500 * Math.pow(10, 6))
  },
  
  // 0.1% fee with no maximum (set to very high value)
  minimal: {
    basisPoints: 10,
    maxFee: BigInt(Number.MAX_SAFE_INTEGER)
  }
};
```

### Reading Fee Information

```javascript
import { getMint, getTransferFeeConfig } from '@solana/spl-token';

async function getTokenFeeInfo(connection, mintAddress) {
  try {
    const mintInfo = await getMint(
      connection, 
      mintAddress, 
      'confirmed', 
      TOKEN_2022_PROGRAM_ID
    );
    
    const transferFeeConfig = getTransferFeeConfig(mintInfo);
    
    if (transferFeeConfig) {
      return {
        transferFeeBasisPoints: transferFeeConfig.transferFeeBasisPoints,
        maxFee: transferFeeConfig.maximumFee,
        authority: transferFeeConfig.transferFeeConfigAuthority
      };
    }
    
    return null; // No transfer fee configured
  } catch (error) {
    console.error('Error reading fee info:', error);
    throw error;
  }
}
```

## Metadata Extension

### Metadata Pointer Setup

```javascript
import { createInitializeMetadataPointerInstruction } from '@solana/spl-token';

function createMetadataPointerInstruction(mint, authority, metadataAddress) {
  return createInitializeMetadataPointerInstruction(
    mint,
    authority,
    metadataAddress, // Can be mint address itself for self-hosted metadata
    TOKEN_2022_PROGRAM_ID
  );
}
```

### Metadata Structure

```javascript
// Standard metadata format
const tokenMetadata = {
  name: "Community Token",
  symbol: "COMM", 
  description: "Token for community coordination",
  image: "https://example.com/token-image.png",
  external_url: "https://example.com",
  attributes: [
    {
      trait_type: "Type",
      value: "Coordination"
    },
    {
      trait_type: "Version", 
      value: "1.0"
    }
  ]
};
```

### Reading Metadata

```javascript
async function getTokenMetadata(connection, mintAddress) {
  try {
    const mintInfo = await getMint(
      connection,
      mintAddress, 
      'confirmed',
      TOKEN_2022_PROGRAM_ID
    );
    
    // Check if metadata pointer extension exists
    const metadataPointer = getExtension(
      mintInfo, 
      ExtensionType.MetadataPointer
    );
    
    if (metadataPointer && metadataPointer.metadataAddress) {
      // Fetch metadata from the specified address
      // Implementation depends on metadata storage method
      return metadataPointer.metadataAddress;
    }
    
    return null;
  } catch (error) {
    console.error('Error reading metadata:', error);
    return null;
  }
}
```

## Complete Token Creation Pattern

### Full Token Setup with Extensions

```javascript
import { 
  Keypair, 
  SystemProgram, 
  Transaction
} from '@solana/web3.js';
import { 
  createInitializeMintInstruction,
  createMintToInstruction,
  getMintLen,
  ExtensionType
} from '@solana/spl-token';

async function createTokenWithExtensions(
  connection,
  payer,
  decimals = 6,
  feeConfig = null,
  metadataConfig = null
) {
  const mint = Keypair.generate();
  
  // Determine required extensions
  const extensions = [];
  if (feeConfig) extensions.push(ExtensionType.TransferFeeConfig);
  if (metadataConfig) extensions.push(ExtensionType.MetadataPointer);
  
  // Calculate required space
  const mintLen = getMintLen(extensions);
  const mintLamports = await connection.getMinimumBalanceForRentExemption(mintLen);
  
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
  
  // Add extension initialization instructions
  if (feeConfig) {
    transaction.add(
      createInitializeTransferFeeConfigInstruction(
        mint.publicKey,
        feeConfig.transferFeeConfigAuthority,
        feeConfig.withdrawWithheldAuthority, 
        feeConfig.transferFeeBasisPoints,
        feeConfig.maximumFee,
        TOKEN_2022_PROGRAM_ID
      )
    );
  }
  
  if (metadataConfig) {
    transaction.add(
      createInitializeMetadataPointerInstruction(
        mint.publicKey,
        metadataConfig.authority,
        metadataConfig.metadataAddress,
        TOKEN_2022_PROGRAM_ID
      )
    );
  }
  
  // Initialize mint
  transaction.add(
    createInitializeMintInstruction(
      mint.publicKey,
      decimals,
      payer.publicKey, // mint authority
      null,           // freeze authority
      TOKEN_2022_PROGRAM_ID
    )
  );
  
  return { mint, transaction };
}
```

## Transfer Operations

### Standard Transfer with Fees

```javascript
import { 
  createTransferInstruction,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction
} from '@solana/spl-token';

async function transferWithFees(
  connection,
  payer,
  mint,
  source,
  destination, 
  amount,
  authority
) {
  const transaction = new Transaction();
  
  // Get or create destination token account
  const destinationTokenAccount = await getAssociatedTokenAddress(
    mint,
    destination,
    false,
    TOKEN_2022_PROGRAM_ID
  );
  
  // Check if destination account exists
  const destinationInfo = await connection.getAccountInfo(destinationTokenAccount);
  if (!destinationInfo) {
    transaction.add(
      createAssociatedTokenAccountInstruction(
        payer.publicKey,
        destinationTokenAccount,
        destination,
        mint,
        TOKEN_2022_PROGRAM_ID
      )
    );
  }
  
  // Add transfer instruction (fees collected automatically)
  transaction.add(
    createTransferInstruction(
      source,
      destinationTokenAccount,
      authority.publicKey,
      amount,
      [],
      TOKEN_2022_PROGRAM_ID
    )
  );
  
  return transaction;
}
```

## Fee Management

### Collecting Withheld Fees

```javascript
import { 
  getTransferFeeAmount,
  createWithdrawWithheldTokensFromMintInstruction
} from '@solana/spl-token';

async function withdrawCollectedFees(
  connection,
  mint,
  destination,
  authority
) {
  // Check collected fee amount
  const mintInfo = await getMint(connection, mint, 'confirmed', TOKEN_2022_PROGRAM_ID);
  const transferFeeAmount = getTransferFeeAmount(mintInfo);
  
  if (!transferFeeAmount || transferFeeAmount.withheldAmount === BigInt(0)) {
    throw new Error('No fees available for withdrawal');
  }
  
  // Create withdrawal instruction
  const instruction = createWithdrawWithheldTokensFromMintInstruction(
    mint,
    destination,
    authority.publicKey,
    [],
    TOKEN_2022_PROGRAM_ID
  );
  
  const transaction = new Transaction().add(instruction);
  
  return {
    transaction,
    amount: transferFeeAmount.withheldAmount
  };
}
```

### Fee Rate Updates

```javascript
import { createSetTransferFeeInstruction } from '@solana/spl-token';

async function updateTransferFee(
  mint,
  authority,
  newTransferFeeBasisPoints,
  newMaximumFee
) {
  const instruction = createSetTransferFeeInstruction(
    mint,
    authority.publicKey,
    newTransferFeeBasisPoints,
    newMaximumFee,
    [],
    TOKEN_2022_PROGRAM_ID
  );
  
  return new Transaction().add(instruction);
}
```

## Error Handling

### Common Integration Issues

```javascript
async function handleToken2022Errors(operation) {
  try {
    return await operation();
  } catch (error) {
    // Common error patterns
    if (error.message.includes('InvalidAccountOwner')) {
      throw new Error('Account is not owned by Token-2022 program');
    }
    
    if (error.message.includes('ExtensionNotFound')) {
      throw new Error('Required extension not configured on token');
    }
    
    if (error.message.includes('InsufficientFunds')) {
      throw new Error('Insufficient token balance for transfer');
    }
    
    if (error.message.includes('IncorrectProgramId')) {
      throw new Error('Must use Token-2022 program ID for this token');
    }
    
    // Re-throw unknown errors
    throw error;
  }
}
```

### Validation Helpers

```javascript
function validateFeeParameters(basisPoints, maxFee) {
  if (basisPoints < 0 || basisPoints > 10000) {
    throw new Error('Transfer fee basis points must be between 0 and 10000');
  }
  
  if (maxFee < 0) {
    throw new Error('Maximum fee must be non-negative');
  }
}

function validateTokenAccount(accountInfo, expectedMint) {
  if (!accountInfo) {
    throw new Error('Token account does not exist');
  }
  
  // Additional validation logic as needed
}
```

## Integration Checklist

### Pre-Integration Verification

- [ ] Verify Token-2022 program availability on target network
- [ ] Confirm RPC endpoint supports Token-2022 operations  
- [ ] Test extension configuration in development environment
- [ ] Validate fee parameters and authorities setup
- [ ] Test metadata pointer configuration if using metadata

### Runtime Considerations

- [ ] Handle Token-2022 specific errors appropriately
- [ ] Validate token accounts are Token-2022 compatible
- [ ] Account for fee deduction in transfer amount calculations
- [ ] Implement proper authority management for fee operations
- [ ] Monitor collected fees and withdrawal operations

### Security Best Practices

- [ ] Use multisig for critical authorities when possible
- [ ] Implement proper key management for fee authorities
- [ ] Validate all user inputs and transaction parameters
- [ ] Test thoroughly in development before mainnet deployment
- [ ] Keep authority keys secure and implement rotation procedures

## Limitations and Considerations

### Token-2022 Capabilities
- Automatic fee collection on transfers
- On-chain metadata pointer storage
- Extension configuration management
- Authority-based permission system

### External Implementation Required
- Fee redistribution mechanisms
- Governance systems for fee rate changes
- Complex business logic beyond basic transfers
- User interface for fee management
- Treasury management beyond basic multisig

### Network Dependencies
- Requires recent Solana RPC versions
- Token-2022 program must be deployed on target network
- Higher transaction costs due to additional account space
- Some wallets may not fully support Token-2022 features

---

**⚠️ Integration Note:** Token-2022 is an evolving program. Always test integrations thoroughly and refer to the latest Solana documentation for current API details and best practices.

**🔗 Official Resources:**
- [Solana Token-2022 Documentation](https://spl.solana.com/token-2022)
- [SPL Token Program Source](https://github.com/solana-labs/solana-program-library)
- [Solana Web3.js Documentation](https://solana-labs.github.io/solana-web3.js/)
