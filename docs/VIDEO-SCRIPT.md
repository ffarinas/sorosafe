# SoroSafe · team demo script (maximum 3:00)

Two alternative narration tracks, English and Spanish. Record each language separately with the app in that language; do not read both in one video. The shared payment is the main demonstration. Creating a vault comes later as a short explanation of how the team got started.

## Antes de grabar

- Usa `https://testnet.sorosafe.app`, Freighter en **Testnet**, 1920×1080 y un zoom que permita leer destinatario, moneda, importe y aprobaciones.
- Prepara tres wallets reales de prueba: **A**, **B** y **C**, con sus propias claves. Crea una bóveda actual, incorpora a las tres y establece **2 de 3**. Es un ejemplo de configuración, no el límite del producto. No presentes este recorrido controlado como un piloto con clientes.
- Comprueba que la bóveda pertenece a la fábrica actual publicada en `docs/testnet-demo-factory.json` y que sus versiones coinciden con `lib/contract-artifacts.json`. No reutilices una bóveda antigua para representar los contratos actuales.
- Inicia las sesiones antes de grabar. La firma para iniciar sesión con SEP-10 es distinta de la firma de una aprobación. Usa perfiles de navegador o sesiones separadas para mostrar a A y B de forma inequívoca.
- B añade un contacto compartido, por ejemplo **Travel supplier**, con la dirección de una cuarta wallet de prueba. Esa wallet debe existir y aceptar el USDC de Circle en Testnet. A debe ver el mismo contacto y la atribución a B al abrir la bóveda.
- Fondea la bóveda con USDC de Testnet suficiente para el pago y la comisión. Completa un primer pago real a ese contacto para disponer de historial confirmado; conserva su recibo. No inventes saldos, contactos atribuidos a otras personas ni contadores de pagos.
- El pago principal será de **2 USDC**: con la comisión actual de **0,25 %**, el coste para la bóveda es **2,005 USDC**. Comprueba en la revisión el porcentaje efectivo de la bóveda y usa los valores reales si cambian.
- Comprueba disponibilidad del faucet y patrocinio antes de grabar. Si un servicio falla, corrige la causa y repite la operación; no montes un resultado que no ocurrió. Mantén XLM de prueba en las wallets para los costes que no se patrocinen.
- USDC será la moneda del recorrido. Si enseñas USDT0, identifica expresamente que **el USDT0 de Testnet fue emitido por SoroSafe y no es el token oficial**. No es necesario grabar otra transferencia.
- Conserva la toma original, la dirección de la bóveda y los hashes de las transacciones del recorrido. Graba más de tres minutos si hace falta; recorta pausas, no pasos necesarios para comprender la aprobación.

## 0:00–0:20 · Shared team money / Dinero del equipo

**Pantalla:** entrada breve desde la landing y bóveda con el saldo, tres miembros y regla **2 de 3**. Rótulo discreto: **Testnet · 2 of 3 approvals** / **Testnet · 2 de 3 aprobaciones**. Evita depender de un titular exacto de la landing.

**English**

> SoroSafe is a multisig vault for teams on Stellar. Instead of coordinating addresses and approvals across chats, the team works from one vault. Here, three people share a budget, and any two must approve a payment before the money moves.

**Español**

> SoroSafe es una bóveda multifirma para equipos en Stellar. Las direcciones y las aprobaciones se reúnen en un mismo lugar. En este equipo, tres personas comparten un presupuesto y se necesitan dos aprobaciones para enviar un pago. Todos ven la misma regla.

## 0:20–0:45 · Shared contacts / Contactos compartidos

**Pantalla:** toma de B guardando el contacto; corte identificado a A, que abre la misma libreta sin volver a cargarlo. Muestra **Added by** / **Añadido por** y el contador real de pagos confirmados. La toma de creación del contacto debe preceder al pago de preparación; el montaje puede indicar «Earlier / Antes» para conservar esa secuencia.

**English**

> My teammate saved this supplier. I see the same contact, who added it, and its confirmed payments from our vault. We do not have to exchange the address again. The history provides context; I still check the destination before paying.

**Español**

> Mi compañero guardó este proveedor. Yo veo el mismo contacto, quién lo añadió y cuántos pagos confirmados recibió de nuestra bóveda. No tenemos que volver a compartir la dirección por un chat. El historial aporta contexto; igualmente reviso el destinatario antes de pagar.

## 0:45–1:10 · Prepare a payment / Preparar un pago

**Pantalla:** con A, abre **Send / Enviar** desde la fila **USDC**; selecciona el contacto compartido, introduce **2 USDC** y revisa destinatario, moneda, comisión y total. Firma la solicitud. Enseña el estado pendiente y la primera aprobación, sin confundirlo con un pago completado.

**English**

> I select USDC, choose our supplier, and enter the amount. Before signing, I review the recipient, currency, service fee and total. Proposing the payment already counts as my approval. The request now waits for another signer; the money has not moved.

**Español**

