<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="public/brand/sorosafe-logo-white.svg">
    <img src="public/brand/sorosafe-logo.svg" alt="SoroSafe" width="360">
  </picture>
</p>

# SoroSafe

[English](README.md) · Español

Bóvedas multifirma de Stellar para equipos: una dirección compartida, contactos compartidos y pagos que se entienden antes de firmar.

Las bóvedas nuevas usan **contratos Soroban**. Las cuentas multifirma nativas anteriores conservan su recorrido. Mainnet es la red predeterminada de la aplicación, pero **el contrato se ha desplegado y probado únicamente en Testnet**. La fábrica de Mainnet requiere configurar comisión, destinatario y firmar su despliegue. No se ha realizado una auditoría independiente.

## Funcionamiento

- Crear una bóveda pide nombre e identidad; la regla y el equipo se configuran dentro de ella, antes de invitar. Una invitación abre la misma bóveda.
- Activar despliega un contrato C… desde una fábrica verificable. No existe una clave inicial con privilegios de retiro.
- Quien crea la bóveda empieza como único firmante (1 de 1) y puede usarla al momento; después añade hasta 20 firmantes y fija el umbral de 1 a N, con la misma dirección. Propuestas, aprobaciones, cancelaciones y cambios de equipo quedan en Stellar. Quien propone ya cuenta como la primera aprobación: no firma dos veces.
- Pago y comisión se ejecutan de forma atómica. La comisión es adicional al importe del destinatario y se cobra en la misma moneda. Los costes de red se pagan en XLM desde la wallet que envía cada transacción.
- Cambiar los firmantes requiere el quórum actual y conserva la dirección de la bóveda. Las solicitudes anteriores quedan invalidadas.
- La pantalla `/contract?network=mainnet&address=C…` puede leer y operar sin sesión ni base de datos de SoroSafe. La libreta compartida y los nombres siguen siendo datos de colaboración en D1.
- Freighter integrado; no se piden semillas. Correo, passkeys y cobertura de hardware siguen pendientes de implementar/probar. Español e inglés.

## Activos

El catálogo de Mainnet conserva los emisores oficiales de XLM, USDC y USDT0 y sus logos originales. Se usan sus direcciones SAC determinísticas; un ticker por sí solo no identifica un token. Las bóvedas contractuales no necesitan trustlines propias. El destinatario y la cuenta de comisiones G… sí deben poder recibir la moneda.

Enviar desde un activo conserva su identidad. El cliente verifica función, contrato, destinatario e importe antes de pedir una firma. Los SAC oficiales de Mainnet se comprobaron sin mover fondos; las direcciones y decimales están en `docs/mainnet-sac-readonly-evidence.json`. Los balances vienen de Stellar; no hay saldos, integrantes o pagos ficticios. Añadir fondos usa una transferencia SAC desde la wallet. **No enviar un pago clásico a una dirección C… ni usar un exchange que exija memo.**

V1 restringe las transferencias a la lista de SAC definida al desplegar la fábrica. No tiene ejecución arbitraria, allowances, staking ni actualizaciones administrativas. Las implicaciones de esta restricción y del destinatario fijo de comisiones están en [el modelo de seguridad](docs/CONTRACT-SECURITY.md).

## Desarrollo

Node 22.13+, Rust 1.94.1, target `wasm32v1-none` y Stellar CLI 25.2.0+.

```sh
npm ci
# Solo en una base nueva; no repetir migraciones aplicadas.
npm run db:local
npm run db:local:upgrade
npm run db:local:contracts
npm run db:local:auth
npm run db:local:auth-limits
npm run db:local:attempts
node scripts/setup-local-auth.mjs
npm run dev -- --host 127.0.0.1 --port 8789
```

Publicada en https://testnet.sorosafe.app (Cloudflare Workers + D1). `npm run deploy:testnet` compila y despliega; `deploy/redirect` envía `sorosafe.app` a Testnet hasta el lanzamiento en Mainnet.

Para la demo en Testnet: `npm run contracts:deploy-testnet` despliega una fábrica con XLM y USDC de prueba y comisión de 25 bps, con cuentas temporales de Friendbot, y guarda el resultado en `docs/testnet-demo-factory.json`. La fábrica actual es `CDBS4UB4EQ4HZNRCA5LVFFFM3ELQCSLF2XHSKP6VE35XZRJRBCT3YIGM`.

