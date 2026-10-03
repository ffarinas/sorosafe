import type { TourLanguage, TourStep } from "./types";

export function introSteps(
  language: TourLanguage,
  joining: boolean,
  testnet: boolean,
): TourStep[] {
  const t = (es: string, en: string) => (language === "es" ? es : en);
  return [
    {
      id: "welcome",
      target: "intro-story",
      icon: "vault",
      placement: "right",
      title: t(
        "Un lugar para el dinero en equipo",
        "A home for your team's money",
      ),
      body: joining
        ? t(
            "Te han invitado a una bóveda que ya existe. Al unirte, compartirás sus fondos, contactos y operaciones con el equipo.",
            "You've been invited to an existing vault. Once you join, you'll share its funds, contacts and operations with the team.",
          )
        : t(
            "Una bóveda reúne los fondos del grupo en una misma dirección de Stellar. Cada persona conserva su propia wallet para firmar.",
            "A vault brings the group's funds together at one Stellar address. Each person keeps their own wallet for signing.",
          ),
      note: t(
        "Las reglas de la bóveda controlan quién puede mover el dinero.",
        "The vault's rules control who can move the money.",
      ),
    },
    {
      id: "create",
      target: "intro-form",
      icon: "team",
      placement: "left",
      title: joining
        ? t("Entra a la misma bóveda", "Join the same vault")
        : t("Empieza a tu ritmo", "Start at your own pace"),
      body: joining
        ? t(
            "Comprueba el nombre de la bóveda y la regla de aprobación de esta invitación. Continúa con tu wallet; no necesitas crear otra bóveda.",
            "Check the vault name and approval rule in this invitation. Continue with your wallet; you don't need to create another vault.",
          )
        : t(
            "Dale un nombre a la bóveda y continúa con tu wallet. Empiezas como único firmante: puedes añadir personas y acordar más aprobaciones desde Equipo cuando estén listas.",
            "Name your vault and continue with your wallet. You start as its only signer: add people and agree on more approvals from Team when they're ready.",
          ),
      note: joining
        ? t(
            "Cada persona entra con su propia wallet.",
            "Everyone joins with their own wallet.",
          )
        : t(
            "Al añadir al equipo, la dirección de la bóveda se mantiene.",
            "The vault keeps the same address as your team grows.",
          ),
    },
    {
      id: "wallet",
      target: "app-identity",
      icon: "wallet",
      placement: "bottom",
      title: t("Tu wallet es tu firma", "Your wallet is your signature"),
      body: t(
        "Con Freighter puedes entrar y firmar las operaciones. La firma de acceso identifica tu cuenta; los movimientos de dinero se revisan y se firman por separado.",
        "Use Freighter to sign in and sign operations. Signing in identifies your account; money movements are reviewed and signed separately.",
      ),
      note: t(
        "SoroSafe nunca te pide tu frase de recuperación.",
        "SoroSafe never asks for your recovery phrase.",
      ),
    },
    {
      id: "network",
      target: "app-network",
      icon: "globe",
      placement: "bottom",
      title: testnet
        ? t("Un espacio para probar", "A place to try it out")
        : t("Ten presente la red", "Keep the network in mind"),
      body: testnet
        ? t(
            "Estás en Stellar Testnet: sus fondos no tienen valor real. Selecciona Testnet en Freighter. Si tu cuenta es nueva, SoroSafe puede conseguir XLM de prueba para empezar.",
            "You're on Stellar Testnet: its funds have no real value. Select Testnet in Freighter. If your account is new, SoroSafe can get test XLM to help you start.",
          )
        : t(
            "Estás en Stellar Mainnet, donde los fondos tienen valor real. Antes de firmar, comprueba la red, la moneda, la dirección y el importe.",
            "You're on Stellar Mainnet, where funds have real value. Before signing, check the network, currency, address and amount.",
          ),
    },
    {
      id: "replay",
      target: "tour-launcher",
      icon: "guide",
      placement: "top",
      title: t(
        "La ayuda se queda contigo",
        "A little guidance, whenever you need it",
      ),
      body: t(
        "Puedes volver a este recorrido desde Cómo funciona. Dentro de la bóveda encontrarás otra guía para los fondos, pagos, contactos y aprobaciones.",
        "Return to this tour from How it works. Inside your vault, another guide walks you through funds, payments, contacts and approvals.",
      ),
      note: t(
        "El recorrido explica los controles; tú decides cuándo usarlos.",
        "The tour explains the controls; you decide when to use them.",
      ),
    },
  ];
}

