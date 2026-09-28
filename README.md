# Junto

Una wallet multifirma de Stellar para equipos. Una invitación abre la misma bóveda, los contactos son compartidos y cada pago explica quién cobra, cuánto y por qué.

**MVP funcional, exclusivamente en Stellar Testnet.** El nombre es provisional. No es una wallet auditada para dinero real.

## Lo que funciona

- Crear una bóveda solo pide su nombre y el de la persona. Equipo y ajustes permite definir 2 a 20 integrantes y las aprobaciones antes de invitar o activar.
- Invitación a la bóveda existente, sin crear otro workspace.
- Acceso con Freighter mediante Stellar Web Authentication (SEP-10), con wallet temporal para pruebas. El ingreso no autoriza pagos.
- Activación de una cuenta multifirma nativa. Stellar impone el umbral y la clave maestra pierde su autoridad.
- Libreta compartida con autor, dirección, memo e historial de pagos confirmados desde Junto.
- Preparación, revisión, firmas independientes, envío y recibo de pagos reales de testnet.
- Datos persistentes en D1, verificación de membresía en servidor y textos ES/EN.
- Interfaz adaptable a móvil: Resumen, Pagos, Contactos y Equipo y ajustes.

## Ejecutar localmente

Requiere Node 22.13 o posterior y conexión a Stellar Testnet.

```sh
npm ci
npm run db:local
node scripts/setup-local-auth.mjs
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
npm run test:auth
```

La prueba de integración requiere el servidor en el puerto 8789. Genera cuentas nuevas y transacciones de testnet; no usa fondos ni wallets de personas. Conserva solo direcciones públicas y recibos en `docs/testnet-evidence.json`.

Prueba ejecutada: **64 comprobaciones de integración y 34 de autenticación aprobadas**, incluida la negativa de Stellar a aceptar una sola firma y la confirmación al alcanzar el umbral. Se verificaron identidad, acceso ajeno, contenido alterado, duplicación de firmas y de envíos, y actualización del historial del contacto. Además se completó el recorrido desde el navegador y se revisaron las vistas en ES/EN y móvil.

## Cómo está organizado

- `app/page.tsx`: interfaz y recorridos bilingües.
- `app/api/junto/route.ts`: permisos, colaboración, configuración de borradores y coordinación de pagos.
- `app/api/auth/route.ts` y `lib/auth.ts`: SEP-10, JWT y sesiones revocables.
- `lib/stellar.ts`: construcción y verificación de transacciones de Stellar.
- `lib/client-wallet.ts`: firma del lado del usuario y activación de testnet.
- `db/schema.ts` y `drizzle/`: datos compartidos y migraciones.
- `PLAN.md`: producto, decisiones, alcance y hackathon confirmado.

React, Vinext/Vite, Cloudflare Workers/D1, Stellar SDK, Horizon, Friendbot y Freighter. La identidad se comprueba con SEP-10 mediante el SDK oficial de Stellar: desafío firmado por el servidor, validación del dominio/red en el cliente, firma individual, caducidad y uso único. Se publica `/.well-known/stellar.toml` y se emite un JWT EdDSA; el navegador usa una cookie HttpOnly y los clientes API pueden usar Bearer. Se admiten identidades individuales G; no cuentas muxed, memos ni client attribution. Las claves de las wallets nunca llegan al servidor. La clave de autenticación del servidor es independiente y no controla fondos.

El servidor requiere `STELLAR_AUTH_SIGNING_SEED` como secreto y `STELLAR_AUTH_ORIGIN` como origen canónico (sin barra final). El script local crea una clave exclusivamente de desarrollo en `.dev.vars`, ignorado por Git. En Sites se configuran valores independientes como variables de ejecución; el secreto no se incluye en el build.

## Límites de esta versión

- El recorrido validado usa **XLM**. El código contempla pagos de activos emitidos ya habilitados en la cuenta, pero aún no incluye un flujo para habilitar USDC/USDT, obtenerlos ni elegir su emisor. No se afirma que ese recorrido esté validado.
- Solo hay un pago pendiente a la vez por bóveda. Una firma vence a las 24 horas. Todavía no hay cancelación anticipada, lotes ni gestión de secuencias avanzada.
- No hay acceso por correo ni passkeys. SEP-10 es un estándar de Stellar, no un servicio de identidad alojado por Stellar. Freighter requiere extensión.
- No permite cambiar firmantes ni umbrales después de activar. Tampoco hay recuperación de claves, firma con hardware validada o acceso con passkeys.
- Los contactos son compartidos e inmutables en esta versión. Su autor es una identidad de wallet con nombre elegido por el usuario, no una identidad verificada mediante KYC.
- El contador del contacto incluye pagos confirmados creados en Junto; no indexa toda la actividad histórica externa de la cuenta.
- Si se cierra la página durante la configuración, antes de confirmar la activación, puede ser necesario crear otra bóveda de prueba. No depositar fondos durante ese estado.
- Freighter está integrado, pero falta probar el recorrido con la extensión instalada en el navegador del usuario. Las pruebas automáticas firman con claves efímeras de testnet.
- El prototipo necesita auditoría independiente, recuperación, controles de abuso, copias de seguridad y pruebas de compatibilidad antes de considerar mainnet.

El rendimiento de stablecoins se estudiará como una operación que el equipo aprueba, después de elegir un protocolo real. No se anuncia staking, rendimiento ni compatibilidad universal con hardware.

## Antes de enviar al hackathon

Probarlo con personas nuevas sin explicarles el recorrido; completar la integración de una stablecoin y el ensayo con Freighter; publicar el repositorio open source y grabar un video de máximo tres minutos. El cierre confirmado de Find Your Way es el **5 de octubre de 2026 a las 18:00 de Caracas**.
