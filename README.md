# Junto

Wallet multifirma de Stellar para equipos. Una invitación abre la misma bóveda, los contactos son compartidos y cada pago explica quién cobra, cuánto y por qué.

**Mainnet es la red predeterminada.** La implementación usa multifirma nativa; no despliega un contrato Soroban. El recorrido con fondos de mainnet y la extensión Freighter del usuario aún requiere verificación. No se ha realizado una auditoría independiente.

## Lo que funciona

- Crear una bóveda pide nombre e identidad. En Equipo y ajustes se definen 2–20 integrantes y el umbral de aprobaciones, antes de invitar.
- Acceso con Freighter mediante Stellar Web Authentication (SEP-10). Entrar no autoriza movimientos de fondos.
- Una sola transacción crea la cuenta, aporta su reserva, configura firmantes y desactiva la clave maestra. El creador revisa el aporte y la comisión antes de firmar desde su wallet.
- El aporte se calcula con las reservas y comisiones actuales de Stellar, incluye espacio para el equipo y las monedas del catálogo, y permanece en la bóveda.
- Libreta compartida con autor, dirección, memo e historial de pagos confirmados desde Junto.
- Pagos con firmas independientes, comprobación del contenido, envío al alcanzar el umbral y recibo en Stellar.
- ES/EN, interfaz móvil y almacenamiento compartido en D1. Ningún saldo, contacto o integrante es simulado.

## XLM, USDC y USDT0

La cuenta muestra los activos que realmente tiene habilitados y los saldos consultados en Horizon. USDC y USDT0 se habilitan desde el catálogo mediante una operación `changeTrust` que requiere el mismo umbral del equipo. Antes de firmar se muestran emisor, red, reserva adicional y comisión. Habilitar no compra tokens ni paga al emisor.

Emisores oficiales de mainnet:

- USDC / Circle: `GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN`.
- USDT0: `GATISXX6BZ6NC7IKQBY37CJD4SOZL3CYZJWXEDG6JVIY4WBS6KXJHN6Q`.

Los logos originales están en `public/assets/`, con procedencia en `SOURCES.md`. Se eligen por **red, código y emisor**, no por ticker. Los activos desconocidos conservan un identificador genérico.

Un envío iniciado desde una moneda fija su código y emisor. El envío general exige elegirla. Si el activo deja de estar disponible, se bloquea la acción sin sustituirlo por XLM. El servidor calcula saldos disponibles, reservas y comisiones con enteros de siete decimales. No hay total ficticio en dólares.

## Ejecutar localmente

Node 22.13 o posterior. En una base nueva:

```sh
npm ci
npm run db:local
npm run db:local:upgrade
node scripts/setup-local-auth.mjs
npm run dev -- --host 127.0.0.1 --port 8789
```

Abrir `http://localhost:8789`. En una base existente que ya tiene `0000`, ejecutar únicamente `db:local:upgrade` una vez. Las migraciones SQL manuales no se deben repetir. Sites incluye `drizzle/` en el build para migrar la base al publicar.

Mainnet requiere Freighter en Mainnet y XLM disponibles en la wallet del creador. Una wallet distinta por integrante. Junto nunca pide semillas. No enviar fondos a una bóveda en preparación: el botón de activación financia y protege la cuenta en la misma transacción.

`JUNTO_NETWORK` admite `mainnet` (predeterminado) o `testnet`. Para pruebas automatizadas, añadir `JUNTO_NETWORK=testnet` en `.dev.vars` y reiniciar. Restaurar `mainnet` y reiniciar al terminar. Las bóvedas anteriores se conservan como Testnet; no se reinterpretan como cuentas de Mainnet. Las sesiones están vinculadas a la red.

## Validación

```sh
npm run typecheck
npm run lint
npm run build
# Servidor local configurado explícitamente en Testnet:
npm run test:auth
npm run test:integration
npm run test:tokens
```

Las suites comprueban la red antes de actuar. Crean wallets y transacciones reales en Testnet, sin usar fondos del usuario. Se conservan direcciones y recibos públicos, nunca claves.

- 34 comprobaciones de autenticación: dominio, red, firmas, caducidad, reuso y revocación.
- 90 de integración: aislamiento, multifirma impuesta por Stellar, pagos nativos y emitidos, identidad de emisor, importes, firmas insuficientes y duplicados.
- 38 de activación y monedas: creación atómica financiada, clave maestra desactivada, continuidad de activación, comprobación del contenido antes de firmar y habilitación real de USDC de Circle en Testnet con firmas independientes.

Evidencias en `docs/auth-evidence.json`, `docs/testnet-evidence.json` y `docs/token-workflows-evidence.json`. La integración con mainnet utiliza los emisores oficiales; estas pruebas no equivalen a haber ejecutado pagos de USDC o USDT0 en mainnet con Freighter.

## Arquitectura y límites

React, Vinext/Vite, Cloudflare Workers/D1, Stellar SDK, Horizon y Freighter. El servidor coordina solicitudes y firmas; Stellar impone el umbral de la cuenta. No se necesita Soroban para custodiar XLM o estos activos clásicos bajo multifirma.

SEP-10 usa un desafío firmado por el servidor, dominio/red verificados, firma individual, caducidad y uso único. El navegador utiliza una cookie HttpOnly revocable; clientes API pueden usar Bearer. `STELLAR_AUTH_SIGNING_SEED` y `STELLAR_AUTH_ORIGIN` se configuran por entorno y no se incluyen en el build. La clave de autenticación no controla fondos. La clave de arranque de una nueva bóveda existe solo en memoria al preparar la transacción; se conserva su firma, no su secreto, y pierde autoridad en la misma operación de creación.

- Una operación pendiente por bóveda; vence a las 24 horas. Sin cancelación anticipada, lotes ni gestión avanzada de secuencias.
- Sin cambios de firmantes/umbral en la interfaz después de activar; sin recuperación ni compatibilidad con hardware validada.
- Freighter integrado; correo, passkeys y otras wallets pendientes. SEP-10 es un estándar, no un servicio de registro alojado por Stellar.
- Contactos compartidos e inmutables. Los nombres son elegidos por la persona, no identidades KYC. El historial cuenta pagos creados en Junto.
- La activación preparada puede retomarse tras recargar, sin conservar una clave temporal del navegador.
- Auditoría, recuperación, copias de seguridad y pruebas de dispositivos siguen pendientes.

Antes del hackathon: prueba con personas nuevas, recorrido completo con Freighter, repositorio público y video de hasta tres minutos. Find Your Way cierra el **5 de octubre de 2026 a las 18:00 de Caracas**. Contexto en `PLAN.md`.
