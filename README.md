# Junto

Una wallet multifirma de Stellar para equipos. Una invitación abre la misma bóveda, los contactos son compartidos y cada pago explica quién cobra, cuánto y por qué.

**MVP funcional, exclusivamente en Stellar Testnet.** El nombre es provisional. No es una wallet auditada para dinero real.

## Lo que funciona

- Bóvedas con 2 a 20 integrantes y una regla configurable de aprobaciones.
- Invitación a la bóveda existente, sin crear otro workspace.
- Identidad comprobada con una firma; conexión a Freighter o wallet temporal para pruebas.
- Activación de una cuenta multifirma nativa. Stellar impone el umbral y la clave maestra pierde su autoridad.
- Libreta compartida con autor, dirección, memo e historial de pagos confirmados desde Junto.
- Preparación, revisión, firmas independientes, envío y recibo de pagos reales de testnet.
- Datos persistentes en D1, verificación de membresía en servidor y textos ES/EN.
- Interfaz adaptable a móvil: Resumen, Pagos, Contactos y Equipo.

## Ejecutar localmente

Requiere Node 22.13 o posterior y conexión a Stellar Testnet.

```sh
npm ci
npm run db:local
npm run dev -- --host 127.0.0.1 --port 8789
```

Abrir `http://localhost:8789`. Aplicar `db:local` solo en una base nueva; las migraciones no se deben repetir. La base local está en `.wrangler/state` y no se incluye en el repositorio.

Para probar con varias personas en este equipo, usar perfiles de navegador diferentes, abrir el mismo enlace de invitación y usar una wallet distinta por persona. El servidor local no es una URL compartible por Internet.

**Freighter es la opción recomendada para conservar acceso.** Activar Testnet en la extensión. Junto nunca pide una semilla. La alternativa temporal genera una clave solo en memoria: recargar, cerrar la página o desconectarse la elimina. No usar esa alternativa para una bóveda que se quiera conservar.

Una vez reunido el equipo, el creador revisa los firmantes y activa la bóveda. Friendbot aporta XLM de prueba. El destinatario de un pago debe ser una cuenta activa en Testnet.

## Comprobar

```sh
npm run typecheck
npm run lint
npm run build
npm run test:integration
```

La prueba de integración requiere el servidor en el puerto 8789. Genera cuentas nuevas y transacciones de testnet; no usa fondos ni wallets de personas. Conserva solo direcciones públicas y recibos en `docs/testnet-evidence.json`.

Prueba ejecutada: **49 comprobaciones aprobadas**, incluida la negativa de Stellar a aceptar una sola firma y la confirmación al alcanzar el umbral. Se verificaron identidad, acceso ajeno, contenido alterado, duplicación de firmas y de envíos, y actualización del historial del contacto. Además se completó el recorrido desde el navegador y se revisaron las vistas en ES/EN y móvil.

## Cómo está organizado

- `app/page.tsx`: interfaz y recorridos bilingües.
- `app/api/junto/route.ts`: identidad, permisos, colaboración y coordinación de pagos.
- `lib/stellar.ts`: construcción y verificación de transacciones de Stellar.
- `lib/client-wallet.ts`: firma del lado del usuario y activación de testnet.
- `db/schema.ts` y `drizzle/`: datos compartidos y migraciones.
- `PLAN.md`: producto, decisiones, alcance y hackathon confirmado.

React, Vinext/Vite, Cloudflare Workers/D1, Stellar SDK, Horizon, Friendbot y Freighter. La identidad de wallet se comprueba mediante un desafío de firma de un solo uso; no se presenta como una implementación de SEP-10. Las claves de las wallets nunca llegan al servidor.

## Límites de esta versión

- El recorrido validado usa **XLM**. El código contempla pagos de activos emitidos ya habilitados en la cuenta, pero aún no incluye un flujo para habilitar USDC/USDT, obtenerlos ni elegir su emisor. No se afirma que ese recorrido esté validado.
- Solo hay un pago pendiente a la vez por bóveda. Una firma vence a las 24 horas. Todavía no hay cancelación anticipada, lotes ni gestión de secuencias avanzada.
- No permite cambiar firmantes ni umbrales después de activar. Tampoco hay recuperación de claves, firma con hardware validada o acceso con passkeys.
- Los contactos son compartidos e inmutables en esta versión. Su autor es una identidad de wallet con nombre elegido por el usuario, no una identidad verificada mediante KYC.
- El contador del contacto incluye pagos confirmados creados en Junto; no indexa toda la actividad histórica externa de la cuenta.
- Si se cierra la página durante la configuración, antes de confirmar la activación, puede ser necesario crear otra bóveda de prueba. No depositar fondos durante ese estado.
- Freighter está integrado, pero falta probar el recorrido con la extensión instalada en el navegador del usuario. Las pruebas automáticas firman con claves efímeras de testnet.
- El prototipo necesita auditoría independiente, recuperación, controles de abuso, copias de seguridad y pruebas de compatibilidad antes de considerar mainnet.

El rendimiento de stablecoins se estudiará como una operación que el equipo aprueba, después de elegir un protocolo real. No se anuncia staking, rendimiento ni compatibilidad universal con hardware.

## Antes de enviar al hackathon

Probarlo con personas nuevas sin explicarles el recorrido; completar la integración de una stablecoin y el ensayo con Freighter; publicar el repositorio open source y grabar un video de máximo tres minutos. El cierre confirmado de Find Your Way es el **5 de octubre de 2026 a las 18:00 de Caracas**.
