# Guion del video · SoroSafe (máx. 3:00)

Narración en inglés (jueces internacionales). Las indicaciones de pantalla van en español. Grabar en https://testnet.sorosafe.app con Freighter en Testnet, a 1920×1080, con el navegador al 110–125 % para que se lea bien.

## Antes de grabar

- Dos cuentas en Freighter (Testnet): **Cuenta A** (creadora) y **Cuenta B** (segunda firmante). Copia la dirección G… de B a un bloc de notas.
- Cuenta A con XLM de prueba (Friendbot). La app financia automáticamente cuentas nuevas, pero conviene llegar con todo listo.
- Idioma de la app en inglés (botón ES/EN).
- Pestaña de stellar.expert lista para mostrar un recibo.
- Ensaya una vez completa: cada firma tarda unos 5 s en confirmarse. Corta esas esperas en la edición.

## 0:00 – 0:20 · El problema

**Pantalla:** portada de testnet.sorosafe.app.

> "When a group shares money — a team at an event, a family, a club — someone usually ends up holding everything in their own wallet. Multisig fixes custody, but today it feels built for engineers: everyone has to be online before you start, and you sign twice for one payment."

## 0:20 – 0:45 · Crear la bóveda

**Pantalla:** escribir el nombre ("Team expenses 2026"), conectar Freighter (Cuenta A), firmar una vez. Mostrar la bóveda activa con su dirección C… y el botón "View contract on Stellar".

> "SoroSafe is a shared vault on Stellar. I give it a name and sign once. That deployed a Soroban smart contract just for this vault, from a verifiable factory. No admin keys, nobody can withdraw on their own. I start as the only signer, so I can use it right away."

## 0:45 – 1:10 · Añadir fondos y pagar al instante

**Pantalla:** "Add funds" con 100 XLM, firmar. Luego "Send" a la dirección de un contacto con 10 XLM: mostrar la revisión (destinatario, importe, comisión, total), firmar y abrir "View receipt" en stellar.expert.

> "I add funds with a normal token transfer. Now I send a payment. Before my wallet signs anything, SoroSafe shows exactly what will happen — recipient, amount, fee, total — and checks the transaction byte by byte. Since I'm alone, it executes in that same transaction — and SoroSafe paid the network fee for me with a Stellar fee-bump, so I didn't spend any XLM. Here's the receipt on-chain."

## 1:10 – 1:40 · Sumar al equipo

**Pantalla:** pestaña Team → "Add people or change rule". Pegar la dirección de la Cuenta B, poner 2 aprobaciones, firmar. Mostrar el equipo con 2 personas y "2 / 2".

> "Now the group is ready. I add my teammate's wallet and set the rule to two approvals. Same vault, same address — the rule changed on-chain. And from now on, I can't move money alone."

## 1:40 – 2:20 · Pago con doble aprobación

**Pantalla:** con la Cuenta A, enviar 20 XLM: queda en "1 / 2 approvals". Menú de cuenta → "Switch account" y entrar con la Cuenta B en Freighter. Se ve el aviso "1 operation is waiting for your approval"; pulsar "Approve and complete", firmar una vez y abrir el recibo.

> "I propose a payment — my proposal already counts as my approval, so I only sign once. It's waiting for my teammate. When they open SoroSafe, it tells them what needs their approval. They see the same clear summary, approve once — and because that completes the rule, the payment and the fee go out in that same transaction. Nobody signs twice."

## 2:20 – 2:45 · Por qué es seguro y diferente

**Pantalla:** pestaña Contacts (autor y pagos confirmados), luego Team (comisión y protocolo, al final de la sección). Opcional: abrir `/contract?network=testnet&address=C…` para enseñar que funciona sin backend.

> "The team shares one address book, with who added each contact and how many payments it has already received on-chain. Changing the team needs the current quorum and invalidates older requests. And the vault works straight from Stellar: even without our backend, you can open it by its address and keep operating."

## 2:45 – 3:00 · Cierre

**Pantalla:** portada con el logo y la URL.

> "SoroSafe: start alone, grow into a team, and never sign twice. Live today on Stellar Testnet at sorosafe.app — Mainnet with USDC is next."

## Consejos de edición

- Acelera ×2 las esperas de confirmación y los cambios de cuenta en Freighter.
- Pon un rótulo pequeño en cada paso: *Create · Fund · Pay · Add signer · Approve*.
- Si te pasas de tiempo, recorta la sección 2:20–2:45 antes que la demo de doble aprobación: es el momento más fuerte.