En `.dev.vars` (no versionado): `JUNTO_NETWORK=mainnet|testnet` y `JUNTO_FACTORY=C…` de la red correspondiente. No usar una fábrica de Testnet en Mainnet. Sin fábrica, se puede preparar el equipo, pero activar una bóveda contractual permanece bloqueado con un mensaje explícito. El despliegue de la app no firma transacciones ni despliega contratos por sí mismo.

La autenticación SEP-10 usa `STELLAR_AUTH_SIGNING_SEED` y `STELLAR_AUTH_ORIGIN`. Esa clave autentica desafíos; no custodia fondos. Las sesiones y bóvedas están separadas por red. Las migraciones publicadas se incluyen en el build de Sites.

## Compilar y verificar

```sh
npm run contracts:build
npm run contracts:test
npm run contracts:audit
npm run contracts:client
node tests/contracts-client.mjs
npm run test:audit-regressions
npm run test:soroban
npm run typecheck
npm run lint
npm run build
```

`contracts:build` usa el lockfile y copia WASM y hashes a `public/contracts/` y `lib/contract-artifacts.json`. La app verifica los hashes de la fábrica y la bóveda antes de operar. `test:soroban` actúa exclusivamente en Testnet con wallets reales financiadas por Friendbot y claves efímeras que no se guardan.

`test:audit-regressions` verifica los handlers reales, las migraciones SQLite y firmas SEP-10 en 24 casos aislados. Cubre activaciones con un equipo incorrecto (y su descarte por el creador), revocación de miembros, fallos de RPC y de escritura, cambios simultáneos del equipo y límites de login. Sustituye únicamente las respuestas externas de Stellar y el adaptador D1; no envía transacciones ni valida el contrato Rust. `test:auth` verifica además el servicio HTTP en Testnet; acepta `JUNTO_TEST_BASE` y `JUNTO_TEST_EVIDENCE` para usar un servidor y resultados aislados.

El límite de desafíos es de 30 solicitudes por cliente cada cinco minutos, compartido entre cuentas. No se reinicia al consumir un desafío y no elimina los intentos pendientes de otras personas. Las migraciones `0003`, `0004` y `0005` deben aplicarse antes de ejecutar esta versión. Si Stellar o la sincronización de miembros falla, el servidor rechaza el acceso a la libreta compartida hasta poder verificarlo.

Evidencia actual: 19 pruebas Rust, 20 comprobaciones de flujo real en Testnet, 19 de integración del alta y 10 del cliente. [Recibos de Testnet](docs/soroban-testnet-evidence.json). Las suites antiguas `test:integration` y `test:tokens` documentan el recorrido nativo anterior; no describen el contrato nuevo y deben ejecutarse contra esa versión, no tratarse como validación Soroban.

## Preparar Mainnet

La herramienta de operador genera **XDR sin firmar**, nunca transmite ni recibe claves:

```sh
npm run contracts:client
node scripts/prepare-protocol.mjs --network mainnet --source G… --step upload-vault --out qa/upload-vault
node scripts/prepare-protocol.mjs --network mainnet --source G… --step upload-factory --out qa/upload-factory
# Después de confirmar cada carga en Stellar y verificar los SAC:
node scripts/prepare-protocol.mjs --network mainnet --source G… --step factory --collector G… --fee-bps POR_DEFINIR --out qa/create-factory
```

Preparar y confirmar cada paso antes del siguiente, para usar la secuencia actual. Si un SAC oficial aún no está desplegado, `--step asset --asset USDC|USDT0|XLM` prepara su creación determinística. La cuenta de comisiones debe estar financiada y autorizada para recibir los activos. Revisar JSON y XDR, firmar en una wallet propia y verificar el contrato resultante antes de establecer `JUNTO_FACTORY`. `POR_DEFINIR` es deliberadamente inválido: no hay una comisión comercial asumida.

La seguridad del conjunto no está garantizada por usar una biblioteca auditada. Ver [riesgos, dependencias y revisión pendiente](docs/CONTRACT-SECURITY.md). El cierre del hackathon y el contexto de producto se conservan en `PLAN.md`.
