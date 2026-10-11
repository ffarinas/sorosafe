# SoroSafe · edit plan for the 3:00 demo

Narration and setup are in [VIDEO-SCRIPT.md](VIDEO-SCRIPT.md). This plan describes a new recording of the current product; it does not claim the recording or the final edit exists yet.

## What to record

Two signers (**A** and **B**) on a **2-of-2** vault created from the factory in `docs/testnet-demo-factory.json`, plus a recipient wallet that accepts Circle's Testnet USDC. Keep the raw footage, the vault address and the transaction hashes together.

| Timeline | Footage | What the viewer should understand |
| --- | --- | --- |
| 0:00–0:20 | Live landing: hero, scroll to **Why a smart contract** | Team money needs approvals from signers on different devices; wallet multisig makes that hard |
| 0:20–0:45 | The comparison table and the "wallet they trust" card | The vault is a contract: requests live on Stellar, each person approves on their own time from their own wallet |
| 0:45–1:05 | Short creation shot, then **Team** with A, B and 2 of 2 | One signature to start; the team and rule are set by the current approvals |
| 1:05–1:25 | A opens **Contacts**: the contact B added | Contacts are shared, with who added them |
| 1:25–1:55 | A requests 5 USDC: review, signature, "1 of 2 approvals" | A request is the first approval; pending is not paid |
| 1:55–2:25 | **Signer B**: Requests → Approve and pay → Paid | The last approval sends the payment in the same transaction |
| 2:25–2:45 | Receipt on stellar.expert | Verifiable on Stellar; network fee sponsored when possible; the vault only pays or changes its team |
| 2:45–3:00 | End card (logo + `sorosafe.app`) | Live on Testnet |

## Evidence and continuity

- Keep vault, recipient, currency and amount consistent from request to receipt, and show the receipt of that same payment.
- Label account switches with **Signer A** / **Signer B**. Opening another account is not an approval.
- With the current contracts the receipt shows the recipient's payment; the service fee stays in the vault until `claim_fees`. Don't annotate a fee transfer to the collector.
- Only point at the sponsor if the receipt is a fee-bump. The narration already says "when it can".
- Keep **Testnet** visible. This is a product demo, not evidence of customer adoption.

## Reusing the ChatCut project

The ChatCut project **Sorosafe** already has the light background, lower-third style, the narration voice (Peter), music and the end card with the new logo. Replace the footage and narration with the new recording; keep the visual system.

The October 3, 2026 recordings (`Screen Recording 2026-10-03 at 10.40.56 PM.mov` and `… 11.04.14 PM.mov`) are historical: they show the previous interface, an old vault warning and the former fee model. Don't reuse them for the current product.