> Elijo USDC, selecciono nuestro proveedor e introduzco el importe. Antes de firmar, reviso el destinatario, la moneda, la comisión de servicio y el total. Solicitar el pago ya cuenta como mi aprobación. Ahora falta otra persona: el dinero todavía no se ha enviado.

## 1:10–1:45 · Approve together / Aprobar en equipo

**Pantalla:** corte identificado a B, misma dirección de bóveda. B abre la solicitud, revisa sus datos y firma **Approve and pay / Aprobar y pagar**. Muestra **Paid / Pagado**, el recibo en Stellar y el contador actualizado del contacto. C no necesita aprobar este ejemplo de 2 de 3.

**English**

> My teammate opens that same request and reviews the payment. Their approval meets our two-of-three rule and, with sufficient funds available, sends it in the same transaction. There is no separate execution step in this flow. We can open the Stellar receipt, and the supplier's confirmed payment count updates for the team.

**Español**

> Mi compañero abre esa misma solicitud y revisa el pago. Su aprobación completa la regla de dos de tres y, al haber fondos suficientes, lo envía en la misma transacción. En este recorrido no hay un paso adicional para ejecutar. Abrimos el recibo en Stellar y el contador del proveedor se actualiza para todo el equipo.

## 1:45–2:10 · Visible costs / Costes visibles

**Pantalla:** revisión capturada del pago y recibo correspondiente. Para el patrocinio, muestra el resultado real de esa operación; solo resalta el patrocinador si el recibo confirma una transacción fee-bump. No presentes la comisión reservada como una transferencia al recaudador.

**English**

> The service fee is 0.25 percent. It is reserved inside the vault when the payment completes, and collected separately. Network fees are different: SoroSafe sponsors eligible operations when available; otherwise the signer needs XLM. Sponsorship has limits and excludes vault creation.

**Español**

> La comisión de servicio es del 0,25 por ciento. Queda reservada en la bóveda al completar el pago y se recauda después. El coste de red es distinto: SoroSafe patrocina operaciones admitidas cuando puede; en caso contrario, el firmante necesita XLM. Hay límites y crear la bóveda no está patrocinado.

## 2:10–2:35 · One address, team rules / Una dirección, reglas del equipo

**Pantalla:** toma breve de la creación de esta misma bóveda, grabada durante la preparación, y transición etiquetada a la bóveda ya configurada. En **People and approvals / Personas y aprobaciones**, enseña los tres miembros y el umbral. No hace falta ejecutar un cambio de equipo durante el video principal.

**English**

> Getting started takes a vault name and a creation signature. You can begin alone, then add signers and change the approval rule while keeping the address. Later changes require the existing quorum. Soroban contracts enforce these rules; SoroSafe has no privileged withdrawal key. Native Stellar multisig also supports quorum protection.

**Español**

> Para empezar, das un nombre a la bóveda y firmas su creación. Puedes comenzar solo, añadir firmantes y cambiar las aprobaciones conservando la dirección. Los cambios posteriores necesitan el umbral vigente. Soroban aplica estas reglas y SoroSafe no tiene una clave privilegiada para retirar fondos. La multifirma nativa de Stellar también protege mediante umbrales.

## 2:35–3:00 · Available today / Disponible hoy

**Pantalla:** recibo, selector de idioma y cierre con `testnet.sorosafe.app`. Rótulos pequeños: **Testnet · Not independently audited** / **Testnet · Sin auditoría independiente**. Si aparece USDT0, añade **SoroSafe-issued test token** / **Token de prueba emitido por SoroSafe**.

**English**

> Built with Soroban, Stellar Asset Contracts, Freighter, SEP-10 sign-in and fee-bump sponsorship. Available in English and Spanish on Testnet, without an independent audit yet. This demo uses Circle's test USDC; test USDT0 is SoroSafe-issued. SoroSafe: one vault, shared contacts, payments approved together.

**Español**

> Usamos Soroban, Stellar Asset Contracts, Freighter, acceso SEP-10 y patrocinio fee-bump. Disponible en inglés y español en Testnet, todavía sin auditoría independiente. Usamos USDC de prueba de Circle; el USDT0 de prueba es emitido por SoroSafe. Una bóveda, contactos compartidos y pagos aprobados en equipo.

## Ritmo y verificación

- Ajusta la voz a un máximo de tres minutos; conserva pausas para leer la revisión del pago y el estado pendiente. Si falta tiempo, recorta la creación antes que el recorrido entre compañeros.
- No uses «todos tienen que estar conectados», «nadie necesita XLM», «sin riesgo», «sin puertas traseras» ni una comparación que presente los contratos como automáticamente superiores a la multifirma nativa.
- El video documenta transacciones reales de **Testnet**. No implica uso por clientes, auditoría externa ni disponibilidad en Mainnet.
- La libreta y los nombres son datos compartidos de la aplicación. Los pagos confirmados y las reglas se verifican en Stellar; no afirmes que todos los contactos están almacenados en el contrato.
