// What happened and what to do next, in two short sentences at most.
// Never blame the person and avoid jargon. [Spanish (tú), English]
export const errors: Record<string, [string, string]> = {
  CONTRACT_NOT_CONFIGURED: [
    "Todavía no se pueden crear bóvedas en esta red. Vuelve a intentarlo más tarde.",
    "Vaults can't be created on this network yet. Try again later.",
  ],
  CONTRACT_MEMO_UNSUPPORTED: [
    "Todavía no se puede pagar a destinos que piden memo, como algunos exchanges. Paga a una wallet personal.",
    "Destinations that need a memo, like some exchanges, aren't supported yet. Pay to a personal wallet.",
  ],
  CONTRACT_UNAVAILABLE: [
    "No pudimos leer la bóveda en Stellar. Actualiza para volver a intentarlo.",
    "We couldn't read the vault on Stellar. Refresh to try again.",
  ],
  CONTRACT_REJECTED: [
    "Stellar no aceptó esta acción. Revisa el saldo y las aprobaciones y vuelve a intentarlo.",
    "Stellar didn't accept this. Check the balance and approvals, then try again.",
  ],
  CONTRACT_FEE_LIMIT: [
    "El coste de red es más alto de lo habitual ahora mismo. Espera unos minutos y vuelve a intentarlo.",
    "The network fee is higher than usual right now. Wait a few minutes and try again.",
  ],
  UNVERIFIED_CONTRACT: [
    "No reconocemos esta bóveda como una versión verificada de SoroSafe, así que no la abrimos. Consulta con quien te la compartió.",
    "We don't recognize this vault as a verified SoroSafe version, so we didn't open it. Check with whoever shared it.",
  ],
  MAINNET_REQUIRED: [
    "Freighter está en otra red. Abre Freighter, toca el nombre de la red y elige Mainnet.",
    "Freighter is on another network. Open Freighter, tap the network name and choose Mainnet.",
  ],
  TESTNET_REQUIRED: [
    "Freighter está en otra red. Abre Freighter, toca el nombre de la red y elige Test Net.",
    "Freighter is on another network. Open Freighter, tap the network name and choose Test Net.",
  ],
  NETWORK_MISMATCH: [
    "Esta bóveda es de otra red de Stellar. Vuelve a entrar en la red correcta.",
    "This vault is on another Stellar network. Sign in again on the right one.",
  ],
  ASSET_ENABLED: [
    "Esta moneda ya está habilitada. Actualiza para ver los saldos.",
    "This currency is already enabled. Refresh to see the balances.",
  ],
  ACTIVATION_EXPIRED: [
    "El precio calculado caducó. Actualiza en unos segundos y revísalo otra vez.",
    "The quote expired. Refresh in a few seconds and review it again.",
  ],
  ASSET_UNAVAILABLE: [
    "Esta moneda ya no está disponible en la bóveda. Actualiza y vuelve a preparar el pago.",
    "This currency is no longer available in the vault. Refresh and prepare the payment again.",
  ],
  TEST_WALLET_GONE: [
    "La wallet de prueba se borró al cerrar la pestaña. Cierra sesión y empieza otra prueba.",
    "The test wallet was discarded when its tab closed. Sign out and start a new test.",
  ],
  CONFIGURATION_REQUIRED: [
    "Primero configura la bóveda en Equipo y ajustes.",
    "Set up the vault in Team & settings first.",
  ],
  CONFIGURATION_CHANGED: [
    "El equipo cambió mientras tanto. Actualiza y revisa las personas y la regla.",
    "The team changed in the meantime. Refresh and review the people and the rule.",
  ],
  AUTH_UNAVAILABLE: [
    "No se puede entrar en este momento. Vuelve a intentarlo en unos minutos.",
    "Sign-in isn't available right now. Try again in a few minutes.",
  ],
  INVALID_LOGIN: [
    "No pudimos confirmar tu identidad. Vuelve a entrar con tu wallet.",
    "We couldn't confirm your identity. Sign in with your wallet again.",
  ],
  INVALID_INPUT: [
    "Falta algún dato o no es válido. Revisa los campos y vuelve a intentarlo.",
    "Something is missing or not valid. Check the fields and try again.",
  ],
  INVALID_RULE: [
    "Elige entre 2 y 20 personas y una regla que puedan cumplir.",
    "Choose 2 to 20 people and an approval rule they can meet.",
  ],
  INVALID_ADDRESS: [
    "Esa dirección de wallet no es válida. Cópiala otra vez; empieza por G.",
    "That wallet address isn't valid. Copy it again; it starts with G.",
  ],
  INVALID_AMOUNT: [
    "Escribe un importe mayor que cero, con hasta 7 decimales.",
    "Enter an amount greater than zero, with up to 7 decimals.",
  ],
  ACCOUNT_MISSING: [
    "Esta wallet todavía no está activa en Stellar. Pide a su dueño que reciba antes un poco de XLM.",
    "This wallet isn't active on Stellar yet. Ask its owner to receive a little XLM first.",
  ],
  NETWORK_UNAVAILABLE: [
    "No pudimos conectar con Stellar. Tus datos están a salvo; vuelve a intentarlo en un momento.",
    "We couldn't reach Stellar. Your data is safe; try again in a moment.",
  ],
  NOT_MEMBER: [
    "No formas parte de esta bóveda. Pide a alguien del equipo que te añada.",
    "You're not part of this vault. Ask someone on the team to add you.",
  ],
  SIGN_IN_REQUIRED: [
    "Conecta tu wallet para continuar.",
    "Connect your wallet to continue.",
  ],
  EXPIRED_LOGIN: [
    "Tu sesión caducó. Conecta tu wallet otra vez.",
    "Your session expired. Connect your wallet again.",
  ],
  VAULT_NOT_ACTIVE: [
    "La bóveda todavía no está activa. Actívala antes de mover fondos.",
    "The vault isn't active yet. Activate it before moving funds.",
  ],
  POLICY_CHANGED: [
    "Las personas o aprobaciones en Stellar no coinciden con lo acordado, así que paramos aquí. Actualiza y revísalo con tu equipo.",
    "The people or approvals on Stellar don't match what was agreed, so we stopped here. Refresh and review it with your team.",
  ],
  PAYMENT_EXPIRED: [
    "Esta solicitud de pago caducó. Crea una nueva.",
    "This payment request expired. Create a new one.",
  ],
  STALE_PAYMENT: [
    "La bóveda cambió antes de enviar. Prepara el pago otra vez.",
    "The vault changed before sending. Prepare the payment again.",
  ],
  INSUFFICIENT_FUNDS: [
    "No hay saldo suficiente para esto. Añade fondos y vuelve a intentarlo.",
    "Not enough balance for this. Add funds and try again.",
  ],
  TRUSTLINE_REQUIRED: [
    "Este destinatario todavía no puede recibir esta moneda. Pídele que la añada en su wallet.",
    "This recipient can't receive this currency yet. Ask them to add it in their wallet.",
  ],
  SUBMISSION_UNCERTAIN: [
    "Seguimos confirmándolo con Stellar. Revisa su estado antes de volver a intentarlo.",
    "We're still confirming this with Stellar. Check its status before trying again.",
  ],
  INVITE_CLOSED: [
    "Esta invitación caducó o el equipo ya está completo. Pide un enlace nuevo.",
    "This invitation expired or the team is already complete. Ask for a new link.",
  ],
  NOT_OWNER: [
    "Esto solo lo puede hacer quien creó la bóveda.",
    "Only the person who created the vault can do this.",
  ],
  FAUCET_WAIT: [
    "Ya recibiste esta moneda de prueba hoy. Vuelve a pedirla en 24 horas.",
    "You already received this test currency today. Ask again in 24 hours.",
  ],
  FAUCET_EMPTY: [
    "Nos hemos quedado sin esta moneda de prueba por ahora. Vuelve a intentarlo más tarde.",
    "We're out of this test currency for now. Try again later.",
  ],
  FAUCET_EMPTY_USDC: [
    "Nos hemos quedado sin USDC de prueba por ahora. Puedes pedirlo en faucet.circle.com (red Stellar).",
    "We're out of test USDC for now. You can get some at faucet.circle.com (Stellar network).",
  ],
  CANNOT_REMOVE: [
    "Quien creó la bóveda permanece en el equipo.",
    "The person who created the vault stays on the team.",
  ],
  TEAM_INCOMPLETE: [
    "Todavía faltan personas por unirse. Comparte la invitación otra vez.",
    "Some people haven't joined yet. Share the invitation again.",
  ],
  PAYMENT_PENDING: [
    "Termina el pago pendiente antes de empezar otro.",
    "Finish the pending payment before starting a new one.",
  ],
  CONTACT_EXISTS: [
    "Esta dirección ya está en los contactos del equipo.",
    "This address is already in the team's contacts.",
  ],
  MEMO_TOO_LONG: [
    "La nota es demasiado larga (28 caracteres como máximo).",
    "The note is too long (28 characters max).",
  ],
  INSTALL_FREIGHTER: [
    "No encontramos Freighter en este navegador. Instálalo o abre esta página donde lo uses.",
    "We couldn't find Freighter in this browser. Install it or open this page where you use it.",
  ],
  WALLET_CANCELLED: [
    "No se completó la firma en tu wallet. Puedes volver a intentarlo.",
    "The signature in your wallet wasn't completed. You can try again.",
  ],
  WRONG_ACCOUNT: [
    "Freighter tiene otra cuenta seleccionada. Cambia a la cuenta con la que entraste y vuelve a intentarlo.",
    "Freighter has another account selected. Switch to the account you signed in with and try again.",
  ],
  CHANGED_TRANSACTION: [
    "Algo cambió en este pago, así que paramos antes de que firmaras. Actualiza y revísalo otra vez.",
    "Something changed in this payment, so we stopped before you signed. Refresh and review it again.",
  ],
  INVALID_TRANSACTION: [
    "No pudimos preparar esto correctamente. Actualiza y vuelve a intentarlo.",
    "We couldn't prepare this correctly. Refresh and try again.",
  ],
  INVALID_SIGNATURE: [
    "La firma no corresponde a esta solicitud ni a esta persona. Vuelve a firmar desde tu wallet.",
    "The signature doesn't match this request and person. Sign again from your wallet.",
  ],
  INVALID_ORIGIN: [
    "Esta petición no vino de SoroSafe. Recarga la página y vuelve a intentarlo.",
    "This request didn't come from SoroSafe. Reload the page and try again.",
  ],
  UNEXPECTED_AUTHORIZATION: [
    "Esto pedía permisos que no esperábamos, así que paramos antes de firmar. Actualiza y vuelve a intentarlo.",
    "This asked for permissions we didn't expect, so we stopped before signing. Refresh and try again.",
  ],
  STORAGE_UNAVAILABLE: [
    "No podemos guardar datos en este momento. Vuelve a intentarlo en unos minutos.",
    "We can't save data right now. Try again in a few minutes.",
  ],
  RATE_LIMITED: [
    "Demasiados intentos seguidos. Espera un minuto y vuelve a intentarlo.",
    "Too many attempts in a row. Wait a minute and try again.",
  ],
  ALREADY_ACTIVE: [
    "La bóveda ya se está activando. Actualiza para ver su estado.",
    "The vault is already being activated. Refresh to see its status.",
  ],
};

