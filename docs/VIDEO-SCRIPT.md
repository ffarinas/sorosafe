# SoroSafe · video script (max 3:00)

English narration (~330 words, about 2:30 at a calm pace). Stage directions in Spanish. The story: why a smart contract beats a shared wallet for team money, shown with one real 2-of-2 payment.

## Antes de grabar

- Graba `https://testnet.sorosafe.app` con la app en inglés, 1920×1080 y un zoom que deje leer destinatario, importe, comisión y aprobaciones.
- Dos perfiles de navegador, uno por firmante:
  - **A**: Freighter en **Test Net**.
  - **B**: otra cuenta de Freighter, o **Start without installing** (wallet temporal).
  Inicia sesión en los dos antes de grabar: la firma de inicio de sesión no es una aprobación.
- Con A, crea la bóveda **Team Treasury**. En **Team**, añade la dirección de B y elige **2 of 2**. Tiene que ser una bóveda de la fábrica actual (`docs/testnet-demo-factory.json`); no reutilices bóvedas antiguas.
- Fondos: en **Add funds**, A pulsa **Get 10 test USDC** y deposita 10 USDC en la bóveda. Deja XLM en ambas wallets para los costes de red que no se patrocinen.
- Con B, guarda un contacto compartido **Design studio** con una dirección de Testnet que exista y acepte USDC (por ejemplo, una tercera wallet temporal que ya pidió USDC del faucet).
- Pago principal: **5 USDC**. Con la comisión del 0,25 %, la bóveda gasta 5,0125 USDC.
- Conserva la dirección de la bóveda y los hashes de las transacciones. No uses las grabaciones del 3 de octubre: muestran la interfaz y el modelo de comisiones anteriores.

## 0:00 – 0:20 · The problem

**Pantalla:** hero de la landing y bajada hasta la sección **Why a smart contract**.

> "Companies moving money on-chain want two people to approve every payment, and security teams want those signers on devices from different makers. On most networks that's hard: multisig means everyone signing the same transaction, often in the same wallet app. SoroSafe takes a different approach."

## 0:20 – 0:45 · A contract, not a shared wallet

**Pantalla:** la tabla comparativa de la landing y la tarjeta **Each signer keeps the wallet they trust**.

> "Each SoroSafe vault is a Soroban smart contract. It keeps payment requests on Stellar, counts the approvals and pays only when the rule is met. People approve on their own time, from the wallet or device they trust, because the contract checks the Stellar signature, not the app."

## 0:45 – 1:05 · Setup

**Pantalla:** toma corta de la creación de **Team Treasury** (grabada en la preparación) y la pestaña **Team** con A, B y **2 of 2**.

> "Our vault took one signature to create. Then we added a teammate and set the rule to two of two. Same address; changing the team needs the current approvals."

## 1:05 – 1:25 · Shared contact

**Pantalla:** A abre **Contacts**: **Design studio**, añadido por B.

> "My teammate saved a supplier. I see the same contact and who added it, so nobody pastes addresses into a chat."

## 1:25 – 1:55 · Request a payment

**Pantalla:** A → **Send** → contacto **Design studio** → **5 USDC** → revisión (destinatario, importe, comisión, total) → confirmar en Freighter → aviso **Payment requested: 1 of 2 approvals** y la solicitud en **Requests**.

> "I request five U-S-D-C. Before signing, I see the recipient, the amount, the point-two-five percent service fee and the total. My request already counts as my approval. Now it waits, on Stellar, for my teammate."

## 1:55 – 2:25 · Approve on their own time

**Pantalla:** rótulo **Signer B**. B ve el aviso de una solicitud pendiente → **Requests** → **Approve and pay** → firma → **Paid 5 USDC to Design studio**.

> "Later, from a different wallet, my teammate opens the same request and approves. That last approval sends the payment in the same transaction. No half-signed transaction passed around, and no extra execute step."

## 2:25 – 2:45 · Proof on Stellar

**Pantalla:** **View receipt** en stellar.expert. Si la transacción es un fee-bump, señala la cuenta que pagó la comisión de red (el patrocinador de SoroSafe).

> "Everything is verifiable on Stellar. SoroSafe covers the network fee when it can, and the vault can only do two things: pay in its approved currencies, or change its team."

## 2:45 – 3:00 · Close

**Pantalla:** tarjeta final con el logo y `sorosafe.app`.

> "SoroSafe: shared money, approved together. Live today on Stellar Testnet at sorosafe dot app."

## Edición

- Acelera solo las esperas (spinners de firma y confirmación); deja legibles la revisión, el estado pendiente y el pago completado.
- Rótulos: *Why a contract · Setup · Shared contact · Request · Approve together · Verifiable on Stellar*.
- Mantén visible **Testnet**. Música suave por debajo de la voz.
