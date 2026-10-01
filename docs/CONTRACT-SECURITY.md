# Junto Soroban v1 — security model and validation

Status: implemented and exercised on Stellar Testnet. **Not independently audited. No Junto factory has been deployed to Mainnet by this change.** The use of audited dependencies does not make this composition audited or invulnerable.

## Custody and authorization

Each vault is an immutable WASM contract with a permanent C-address. The factory has no administrator, withdrawal function, upgrade function, or mutable fee configuration. Creating a vault requires the creator's Stellar authorization, includes all constructor arguments, and namespaces the deployment salt by creator. The factory explicitly authorizes only the predicted vault constructor with the exact arguments. There is no post-deployment initialization window.

The vault accepts 2–20 distinct G-account signers and a quorum of 2–N. Signers are authorized using Soroban `Address.require_auth`, which delegates signature verification and transaction replay prevention to Stellar. Junto does not implement a signature scheme. A compromised signer cannot spend below quorum. A quorum can change all signers and the threshold, including replacing the original creator, without changing the vault's address.

Proposals, approvals and a cumulative confirmed-payment count per recipient are stored on-chain, not in D1. Proposal IDs are monotonically increasing; creation requires the expected next ID. Each proposal binds its action, proposer, expiration (at most seven days) and rules epoch. An approval is counted once per signer. A signer can revoke their own approval. Only the proposer can cancel their pending proposal. Terminal and expired proposals cannot execute. Changing the rules increments the epoch and invalidates older pending proposals. Execution is permissionless once the current quorum has approved, so a different wallet can pay the network fee.

## Transfers and fees

Only built-in Stellar Asset Contracts in the immutable factory asset list are supported. No arbitrary contract calls, allowances, external signature policies, `__check_auth` bypass, staking plugins, or code upgrades are exposed. A proposal transfers its exact amount to its recipient and an additional service fee to the fixed collector, in the same token and transaction. The service fee uses OpenZeppelin's full-precision `mul_div_ceil(amount, bps, 10000)`; amounts plus fees are checked for overflow. Fractional smallest units round upward. The fee ceiling is 1,000 basis points; it is a validation bound, not the selected commercial rate.

The execution state is consumed before transfers. A failure of either transfer rolls back both transfers and the state change. A direct request to the SAC to transfer from the vault cannot authenticate the vault. There is no alternative generic execution or allowance path that bypasses the fee.

A nonzero-fee deployment checks that the collector can receive each asset. **Collector trustline removal, issuer freezes, clawback, or loss of issuer authorization can still block payments later.** Maintaining the collector's receiving accounts is an operational dependency. The collector and fee are deliberately immutable in this version; fee escrow or a governance-controlled collector rotation would require a separately reviewed design. Unsupported tokens accidentally deposited into the vault have no withdrawal path in v1: the asset list must be reviewed before funding.

## Libraries and reproducibility

- Soroban SDK `=26.1.1` with its official dependency-constraint fix; Stellar host handles authorization and SAC transfers.
- OpenZeppelin `stellar-contract-utils` v0.7.2, exact revision `a9c42169000638da937577f592ebf61a7a3c94ca`. Used for the fee arithmetic. The generic smart-account framework is not used: exposing generic calls would add a fee bypass surface here.
- OpenZeppelin's v0.7.0 audit includes the fixed-point mathematics modules. This is evidence of component review, **not evidence that Junto or every change through v0.7.2 is audited or independently verified in production**.
- `contracts/Cargo.lock` is committed. Release builds enable overflow checks, use one codegen unit and LTO, and contain no debugging symbols. Build with `stellar contract build --locked` (CLI 25.2.0 or compatible; Rust 1.94.1 used for these artifacts).
- Published WASM hashes are in `lib/contract-artifacts.json`. Before enabling a vault, the client checks both vault and factory WASM bytes against those hashes and checks the factory registration. A self-reported factory address alone is insufficient.
- RustSec audit: zero known vulnerabilities in the resolved lockfile at validation time; informational `RUSTSEC-2024-0436` for the unmaintained `paste` dependency in the native test host. `cargo tree --target wasm32v1-none -i paste --edges normal,build` confirms it is absent from the deployed WASM dependency tree.

## Backend independence and application boundaries

`/contract?network=mainnet&address=C…` reads configuration, balances, proposals and approvals from Stellar RPC and constructs wallet-signed operations locally. The contract does not call Junto's backend. D1 still supplies invitation links, human names and private shared contacts for the normal onboarding path; these are collaboration data, not custody authority. Losing that service does not prevent a signer from using the contract or another client. RPC availability remains necessary.

Tokens retain their network, code and issuer and are resolved to their deterministic SAC IDs. Payment preparation and approval validate the actual contract/function/arguments before requesting a wallet signature. There is no XLM fallback. The UI shows token-specific service fees and XLM network costs separately. Only known catalog assets are displayed. The independent route supports a matching Junto code deployment with any fee configuration; users must still confirm the address and fee with their team.

Storage is persistent and extended to 30 days on successful transactions. Read simulations do not themselves renew ledger TTL. Archived data is recoverable, not reset; the operator must keep instances/code/proposal storage live or restore archived entries through Stellar tooling. The first version does not yet provide a dedicated manual restoration interface. A malicious RPC or frontend can mislead users; the contract prevents unilateral withdrawals, but it cannot protect a quorum that signs a malicious, correctly authorized payment. Hardware-wallet and clear-signing coverage remain to be verified device by device.

## Evidence and limits

- 18 Rust tests (16 vault, 2 factory): 1-of-1 vaults that execute on propose and then add signers, proposer counted as first approval and able to withdraw it, quorum, duplicate signers/approvals, missing authorization, unauthorized members, revocation, cancellation, expiry, nonce, fee rounding/overflow, atomic rollback, signer rotation and factory provenance/namespacing.
- 17 real-Testnet workflow checks in `docs/soroban-testnet-evidence.json`, using compiled WASM, Friendbot-funded ephemeral wallets and real Ed25519 transaction signatures. Negative preflight checks exercise the network's contract simulation; the invalid transaction-signature check is submitted to RPC. Positive operations were confirmed on-chain. Test secrets were never persisted.
- 16 application onboarding checks: SEP-10 sessions, shared invitations, exact constructor validation, activation, shared contacts and rejection of memo-dependent destinations.
- 10 client checks for exact asset, recipient, function, signer and constructor encoding.
- TypeScript, ESLint, Rust Clippy and production build checks.
- Mainnet read-only RPC checks confirm the official XLM/USDC/USDT0 SAC addresses and seven decimal places (`docs/mainnet-sac-readonly-evidence.json`); no Mainnet token transfers were submitted.
- Browser checks read the actual Testnet vault balance and completed payment/rotation history. These do not constitute a complete Freighter hardware-wallet signing test.

Pending before production custody: independent review of this exact WASM and application signing flow, a decision on collector/trustline liveness and unsupported-asset recovery, storage-restoration operations, real Freighter/device coverage, and a controlled Mainnet exercise with the chosen fee recipient and approved small amounts. The current implementation supports basic payments; email/passkeys, batches, staking and arbitrary dApp execution are outside v1.

Sources: [Soroban authorization](https://developers.stellar.org/docs/build/guides/auth/contract-authorization), [Stellar Asset Contract](https://developers.stellar.org/docs/tokens/stellar-asset-contract), [OpenZeppelin v0.7.0 audit](https://www.openzeppelin.com/news/stellar-contracts-rc-v0.7.0-audit), [SDK 26.1.1](https://github.com/stellar/rs-soroban-sdk/releases/tag/v26.1.1).
