# Implementation Notes

## Token-2022 Extension Configuration

### Transfer Fee Extension Setup

Basic extension initialization pattern for automatic fee collection:

```javascript
import { 
  ExtensionType, 
  createInitializeTransferFeeConfigInstruction,
  getMintLen
} from '@solana/spl-token';

// Calculate required space for mint account
const extensions = [ExtensionType.TransferFeeConfig];
const mintLen = getMintLen(extensions);

// Initialize transfer fee configuration
const transferFeeConfigInstruction = createInitializeTransferFeeConfigInstruction(
  mint,
  transferFeeConfigAuthority,
  withdrawWithheldAuthority,
  transferFeeBasisPoints,    // 0-10000 (0-100%)
  maxFee,                   // Maximum fee in token units
  TOKEN_2022_PROGRAM_ID
);
```

### Metadata Extension Setup

On-chain metadata storage pattern:

```javascript
import { 
  createInitializeMetadataPointerInstruction,
  createInitializeInstruction
} from '@solana/spl-token';

// Point metadata to mint account itself
const metadataPointerInstruction = createInitializeMetadataPointerInstruction(
  mint,
  authority,
  mint,  // Store metadata in mint account
  TOKEN_2022_PROGRAM_ID
);

// Note: Metadata initialization requires additional setup
// See Solana Token-2022 documentation for complete metadata implementation
```

## Fee Collection Patterns

### Reading Collected Fees

```javascript
import { 
  getTransferFeeAmount,
  createWithdrawWithheldTokensFromMintInstruction
} from '@solana/spl-token';

// Get withheld fee amount
async function getCollectedFees(connection, mint) {
  const mintInfo = await getMint(connection, mint, 'confirmed', TOKEN_2022_PROGRAM_ID);
  const transferFeeAmount = getTransferFeeAmount(mintInfo);
  
  if (transferFeeAmount !== null) {
    return transferFeeAmount.withheldAmount;
  }
  return BigInt(0);
}
```

### Fee Withdrawal

```javascript
// Withdraw collected fees (requires authority)
async function withdrawFees(connection, mint, destination, authority) {
  const instruction = createWithdrawWithheldTokensFromMintInstruction(
    mint,
    destination,
    authority.publicKey,
    [],
    TOKEN_2022_PROGRAM_ID
  );
  
  const transaction = new Transaction().add(instruction);
  return await sendAndConfirmTransaction(connection, transaction, [authority]);
}
```

## Account Structure Requirements

### Mint Account Space Calculation

```javascript
// Calculate space for mint with extensions
function calculateMintSpace(extensions) {
  let space = 82; // Base mint account size (MINT_SIZE)
  
  for (const extension of extensions) {
    switch (extension) {
      case ExtensionType.TransferFeeConfig:
        space += 83; // Transfer fee config size
        break;
      case ExtensionType.MetadataPointer:
        space += 8; // Metadata pointer size
        break;
      // Add other extensions as needed
    }
  }
  
  return space;
}
```

### Account Creation Pattern

```javascript
async function createMintWithExtensions(connection, payer, authority, extensions) {
  const mint = Keypair.generate();
  const mintLen = calculateMintSpace(extensions);
  const mintLamports = await connection.getMinimumBalanceForRentExemption(mintLen);
  
  const transaction = new Transaction().add(
    SystemProgram.createAccount({
      fromPubkey: payer.publicKey,
      newAccountPubkey: mint.publicKey,
      space: mintLen,
      lamports: mintLamports,
      programId: TOKEN_2022_PROGRAM_ID,
    })
  );
  
  return { mint, transaction };
}
```

## Authority Management

### Multi-Authority Setup

