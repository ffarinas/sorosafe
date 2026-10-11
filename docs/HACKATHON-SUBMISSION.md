# SoroSafe — hackathon submission copy

Prepared for Find Your Way: Hackathon. This file contains copy for submission; it does not confirm that the public entry has been updated.

- **Project:** SoroSafe
- **English tagline:** A multisig vault for teams, on Stellar.
- **Tagline en español:** Una bóveda multifirma para equipos, en Stellar.
- **Live app:** https://testnet.sorosafe.app
- **Repository:** https://github.com/ffarinas/sorosafe
- **Demo recording guide:** [VIDEO-SCRIPT.md](VIDEO-SCRIPT.md)
- **Security and limitations:** [CONTRACT-SECURITY.md](CONTRACT-SECURITY.md)

## English description

SoroSafe is a multisig vault for teams on Stellar: one address for shared funds, one address book, and clear approval rules.

Managing team money means coordinating recipients, payment requests and approvals. SoroSafe brings that work together. One teammate saves a supplier, another prepares the payment, and the required signers review it from their own wallets. Everyone sees who added each contact and how many confirmed payments that address has received from the vault.

Before signing, members see the recipient, asset, amount and fees. Proposing counts as an approval; when funds cover the payment and fee, the final required approval also sends it. Unfunded requests remain pending. Teams can choose up to 20 signers and change their rules through the current quorum, keeping the same vault address.

Soroban contracts enforce payments and team changes without a privileged creator or SoroSafe withdrawal key. The app uses Stellar Asset Contracts, Freighter with SEP-10, Stellar RPC and fee-bump sponsorship. English and Spanish are available, along with temporary browser wallets for trying Testnet without an extension.

Network-fee sponsorship has limits; the signer needs XLM when it is unavailable. Outgoing payments carry a separate 0.25% service fee, reserved in the vault for later collection.

The live app runs only on Testnet, using test XLM, Circle Testnet USDC and SoroSafe-issued test USDT0. These funds have no real value. The contracts have not been independently audited.

## Descripción en español

SoroSafe es una bóveda multifirma para equipos en Stellar: una dirección para los fondos compartidos, una libreta y reglas de aprobación claras.

Administrar dinero en equipo requiere coordinar destinatarios, solicitudes y aprobaciones. SoroSafe reúne ese trabajo. Una persona guarda un proveedor, otra prepara el pago y los firmantes necesarios lo revisan desde sus propias wallets. Todos ven quién añadió cada contacto y cuántos pagos confirmados ha recibido esa dirección desde la bóveda.

Antes de firmar, cada miembro ve destinatario, activo, importe y comisiones. Proponer cuenta como aprobación; si hay fondos para el pago y la comisión, la última aprobación necesaria también lo envía. Las solicitudes sin fondos quedan pendientes. El equipo puede tener hasta 20 firmantes y cambiar sus reglas con el quórum vigente, conservando la dirección.

Los contratos Soroban aplican pagos y cambios de equipo sin poderes especiales de retiro para el creador ni SoroSafe. La app integra Stellar Asset Contracts, Freighter con SEP-10, Stellar RPC y patrocinio mediante fee-bump. Está disponible en inglés y español, con wallets temporales del navegador para probar Testnet sin extensión.

El patrocinio de red tiene límites; si no está disponible, el firmante necesita XLM. Los pagos salientes llevan una comisión de servicio aparte del 0,25 %, reservada en la bóveda para su recaudación posterior.

La app funciona solo en Testnet con XLM de prueba, USDC de Testnet de Circle y USDT0 de prueba emitido por SoroSafe. Estos fondos no tienen valor real. Los contratos no han pasado una auditoría independiente.
