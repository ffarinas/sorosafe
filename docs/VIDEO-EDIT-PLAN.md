# SoroSafe · edit plan for the 3:00 team demo

Use the current bilingual narration in [VIDEO-SCRIPT.md](VIDEO-SCRIPT.md). Produce separate English and Spanish versions if both are needed. This plan specifies a new recording; it does not claim that the recording or final edit has been completed.

## Current recording

Record `https://testnet.sorosafe.app` with a vault deployed from the factory currently recorded in `docs/testnet-demo-factory.json`. Match the published artifact hashes in `lib/contract-artifacts.json` before using footage as evidence of the current version.

Use three distinct Testnet signer wallets and a **2-of-3** rule, plus a separate recipient wallet that accepts Circle's Testnet USDC. Follow the funding, contact history and session setup in the script. Keep the raw footage, vault address and transaction hashes together with the recording so every completed payment shown can be checked.

| Timeline | Fresh footage to capture | What the viewer should understand |
| --- | --- | --- |
| 0:00–0:20 | Brief landing introduction, then the team vault: address, three signers, balance and 2-of-3 rule. | This is shared team money, and one signer cannot pay alone under this rule. |
| 0:20–0:45 | B creates the supplier contact. Then A opens the same shared address book; show creator attribution and a real prior confirmed payment. Label the earlier contact-creation shot if needed. | A teammate can use a contact another person saved, with provenance and payment history. |
| 0:45–1:10 | A starts from the USDC row, selects the shared supplier, reviews 2 USDC plus the actual service fee and signs. Hold on the pending state and first approval. | Preparing a payment is one approval; pending does not mean paid. |
| 1:10–1:45 | Identified switch to B. Open the same request, review its details, approve and complete. Show confirmation, receipt and updated contact payment count. | The final required approval sends this funded payment. The third signer is not required for a 2-of-3 rule. |
| 1:45–2:10 | The recorded fee review and corresponding current-contract receipt. Show fee-bump sponsorship only if the receipt confirms it. | The 0.25% service fee is reserved in the vault for later collection. Sponsorship concerns a separate network fee and is conditional. |
| 2:10–2:35 | Short creation shot, then a clearly labelled view of the configured team and its unchanged vault address. | Creation starts with one signer; add the team before using shared approvals. Team rules can evolve with the current quorum. |
| 2:35–3:00 | Language selector, receipt and restrained end card with `testnet.sorosafe.app`. | The product is available in English and Spanish on Testnet; it has not yet had an independent audit. |

## Evidence and continuity

- Keep the vault address, recipient, currency and amount consistent across proposal, approval and receipt. A new transaction requires its own receipt; do not substitute an older successful transaction.
- Identify account changes with a small **Signer A / Firmante A** or **Signer B / Firmante B** label. Do not imply that opening another account constitutes an approval.
- Capture real contact attribution and confirmed payment history. The contact-creation shot occurs before the preparation payment; label the time shift or retain that chronology.
- Do not hide contract verification warnings, replace balances or obscure an asset-selection error to imply the current flow succeeded. Resolve the issue and record the affected sequence again. If unresolved, document the limitation instead of presenting that sequence as working.
- Keep the review, signature, pending state and completion legible. Trim idle cursor time and long waits; indicate accelerated waiting if shown. Do not imply edited footage measures network latency.
- The receipt for current contracts shows the recipient's payment; the service fee is accounted for in the vault until `claim_fees`. Do not annotate a collector transfer that did not occur in that transaction.
- Show the actual sponsorship outcome. If a signer paid the network fee, the narration already accommodates that. Never label the transaction «gas on us» unless its receipt verifies sponsorship.
- Keep **Testnet** visible and describe any displayed USDT0 as **SoroSafe-issued test USDT0**, not official USDT0. This is a controlled product demonstration, not evidence of customer adoption.

## Visuals and audio

- Use restrained black-and-white lower thirds that match SoroSafe. Suggested labels: **Shared vault · Shared contacts · Review payment · Approve together · Stellar receipt**. Spanish: **Bóveda compartida · Contactos compartidos · Revisar pago · Aprobar en equipo · Recibo en Stellar**.
- Crop for legibility without removing material status or fee information. Include at least one full view showing the interface context and vault identity.
- Narration stays foremost. Optional instrumental music should remain quiet enough to hear numbers and conditions clearly.
- Use the script's English or Spanish narration with matching app language and subtitles. Check the delivered duration and captions after export; aim below 3:00 to leave room for the closing frame.

## Archived footage — October 3, 2026

These recordings are historical references, not evidence of the current contracts or the new team-first flow:

- `Screen Recording 2026-10-03 at 10.40.56 PM.mov` — 7:26, 1264×882, account `GAWW…X2UX`.
- `Screen Recording 2026-10-03 at 11.04.14 PM.mov` — 1:27, account `GBM7…J374`.

They include an older vault verification warning, a token-selection issue and the former fee model that transferred the fee directly to the collector. Do not mask those differences or reuse the old receipt as current evidence. Re-record the affected flows with the current deployment. Any reused purely decorative footage must still match the current interface and claims.