// The same errors, naming the currency or address when the caller knows it.
// Use with errorWith(); {code} and {address} are replaced.
export const detailedErrors: Record<string, [string, string]> = {
  TRUSTLINE_REQUIRED: [
    "Este destinatario todavía no puede recibir {code}. Pídele que añada {code} en su wallet.",
    "This recipient can't receive {code} yet. Ask them to add {code} in their wallet.",
  ],
  ACCOUNT_MISSING: [
    "Esta dirección todavía no está activa en Stellar, así que no puede recibir {code}. Pide a su dueño que reciba antes un poco de XLM.",
    "This address isn't active on Stellar yet, so it can't receive {code}. Ask its owner to receive a little XLM first.",
  ],
  FAUCET_EMPTY: [
    "Nos hemos quedado sin {code} de prueba por ahora. Vuelve a intentarlo más tarde.",
    "We're out of test {code} for now. Try again later.",
  ],
  WRONG_ACCOUNT: [
    "Freighter tiene otra cuenta seleccionada. Cambia a {address}.",
    "Freighter has another account selected. Switch to {address}.",
  ],
};

/** Error text for a thrown Error, with optional `cause: { code, address }`. */
export function errorWith(e: unknown, es: boolean): string | undefined {
  if (!(e instanceof Error)) return undefined;
  const vars = (e.cause ?? {}) as { code?: string; address?: string };
  const detailed = detailedErrors[e.message];
  if (
    detailed &&
    (typeof vars.code === "string" || typeof vars.address === "string")
  )
    return detailed[es ? 0 : 1]
      .split("{code}")
      .join(vars.code ?? "")
      .split("{address}")
      .join(vars.address ?? "");
  return errors[e.message]?.[es ? 0 : 1];
}