export function vaultSteps({
  language,
  threshold,
  signers,
  currencies,
  feeBps,
  sharedContacts,
}: {
  language: TourLanguage;
  threshold: number;
  signers: number;
  currencies: string[];
  feeBps: number;
  sharedContacts: boolean;
}): TourStep[] {
  const t = (es: string, en: string) => (language === "es" ? es : en);
  const fee = new Intl.NumberFormat(language === "es" ? "es-ES" : "en-US", {
    maximumFractionDigits: 2,
  }).format(feeBps / 100);
  const singleApproval = threshold === 1;
  return [
    {
      id: "vault",
      target: "vault-identity",
      icon: "vault",
      placement: "bottom",
      section: "funds",
      title: t("Esta es la bóveda del equipo", "This is your team's vault"),
      body: t(
        "Su nombre y su dirección identifican los mismos fondos para todos. El dinero está en este contrato de Stellar, separado de las wallets personales.",
        "Its name and address identify the same funds for everyone. The money lives in this Stellar contract, separate from personal wallets.",
      ),
      note: t(
        "Puedes consultar el contrato en Stellar desde este enlace.",
        "Use this link to view the contract on Stellar.",
      ),
    },
    {
      id: "rules",
      target: "vault-rule",
      icon: "team",
      placement: "left",
      section: "funds",
      title: t("Una regla que todos pueden ver", "A rule everyone can see"),
      body: t(
        `Esta bóveda necesita ${threshold} ${singleApproval ? "aprobación" : "aprobaciones"} de sus ${signers} ${signers === 1 ? "firmante" : "firmantes"} para cada operación. ${singleApproval ? "Una sola persona puede autorizarla con la regla actual." : "Una sola firma no basta para mover los fondos."}`,
        `This vault needs ${threshold} ${singleApproval ? "approval" : "approvals"} from its ${signers} ${signers === 1 ? "signer" : "signers"} for each operation. ${singleApproval ? "One person can authorize it under the current rule." : "One signature alone cannot move the funds."}`,
      ),
      note: t(
        "La regla se aplica en Stellar, también fuera de esta página.",
        "Stellar enforces the rule, even outside this page.",
      ),
    },
    {
      id: "funds",
      target: "vault-currencies",
      icon: "wallet",
      placement: "top",
      section: "funds",
      title: t(
        "Cada moneda, con su saldo",
        "Each currency has its own balance",
      ),
      body: t(
        `Aquí aparecen las monedas admitidas por esta bóveda: ${currencies.join(", ")}. Añadir fondos mueve la moneda elegida desde tu wallet a la bóveda.`,
        `These are the currencies this vault supports: ${currencies.join(", ")}. Add funds moves your selected currency from your wallet into the vault.`,
      ),
      note: t(
        "Para depósitos externos, el origen debe admitir direcciones de contrato de Stellar (C…).",
        "For external deposits, the sender must support Stellar contract addresses (C…).",
      ),
    },
    {
      id: "payment",
      target: "vault-send",
      icon: "send",
      placement: "top",
      section: "funds",
      title: t(
        "Prepara el pago con claridad",
        "Know exactly what you're sending",
      ),
      body: t(
        "Enviar conserva la moneda de esta fila. Elige un contacto o pega una dirección, indica el importe y revisa el destinatario, las comisiones y el total antes de firmar.",
        "Send keeps the currency from this row. Choose a contact or paste an address, enter the amount, and review the recipient, fees and total before signing.",
      ),
      note: singleApproval
        ? t(
            "Con una sola aprobación requerida, tu firma envía el pago al proponerlo.",
            "With one approval required, your signature sends the payment when you propose it.",
          )
        : t(
            "Al proponer el pago, tu firma ya cuenta como la primera aprobación.",
            "When you propose a payment, your signature already counts as its first approval.",
          ),
    },
    {
      id: "operations",
      target: "vault-operations",
      icon: "check",
      placement: "bottom",
      section: "activity",
      title: singleApproval
        ? t(
            "Cada operación deja un registro",
            "Every operation leaves a record",
          )
        : t("Aprobar y después ejecutar", "Approve, then execute"),
      body: singleApproval
        ? t(
            "Aquí puedes ver los pagos y los cambios de equipo, con su estado y sus aprobaciones. Tras confirmar una operación, Ver recibo abre su comprobante en Stellar.",
            "See payments and team changes here, along with their status and approvals. After an operation is confirmed, View receipt opens its record on Stellar.",
          )
        : t(
            "Revisa cada solicitud antes de aprobarla. Al alcanzar la regla aparece Ejecutar: ese paso completa el pago. Mientras siga pendiente, puedes retirar tu aprobación; quien la creó puede cancelarla.",
            "Review each request before approving it. Once the rule is met, Execute becomes available: that step completes the payment. While it's pending, you can revoke your approval; its creator can cancel it.",
          ),
      note: t(
        "Una operación pendiente todavía no es un pago realizado.",
        "A pending operation is not yet a completed payment.",
      ),
    },
    {
      id: "contacts",
      target: "vault-contacts",
      icon: "book",
      placement: "bottom",
      section: "contacts",
      title: t("La misma libreta para todos", "One address book for everyone"),
      body: sharedContacts
        ? t(
            "Los contactos guardados se comparten con el equipo. Puedes ver quién añadió cada dirección y cuántos pagos confirmados ha recibido de esta bóveda.",
            "Saved contacts are shared with the team. See who added each address and how many confirmed payments it has received from this vault.",
          )
        : t(
            "Abriste la bóveda directamente desde su dirección. Puedes operar con direcciones de destinatarios; para usar los nombres y contactos compartidos, entra a la bóveda desde SoroSafe.",
            "You opened this vault directly by its address. You can use recipient addresses; to access shared names and contacts, open the vault while signed into SoroSafe.",
          ),
      note: t(
        "El historial ayuda a reconocer un destinatario; revisa siempre su dirección.",
        "History helps you recognize a recipient; always check their address.",
      ),
    },
    {
      id: "team",
      target: "vault-team",
      icon: "team",
      placement: "bottom",
      section: "team",
      title: t("El equipo puede crecer", "Your team can grow"),
      body: t(
        "Desde aquí puedes proponer añadir o quitar firmantes y cambiar las aprobaciones necesarias. El cambio necesita la regla actual y conserva la dirección de la bóveda.",
        "Propose adding or removing signers and changing the required approvals here. The change must meet the current rule and keeps the vault's address.",
      ),
      note: t(
        "Al cambiar la regla, las solicitudes anteriores pendientes dejan de ser válidas.",
        "Changing the rule invalidates earlier pending requests.",
      ),
    },
    {
      id: "fees",
      target: "vault-fees",
      icon: "wallet",
      placement: "top",
      section: "team",
      title: t("Los costes, a la vista", "See the costs clearly"),
      body: t(
        `La comisión de servicio de esta bóveda es ${fee} % por pago, en la misma moneda que envías. Cada transacción también tiene un coste de red en XLM que paga la wallet que firma.`,
        `This vault's service fee is ${fee}% per payment, in the currency you send. Each transaction also has an XLM network fee paid by the signing wallet.`,
      ),
      note: t(
        "Revisa el importe y el coste de red antes de confirmar en tu wallet.",
        "Review the amount and network fee before confirming in your wallet.",
      ),
    },
    {
      id: "replay",
      target: "tour-launcher",
      icon: "guide",
      placement: "bottom",
      section: "funds",
      title: t("Todo listo para orientarte", "You're ready to find your way"),
      body: t(
        "Ya conoces los fondos, los pagos y las decisiones del equipo. Vuelve a Cómo funciona cuando lo necesites; el recorrido siempre usa la regla y las monedas de esta bóveda.",
        "You now know where to find funds, payments and team decisions. Return to How it works whenever you need it; the tour always uses this vault's rule and currencies.",
      ),
    },
  ];
}

