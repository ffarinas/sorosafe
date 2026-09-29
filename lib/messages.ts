export const errors: Record<string, [string, string]> = {
  CONTRACT_NOT_CONFIGURED: [
    "La creación de bóvedas está pendiente de activar en esta red.",
    "Vault creation is awaiting activation on this network.",
  ],
  CONTRACT_MEMO_UNSUPPORTED: [
    "Esta versión no permite pagos a destinos que requieren memo.",
    "This version cannot pay destinations that require a memo.",
  ],
  CONTRACT_UNAVAILABLE: [
    "No pudimos leer la bóveda en Stellar. Actualiza para continuar.",
    "We could not read the vault on Stellar. Refresh to continue.",
  ],
  CONTRACT_REJECTED: [
    "Stellar rechazó la operación. Revisa el saldo, las aprobaciones y los permisos del destinatario.",
    "Stellar rejected the operation. Check balances, approvals and recipient permissions.",
  ],
  CONTRACT_FEE_LIMIT: [
    "El coste de red supera el límite de esta aplicación. Revisa la operación.",
    "The network fee exceeds this application’s limit. Review the operation.",
  ],
  UNVERIFIED_CONTRACT: [
    "No pudimos verificar el origen de esta bóveda.",
    "We could not verify this vault’s origin.",
  ],
  MAINNET_REQUIRED: [
    "Cambia tu wallet a Stellar Mainnet para continuar.",
    "Switch your wallet to Stellar Mainnet to continue.",
  ],
  NETWORK_MISMATCH: [
    "Esta bóveda o sesión pertenece a otra red. Vuelve a entrar.",
    "This vault or session belongs to another network. Sign in again.",
  ],
  ASSET_ENABLED: [
    "Esta moneda ya está habilitada. Actualiza los saldos.",
    "This currency is already enabled. Refresh balances.",
  ],
  ACTIVATION_EXPIRED: [
    "El coste anterior venció. Actualiza en unos segundos para revisarlo otra vez.",
    "The previous quote expired. Refresh in a few seconds to review it again.",
  ],
  ASSET_UNAVAILABLE: [
    "Esta moneda ya no está disponible en la bóveda. Actualiza los saldos y vuelve a preparar el pago.",
    "This currency is no longer available in the vault. Refresh balances and prepare the payment again.",
  ],
  TEST_WALLET_GONE: [
    "La clave de esta wallet temporal se perdió al recargar. Desconecta para empezar otra prueba con una nueva wallet.",
    "This temporary wallet’s key was lost when the page reloaded. Disconnect to start a new test with a new wallet.",
  ],
  CONFIGURATION_REQUIRED: [
    "Configura tu bóveda en Equipo y ajustes antes de continuar.",
    "Set up your vault in Team & settings before continuing.",
  ],
  CONFIGURATION_CHANGED: [
    "El equipo o la configuración cambió. Actualiza y revisa las reglas; no puedes elegir menos personas de las que ya se unieron.",
    "The team or settings changed. Refresh and review the rules; the team size cannot be smaller than the number who already joined.",
  ],
  AUTH_UNAVAILABLE: [
    "El acceso no está disponible por el momento. Inténtalo de nuevo más tarde.",
    "Sign-in is unavailable right now. Please try again later.",
  ],
  INVALID_LOGIN: [
    "No pudimos verificar tu identidad. Vuelve a entrar con tu wallet.",
    "We could not verify your identity. Please sign in with your wallet again.",
  ],
  INVALID_INPUT: [
    "Revisa los campos e inténtalo de nuevo.",
    "Check the fields and try again.",
  ],
  INVALID_RULE: [
    "Elige entre 2 y 20 personas y una regla que puedan cumplir.",
    "Choose 2–20 people and an approval rule they can meet.",
  ],
  INVALID_ADDRESS: [
    "Esta dirección de Stellar no es válida.",
    "This Stellar address is not valid.",
  ],
  INVALID_AMOUNT: [
    "Escribe un importe mayor que cero, con hasta 7 decimales.",
    "Enter an amount greater than zero, with up to 7 decimals.",
  ],
  ACCOUNT_MISSING: [
    "La dirección todavía no está activada en esta red de Stellar.",
    "This address is not activated on this Stellar network yet.",
  ],
  NETWORK_UNAVAILABLE: [
    "No pudimos conectar con Stellar. Tus datos siguen guardados.",
    "We could not connect to Stellar. Your data is still saved.",
  ],
  NOT_MEMBER: [
    "Esta bóveda no está compartida contigo.",
    "This vault is not shared with you.",
  ],
  SIGN_IN_REQUIRED: [
    "Conecta tu wallet para continuar.",
    "Connect your wallet to continue.",
  ],
  EXPIRED_LOGIN: [
    "La confirmación venció. Conecta tu wallet otra vez.",
    "The confirmation expired. Connect your wallet again.",
  ],
  VAULT_NOT_ACTIVE: [
    "Invita al equipo y activa la bóveda antes de enviar fondos.",
    "Invite your team and activate the vault before sending funds.",
  ],
  POLICY_CHANGED: [
    "El equipo o las aprobaciones en Stellar no coinciden con lo acordado. Detuvimos la operación para revisarla.",
    "The team or approvals on Stellar do not match what was agreed. We paused the operation for review.",
  ],
  PAYMENT_EXPIRED: [
    "Este pago venció. Crea uno nuevo para volver a pedir las firmas.",
    "This payment expired. Create a new one to collect fresh signatures.",
  ],
  STALE_PAYMENT: [
    "La cuenta cambió antes del envío. Prepara el pago otra vez.",
    "The account changed before submission. Prepare the payment again.",
  ],
  INSUFFICIENT_FUNDS: [
    "La cuenta no tiene XLM o saldo suficiente para esta operación y su reserva.",
    "The account has insufficient XLM or balance for this operation and its reserve.",
  ],
  TRUSTLINE_REQUIRED: [
    "El destinatario debe habilitar este activo antes de recibirlo.",
    "The recipient must enable this asset before receiving it.",
  ],
  SUBMISSION_UNCERTAIN: [
    "Estamos comprobando el envío. Revisa su estado antes de crear otro pago.",
    "We are checking submission. Check its status before creating another payment.",
  ],
  INVITE_CLOSED: [
    "La invitación venció o el equipo ya está completo.",
    "This invitation expired or the team is already complete.",
  ],
  NOT_OWNER: [
    "Esta acción corresponde a quien creó la bóveda.",
    "Only the vault creator can do this.",
  ],
  CANNOT_REMOVE: [
    "Quien creó la bóveda permanece en el equipo.",
    "The person who created the vault stays on the team.",
  ],
  TEAM_INCOMPLETE: [
    "Todavía faltan personas por unirse.",
    "Some people have not joined yet.",
  ],
  PAYMENT_PENDING: [
    "Completen primero la operación pendiente para preparar la siguiente.",
    "Complete the pending operation before preparing the next one.",
  ],
  CONTACT_EXISTS: [
    "Esta dirección y memo ya están en la libreta del equipo.",
    "This address and memo are already in the team’s contacts.",
  ],
  MEMO_TOO_LONG: [
    "El memo debe ocupar como máximo 28 bytes.",
    "The memo must be at most 28 bytes.",
  ],
  INSTALL_FREIGHTER: [
    "Instala Freighter o abre esta página en el navegador donde lo usas.",
    "Install Freighter or open this page in the browser where you use it.",
  ],
  WALLET_CANCELLED: [
    "La firma no se completó. Puedes volver a intentarlo.",
    "Signing was not completed. You can try again.",
  ],
  TESTNET_REQUIRED: [
    "Cambia tu wallet a Stellar Testnet para continuar.",
    "Switch your wallet to Stellar Testnet to continue.",
  ],
  CHANGED_TRANSACTION: [
    "El pago no coincide con lo que ves. No se solicitó tu firma.",
    "The payment does not match what you see. Your signature was not requested.",
  ],
  INVALID_SIGNATURE: [
    "La firma no corresponde a este pago y esta persona.",
    "The signature does not match this payment and person.",
  ],
  RATE_LIMITED: [
    "Has realizado muchas solicitudes. Intenta de nuevo más tarde.",
    "Too many requests. Please try again later.",
  ],
  ALREADY_ACTIVE: [
    "La activación ya está en curso. Actualiza el estado.",
    "Activation is already in progress. Refresh its status.",
  ],
};
