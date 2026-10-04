# SoroSafe · video script (max 3:00)

Narration in English (~390 words, about 2:45 at a calm pace). Stage directions in Spanish. Record https://testnet.sorosafe.app with Freighter on Testnet, 1920×1080, browser zoom 110–125 %, app language in English.

## Antes de grabar

- Dos cuentas en Freighter (Testnet): **A** (creadora) y **B** (segunda firmante). Copia la dirección G… de B.
- B debe tener USDT0 de prueba (entra una vez con B y usa *Add funds → Get 1000 test USDT0*) para que pueda recibir pagos en USDT0.
- Ensaya una vez completa: cada firma tarda ~5 s. Esas esperas se recortan en la edición.
- Graba en bruto 5–8 minutos siguiendo los bloques; el montaje deja 3:00.

## 0:00 – 0:20 · Hook

**Pantalla:** landing de sorosafe.app (hero «Multisig. For your team.»), bajar despacio hasta «Multisig should feel simple».

> "When a group shares money — a team, a family, a club — one person usually ends up holding it all. Multisig fixes that, but today it feels built for engineers: everyone has to be online before you start, you sign twice for one payment, and you need gas for every step. SoroSafe makes it simple."

## 0:20 – 0:45 · Create

**Pantalla:** "Create vault" → nombre "Team trip 2026" → Freighter (A) → una firma → la bóveda abierta con su dirección C… y "View contract on Stellar".

> "I name the vault and sign once. That deployed a Soroban smart contract just for us, from a verified factory — no admin keys, nobody can withdraw alone. I start as the only signer, so it works right away."

## 0:45 – 1:15 · Fund and pay, gas on us

**Pantalla:** fila USDT0 (logo oficial) → "Add funds" → "Get 1000 test USDT0" → depositar 500. Luego "Send" 50 USDT0 a un contacto; revisión (recipient, amount, fee, total, "SoroSafe covers it") → firmar → aviso "SoroSafe covered the network fee" → "View receipt".

> "Stablecoins are first-class: USDC and USDT0, each identified by its issuer, never by ticker. I add funds and send a payment. Before my wallet signs, SoroSafe shows exactly what will happen and checks the transaction byte by byte. As a one-of-one vault, it executes immediately — and I didn't spend any XLM: SoroSafe paid the network fee with a Stellar fee-bump."

## 1:15 – 1:40 · Grow the team

**Pantalla:** pestaña Team → "Add people or change rule" → pegar dirección de B → elegir "2" → firmar → "2 / 2".

> "When the team is ready, I add my teammate and pick how many approvals each payment needs. Same vault, same address — the rule changes on-chain, and from now on I can't move money alone."

## 1:40 – 2:20 · Approve once

**Pantalla:** con A, enviar 100 USDT0 → "1 / 2 approvals". Menú de cuenta → "Switch account" → entrar con B en Freighter → aviso "1 operation is waiting for your approval" → "Approve and complete" → una firma → "Completed" → recibo.

> "I propose a payment — proposing already counts as my approval. My teammate opens SoroSafe and sees exactly what needs their approval. They approve once, and because that completes the rule, the payment and the service fee go out in that same transaction. Nobody signs twice, and there's no separate execute step."

## 2:20 – 2:45 · Trust

**Pantalla:** pestaña Contacts (quién añadió cada contacto y pagos confirmados), luego la sección Security de la landing.

> "The team shares one address book, with who added each contact and how many payments it has received on-chain. Changing the team needs the current quorum and cancels older requests. Funds, rules and approvals live on Stellar — even without our backend, you can open a vault by its address and keep operating."

## 2:45 – 3:00 · Close

**Pantalla:** footer con el wordmark grande y la URL.

> "SoroSafe: start alone, grow into a team, sign once, and leave the gas to us. Live today on Stellar Testnet at sorosafe.app — Mainnet with USDC and USDT0 is next."

## Edición

- Acelerar ×2 las esperas de confirmación y los cambios de cuenta en Freighter.
- Rótulos por bloque: *Create · Fund · Pay · Add signer · Approve once · Gas on us*.
- Música suave y baja; la voz manda.
- Si sobra tiempo, recortar el bloque *Trust* antes que *Approve once*: es el momento más fuerte.