export function setupSteps(language: TourLanguage): TourStep[] {
  const t = (es: string, en: string) => (language === "es" ? es : en);
  return [
    {
      id: "setup",
      target: "setup-status",
      icon: "vault",
      placement: "bottom",
      title: t(
        "Tu bóveda sigue en preparación",
        "Your vault is still being set up",
      ),
      body: t(
        "Aquí ves su nombre y estado actual. Si cerraste o rechazaste la firma de creación, puedes continuar la preparación desde esta pantalla.",
        "Here you can see its name and current status. If you closed or declined the creation signature, you can continue setup from this screen.",
      ),
    },
    {
      id: "next",
      target: "setup-next",
      icon: "check",
      placement: "left",
      title: t("Sigue el siguiente paso", "Follow the next step"),
      body: t(
        "Esta sección muestra lo que falta: revisar la activación, completar el equipo o corregir la configuración. Comprueba las personas y aprobaciones antes de firmar.",
        "This section shows what's needed: review activation, complete the team, or correct the settings. Check the people and approvals before signing.",
      ),
      note: t(
        "Espera a que la bóveda esté activa antes de añadir fondos.",
        "Wait until the vault is active before adding funds.",
      ),
    },
    {
      id: "navigation",
      target: "setup-navigation",
      icon: "team",
      placement: "bottom",
      title: t("Un mismo lugar para tu equipo", "One place for your team"),
      body: t(
        "Las pestañas organizan el resumen, pagos, contactos compartidos y ajustes. Cuando actives la bóveda, otra guía te mostrará cómo usar sus fondos y aprobaciones.",
        "The tabs organize the overview, payments, shared contacts and settings. Once you activate the vault, another guide will show you its funds and approvals.",
      ),
    },
  ];
}
