export const errors: Record<string, [string, string]> = {
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
    "La dirección todavía no está activada en Testnet.",
    "This address is not activated on Testnet yet.",
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
    "La regla de la cuenta cambió en Stellar. Detuvimos el pago para revisarla.",
    "The account rule changed on Stellar. We paused the payment for review.",
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
    "La bóveda no tiene fondos suficientes para este pago y su reserva.",
    "The vault has insufficient funds for this payment and its reserve.",
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
  TEAM_INCOMPLETE: [
    "Todavía faltan personas por unirse.",
    "Some people have not joined yet.",
  ],
  PAYMENT_PENDING: [
    "Completen primero el pago pendiente para preparar el siguiente.",
    "Complete the pending payment before preparing the next one.",
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