```javascript
// Separate authorities for different functions
const authorities = {
  mintAuthority: mintAuthorityKeypair,
  transferFeeConfigAuthority: feeAuthorityKeypair,
  withdrawWithheldAuthority: withdrawAuthorityKeypair,
  metadataUpdateAuthority: metadataAuthorityKeypair
};

// Authority can be set to null to make immutable
// Example: Set mint authority to null after initial mint
const setAuthorityInstruction = createSetAuthorityInstruction(
  mint,
  currentAuthority.publicKey,
  AuthorityType.MintTokens,
  null, // Set to null for immutable
  [],
  TOKEN_2022_PROGRAM_ID
);
```

## Error Handling

### Common Error Patterns

```javascript
// Check for extension support
try {
  const mintInfo = await getMint(connection, mint, 'confirmed', TOKEN_2022_PROGRAM_ID);
  const transferFeeConfig = getTransferFeeConfig(mintInfo);
  
  if (!transferFeeConfig) {
    throw new Error('Transfer fee extension not configured');
  }
} catch (error) {
  if (error.message.includes('Invalid account owner')) {
    throw new Error('Not a Token-2022 mint');
  }
  throw error;
}
```

### Fee Calculation Validation

```javascript
// Validate fee parameters before setting
function validateFeeConfig(basisPoints, maxFee) {
  if (basisPoints < 0 || basisPoints > 10000) {
    throw new Error('Basis points must be between 0 and 10000');
  }
  
  if (maxFee < 0) {
    throw new Error('Maximum fee must be non-negative');
  }
  
  // Additional validation logic as needed
}
```

## Network Considerations

### RPC Endpoint Requirements

```javascript
// Token-2022 requires recent RPC versions
const connection = new Connection(
  'https://api.mainnet-beta.solana.com',
  {
    commitment: 'confirmed',
    confirmTransactionInitialTimeout: 60000
  }
);

// Verify Token-2022 program support
const programInfo = await connection.getAccountInfo(TOKEN_2022_PROGRAM_ID);
if (!programInfo) {
  throw new Error('Token-2022 program not available on this network');
}
```

### Transaction Size Limitations

```javascript
// Keep transactions under size limits
// Multiple extensions may require transaction splitting
const MAX_TRANSACTION_SIZE = 1232; // Solana transaction limit

function splitInstructionsIfNeeded(instructions) {
  // Implementation depends on specific use case
  // May need to batch instructions across multiple transactions
}
```

## Testing Patterns

### Local Validator Setup

```bash
# Start local validator with Token-2022 program
solana-test-validator \
  --bpf-program TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb \
  ~/path/to/spl_token_2022.so \
  --reset
```

### Unit Testing Example

```javascript
// Basic test structure for Token-2022 operations
describe('Token-2022 Operations', () => {
  let connection;
  let payer;
  
  beforeEach(async () => {
    connection = new Connection('http://127.0.0.1:8899', 'confirmed');
    payer = Keypair.generate();
    
    // Airdrop SOL for testing
    await connection.requestAirdrop(payer.publicKey, 2 * LAMPORTS_PER_SOL);
  });
  
  it('should create mint with transfer fee', async () => {
    // Test implementation
  });
});
```

## Important Limitations

### What Token-2022 Provides
- Automatic fee collection on transfers
- On-chain metadata storage
- Extension configuration management
- Basic authority controls

### What Requires External Implementation
- Fee redistribution logic
- Governance mechanisms
- Complex business rules
- Treasury management beyond basic multisig
- User interfaces

## Security Considerations

### Authority Key Management
- Use hardware wallets for production authorities
- Consider multisig setups for critical authorities
- Implement key rotation procedures
- Separate hot/cold key storage

### Extension Immutability
- Some extension configurations cannot be changed after deployment
- Plan authority structures carefully before mint creation
- Consider using updateable vs immutable authorities based on requirements

---

**⚠️ Important Note:** These implementation examples are based on Token-2022 program documentation and may require updates as the program evolves. Always refer to the official Solana Token-2022 documentation and test thoroughly in development environments.

*These implementation notes are based on Solana Token-2022 program capabilities as of early 2025. Always refer to the latest Solana documentation for the most current implementation details.*
