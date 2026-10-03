# SoroSafe

English · [Español](README.es.md)

**Shared vaults on Stellar for teams, families and communities.** One address for the group's money, rules everybody can see, and payments people understand before they sign.

**Live demo (Testnet): https://testnet.sorosafe.app** · Mainnet coming soon

> SoroSafe runs on Stellar Testnet. Test funds have no real value. The contracts have not been independently audited.

## The problem

Groups that share money (a team travelling to an event, a family, a small DAO, a club) usually end up trusting one person's wallet or juggling spreadsheets. Existing multisig tools solve custody but feel built for engineers: you need everyone online before you can start, you sign twice to propose one payment, and nothing tells you who the recipient really is.

## What SoroSafe does

- **Start alone, grow later.** Creating a vault takes a name and one wallet signature. You start as the only signer (1 of 1) and can use it right away. Add people and raise the rule (for example 2 of 3) whenever the group is ready; the vault keeps the same address.
- **One signature per decision.** Proposing a payment already counts as your approval, and the approval that completes the rule sends the payment in that same transaction. Nobody signs twice, and there is no separate "execute" step.
- **Readable before signing.** Every request shows recipient, amount, service fee, total and asset contract. The app rebuilds each transaction locally and checks contract, function and arguments byte for byte before asking your wallet to sign.
- **Shared contacts.** The team keeps one address book with who added each contact and how many confirmed payments it has received on-chain.
- **Verifiable receipts.** Every confirmed operation links to the transaction and the vault contract on stellar.expert.
- **Bilingual.** Spanish and English throughout, including errors and confirmations.

## How it uses Stellar

| Piece | What it does |
| --- | --- |
| **Vault contract (Soroban)** | Holds SAC tokens (XLM, USDC). Stores signers, threshold and proposals. `propose`, `approve`, `revoke`, `cancel`, `execute`. Signers are authenticated with `require_auth`, so each approval is bound to the exact contract, function and arguments. |
| **Factory contract** | Deploys one vault per team from a fixed WASM hash with a deterministic, creator-namespaced salt, and registers it (`is_vault`) so the app can verify a vault's origin. No admin, no upgrade, no withdrawal key. |
| **Team changes** | `ChangeRules` proposals need the current quorum. Executing one bumps an epoch that invalidates every older pending request. |
| **Fees** | Optional service fee in the same token, computed with OpenZeppelin's audited fixed-point math (`mul_div_ceil`) and paid atomically with the payment. The demo factory uses 0.25 %. |
| **SEP-10** | Wallet-based sign-in. The server never sees or stores user keys. |
| **SAC** | Assets are identified by code + issuer and resolved to their deterministic Stellar Asset Contract addresses. A ticker alone never identifies a token. |

Collaboration data (names, contacts, invitations) lives in Cloudflare D1. It never controls money: `/contract?network=testnet&address=C…` can read and operate any vault directly from Stellar without SoroSafe's backend.

## Try it

1. Install [Freighter](https://www.freighter.app/) and switch it to **Testnet**.
2. Open https://testnet.sorosafe.app and create a vault. If your Testnet account is new, SoroSafe funds it with Friendbot test XLM.
3. **Add funds**: move some test XLM from your wallet into the vault.
4. **Send a payment**: as a 1-of-1 vault it executes immediately. Open the receipt.
5. **Add a second signer** (another Freighter account) and set the rule to 2 of 2.
6. **Send another payment**: now it waits. Switch Freighter to the second account, approve, and execute.

## Deployed on Testnet

- App: https://testnet.sorosafe.app (Cloudflare Workers + D1)
- Factory: [`CDY4CAOMSGQC5JSTGLKIOXPHJROQ55FT7NFC37WYE5ZZ3OQD4GZFSXFM`](https://stellar.expert/explorer/testnet/contract/CDY4CAOMSGQC5JSTGLKIOXPHJROQ55FT7NFC37WYE5ZZ3OQD4GZFSXFM)
- Vault WASM SHA-256 `c78ed14a…4c0f`, factory WASM SHA-256 `053fe96e…f9ff` (see `lib/contract-artifacts.json`). The app checks both hashes on-chain before operating a vault.

## Verification

| Suite | Result |
| --- | --- |
| Rust contract tests (`npm run contracts:test`) | 19/19 |
| Real Testnet flow with Friendbot wallets (`npm run test:soroban`) | 20/20, receipts in `docs/soroban-testnet-evidence.json` |
| End-to-end sign-up and vault creation through the API (`tests/contracts-onboarding.mjs`) | 19/19, also run against the deployed app |
| Backend regression tests (`npm run test:audit-regressions`) | 24/24 |
| Client transaction encoding (`npm run test:contracts-client`) | 10/10 |

## Architecture

```
contracts/            Rust, soroban-sdk 26
  vault/              shared vault: proposals, approvals, quorum, atomic fee
  factory/            deploys and registers vaults from a fixed WASM hash
  types/              rules and protocol validation shared by both
app/                  React UI and API routes (vinext on Cloudflare Workers)
lib/                  Stellar RPC client, SEP-10 auth, transaction checks
db/, drizzle/         D1 schema and migrations for collaboration data
scripts/              contract build, Testnet factory and Cloudflare deploy
tests/                integration and Testnet suites
```

## Run locally

Node 22.13+, Rust 1.94.1 with target `wasm32v1-none`, Stellar CLI 25.2.0+.

```sh
npm ci
npm run db:local && npm run db:local:upgrade && npm run db:local:contracts \
  && npm run db:local:auth && npm run db:local:auth-limits && npm run db:local:attempts
node scripts/setup-local-auth.mjs
# .dev.vars: JUNTO_NETWORK=testnet and JUNTO_FACTORY=<factory C… address>
npm run dev -- --host 127.0.0.1 --port 8789
```

Build and test the contracts with `npm run contracts:build && npm run contracts:test`. `npm run contracts:deploy-testnet` deploys a fresh demo factory with ephemeral Friendbot accounts; `npm run deploy:testnet` publishes the app to Cloudflare.

## Security and limits

- Not independently audited. Read [the security model](docs/CONTRACT-SECURITY.md) for risks and open items.
- V1 only moves the SAC tokens listed when the factory was deployed. No arbitrary calls, allowances or upgrades.
- Signers are Stellar G accounts. Freighter is the integrated wallet; passkeys and more wallets are planned.
- A classic payment or an exchange withdrawal that requires a memo must not be sent to a vault's C… address.

## Roadmap

- Mainnet launch with XLM, USDC and USDT0 (official SAC addresses already verified read-only).
- More wallets through Stellar Wallets Kit, including mobile.
- Pull-based fee collection and storage TTL renewal.
- Independent audit.

## License

[MIT](LICENSE)
