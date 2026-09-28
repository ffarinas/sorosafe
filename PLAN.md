# Junto — una wallet multifirma para humanos

## Producto

Una bóveda es el lugar compartido para el dinero de un equipo. Al recibir una invitación, la persona entra a esa bóveda; nunca se le pide crear otro espacio de trabajo. Se mantienen el control colectivo y las firmas independientes, con palabras que las personas entiendan.

Caso de uso inicial: un equipo gestiona sus gastos para Meridian 2026 en Lisboa. Una persona prepara un pago al alojamiento; las demás reconocen al proveedor y aprueban. El pago sale únicamente cuando la red valida las firmas necesarias.

## Hackathon confirmado el 28 de septiembre de 2026

Recuperado de la conversación «Locate Find Your Way hackathon» y contrastado con la API pública de Stellar Passport.

- Evento: Find Your Way: Hackathon, preparación para HackMeridian.
- Cierre: 5 de octubre de 2026, 22:00 UTC / 18:00 Caracas. Sustituye la fecha antigua del 30 de septiembre.
- General Track: admite wallets, pagos, herramientas e identidad; no exige añadir un contrato Soroban a toda aplicación.
- Evaluación: ejecución técnica, uso significativo de Stellar, originalidad, impacto, experiencia de usuario y presentación.
- Entrega: nombre, descripción, track, correo, repositorio open source, video de máximo 3 minutos y enlaces opcionales.
- Equipos de 1 a 5 personas.
- Fuente: https://demo.stellarpassport.xyz/api/hackathons/find-your-way-meridian-hackathon
- Ficha: https://demo.stellarpassport.xyz/hackathons/find-your-way-meridian-hackathon

## Recorrido y alcance

1. **Crear:** nombre de la bóveda, nombre de la persona y wallet. Sin un workspace previo.
2. **Configurar dentro de la bóveda:** en Equipo y ajustes, el creador define integrantes y aprobaciones. Una bóveda nueva queda sin regla ni enlace de invitación (size=0, threshold=0) hasta guardar esta configuración. Las reglas son editables solo en borrador; guardarlas invalida enlaces anteriores, sin eliminar integrantes.
3. **Invitar:** enlace a esa bóveda. La persona ve a qué equipo entra y conecta su propia wallet. Unirse como firmante se confirma antes de activar la bóveda.
4. **Activar:** revisar integrantes y regla configurable. Cada firmante tiene el mismo peso. La clave temporal de creación pierde toda autoridad al activar.
5. **Compartir contactos:** nombre, dirección y memo cuando corresponda. Autor visible. El historial indica si esa dirección ya recibió pagos confirmados de la bóveda.
6. **Pagar:** elegir contacto, importe, activo y motivo; revisar un resumen antes de solicitar firmas.
7. **Aprobar:** mostrar importe, dirección completa, activo, memo, coste y regla. Cada firma corresponde exactamente a esa transacción. Al alcanzar el umbral, se envía a Stellar.
8. **Consultar:** saldo real, pagos pendientes y confirmados, recibo verificable, contactos y equipo.

La primera implementación utiliza exclusivamente Stellar Testnet. Los fondos de prueba no son dinero real. No se importan semillas de usuarios ni se almacenan claves privadas de usuarios en el servidor.

## Diseño

- Marca provisional: Junto.
- Negro, blanco y grises neutros, sin amarillo. Títulos Lora y controles Inter, con espacios amplios, divisores finos, bloques de contraste y botones ovalados. La referencia es la página de Stellar Consensus Protocol; Junto mantiene su marca propia.
- Cuatro vistas: resumen, pagos, contactos, equipo y ajustes.
- En la portada de una bóveda solo saldo, acciones de enviar/recibir y tareas pendientes.
- Español e inglés completos, incluidos estados, errores y confirmaciones.
- Móvil y teclado tratados como recorridos principales.
- El video de Safe es una referencia de funciones y fricciones, no material promocional ni una prueba de que ninguna edición de Safe pueda compartir contactos. Safe Workspaces ya tiene funciones compartidas; la diferencia buscada es que lo compartido sea la opción evidente y predeterminada.

## Base de Stellar

- Multifirma nativa: firmantes y umbrales aplicados por la red, también a cambios de control.
- Stellar SDK: creación, lectura, comprobación y combinación de firmas de transacciones.
- Freighter: conexión y firma sin entregar claves a Junto. La capa de firma queda separada para añadir Wallets Kit y dispositivos después de probar cada combinación.
- Horizon en testnet: estado de cuentas, activos, pagos y recibos.
- Friendbot: fondos de prueba para activar cuentas de la demostración.
- XLM y activos emitidos presentes en la cuenta. No usar un ticker como garantía del emisor; cada activo conserva código + emisor.
- Soroban/Passkey Kit: no son necesarios para el primer recorrido de multifirma nativa. Se estudiarían al incorporar cuentas inteligentes, passkeys o un protocolo de rendimiento.

## Monedas: alcance definido, validación posterior en mainnet

USDC y USDT0 quedan contemplados como monedas de uso diario de la bóveda. Para el hackathon basta con dejar definido su manejo; no se exige que funcionen en Testnet ni crear tokens de prueba. La demostración funcional continúa con XLM. Las pruebas con los tokens se harán en una etapa posterior en mainnet.

El recorrido ya tiene una vista interactiva en `/preview/monedas`, con datos de ejemplo y sin operaciones en la red. La integración real todavía está pendiente:

- Gestionar las monedas dentro de la bóveda, con un catálogo inicial de XLM, USDC y USDT0. Las monedas habilitadas y sus saldos serán compartidos por todo el equipo.
- Identificar cada activo por red, código y emisor verificado. Mostrar nombres reconocibles y dejar los identificadores completos en los detalles.
- Habilitar una moneda mediante una solicitud que cumpla la regla de aprobaciones de la bóveda. Explicar cualquier reserva y comisión antes de firmar.
- Mostrar saldos por moneda y distinguir XLM disponible de XLM reservado para la cuenta. Un total convertido a dólares, si se incorpora, será una estimación con cotizaciones.
- Al recibir, elegir la moneda y mostrar claramente Stellar como red; comprobar que la bóveda puede recibir ese activo.
- Al pagar, elegir contacto, moneda e importe; comprobar la disponibilidad de saldo y que el destinatario pueda recibirlo antes de solicitar firmas.

La integración posterior se validará en mainnet con los emisores oficiales: habilitación, recepción, saldos y pago multifirma. El prototipo actual permanece en Testnet y no presenta esos recorridos como ya disponibles o probados.

## Colaboración y seguridad

- Base compartida persistente para membresía, contactos y transacciones pendientes. El almacenamiento local no decide permisos ni representa el saldo.
- Autenticación SEP-10 con Freighter: firma del servidor, validación de dominio/red, firma de la persona, caducidad y uso único del desafío. JWT y sesión HttpOnly revocable. No se presenta como un servicio oficial de registro por correo. Entrar al panel no equivale a autorizar un pago.
- Toda lectura y escritura de una bóveda exige membresía comprobada en servidor.
- La invitación no permite alterar una bóveda ya activa ni sustituir firmantes.
- La activación comprueba en la red todos los firmantes, umbrales y ausencia de una clave maestra con autoridad.
- La dirección y el memo de un pago se guardan como una instantánea. Un contacto no puede cambiar una transacción ya creada.
- Rechazar firmas duplicadas, de personas ajenas, de otra red o de contenido modificado. Usar exactamente las firmas necesarias al enviar.
- Controlar vencimiento, secuencia y doble envío. Nunca mostrar «Pagado» antes de una confirmación verificable de Stellar.
- Una propuesta de pago activa por bóveda en esta primera versión, para explicar la cola y evitar conflictos de secuencia.
- Cambios de firmantes, recuperación avanzada, firmas con hardware y auditoría independiente son trabajo posterior antes de aceptar dinero real. No confundir el MVP con una wallet de producción auditada.

## Orden de ejecución

1. Interfaz de creación, diseño y textos bilingües.
2. Persistencia compartida, identidad por firma e invitaciones.
3. Activación real de una bóveda multifirma en testnet.
4. Contactos y ciclo de pago con firmas reales.
5. Pruebas de aislamiento, firmas inválidas, umbral insuficiente, duplicados y confirmación.
6. Prueba visual y de recorridos en navegador; instrucciones reproducibles y evidencia de testnet.
7. Prueba con dos personas nuevas; corregir los puntos donde necesiten explicación. Después preparar repositorio público y video de entrega con autorización para publicar.

## Rendimiento: ampliación, no parte de la navegación inicial

El ejemplo «Pedro quiere colocar 1.000 USDT» debe convertirse en una propuesta que el equipo revise y firme, igual que un pago. Solo después de la confirmación se muestra la posición y su valor. Hay que seleccionar el protocolo, activo exacto, forma de retiro y riesgos. No llamar staking nativo a prestar stablecoins o depositarlas en una estrategia. No mostrar APY inventado ni funciones deshabilitadas para rellenar la pantalla.

## Criterios de aceptación

- Una persona invitada identifica la bóveda y entra sin crear otra.
- Un contacto creado por A aparece para B con autor y estado de pagos previo.
- B propone un pago sin copiar una dirección fuera de la libreta.
- La red rechaza un pago con firmas insuficientes y acepta el mismo contenido al alcanzar el umbral.
- Recargar no pierde contactos ni propuestas.
- Un usuario de otra bóveda no puede leerlos ni modificarlos.
- Todo el recorrido funciona en ES/EN y en pantalla estrecha.
- El manejo previsto de USDC y USDT0 queda documentado. Su funcionamiento en Testnet no es un criterio de aceptación del hackathon.

## Fuentes técnicas

https://developers.stellar.org/docs/learn/fundamentals/transactions/signatures-multisig
https://developers.stellar.org/docs/build/guides/freighter

## Estado de ejecución · 28 de septiembre de 2026

Los pasos 1 a 6 están implementados. El MVP ya realiza pagos reales de Stellar Testnet con firmas independientes; no es una simulación de aprobaciones. Pasaron 64 comprobaciones de integración y 34 de autenticación; un pago completo de 65 XLM se confirmó después del recorrido en navegador. La evidencia está en `docs/testnet-evidence.json`, `docs/auth-evidence.json` y `docs/browser-evidence.json`.

La siguiente iteración prioriza una prueba con personas nuevas y probar Freighter de extremo a extremo. El manejo de stablecoins queda definido; su integración y pruebas se reservan para una etapa posterior en mainnet. Después: acceso duradero más sencillo, recuperación y validación por modelo de hardware. El alcance probado, las instrucciones y las limitaciones están en `README.md`.
