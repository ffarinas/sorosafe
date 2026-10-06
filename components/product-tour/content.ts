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
            "Te han invitado a una bóveda que ya existe. Al unirte, compartirás sus fondos, contactos y solicitudes de pago con el equipo.",
            "You've been invited to an existing vault. Once you join, you'll share its funds, contacts and payment requests with the team.",
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
        "Freighter es una extensión gratuita del navegador que guarda tu clave, como el token de seguridad de tu banco. Entrar solo identifica tu cuenta; cada pago lo revisas y lo apruebas por separado.",
        "Freighter is a free browser extension that keeps your key, like a bank security token. Signing in only identifies your account; you review and approve each payment separately.",
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
            "Estás en Stellar Testnet: sus fondos no tienen valor real. En Freighter, toca el nombre de la red y elige Test Net. Si tu cuenta es nueva, SoroSafe consigue XLM de prueba para empezar.",
            "You're on Stellar Testnet: its funds have no real value. In Freighter, tap the network name and choose Test Net. If your account is new, SoroSafe gets test XLM to help you start.",
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
        "Su nombre y su dirección identifican los mismos fondos para todos. El dinero está en Stellar, separado de las wallets personales.",
        "Its name and address identify the same funds for everyone. The money lives on Stellar, separate from personal wallets.",
      ),
      note: t(
        "Ver en Stellar abre el registro público de la bóveda.",
        "View on Stellar opens the vault's public record.",
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
        `Esta bóveda necesita ${threshold} de ${signers} aprobaciones para cada pago. ${singleApproval ? "Una sola persona puede autorizarlo con la regla actual." : "Una sola persona no basta para mover los fondos."}`,
        `This vault needs ${threshold} of ${signers} approvals for each payment. ${singleApproval ? "One person can authorize it under the current rule." : "One person alone cannot move the funds."}`,
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
        "Para recibir de un cliente o un exchange, pide que lo envíen a tu propia wallet y después usa Añadir fondos.",
        "To receive from a client or exchange, have it sent to your own wallet, then use Add funds.",
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
        "Elige un contacto o pega una dirección de wallet, indica el importe y revisa el destinatario, la comisión y el total antes de confirmar en tu wallet.",
        "Choose a contact or paste a wallet address, enter the amount, and review the recipient, fee and total before confirming in your wallet.",
      ),
      note: singleApproval
        ? t(
            "Con una sola aprobación requerida, tu firma envía el pago al proponerlo.",
            "With one approval required, your signature sends the payment when you propose it.",
          )
        : t(
            "Al solicitar el pago, tu solicitud ya cuenta como la primera aprobación.",
            "When you request a payment, your request already counts as its first approval.",
          ),
    },
    {
      id: "operations",
      target: "vault-operations",
      icon: "check",
      placement: "bottom",
      section: "activity",
      title: singleApproval
        ? t("Cada pago deja un registro", "Every payment leaves a record")
        : t("Aprobar en equipo", "Approve together"),
      body: singleApproval
        ? t(
            "Aquí puedes ver los pagos y los cambios de equipo, con su estado y sus aprobaciones. Tras confirmar un pago, Ver recibo abre su comprobante en Stellar.",
            "See payments and team changes here, along with their status and approvals. After a payment is confirmed, View receipt opens its record on Stellar.",
          )
        : t(
            "Aprobar en equipo: la última aprobación necesaria envía el pago. Hasta entonces puedes retirar tu aprobación, y quien lo pidió puede cancelarlo.",
            "Approve together: the last approval needed sends the payment. Until then you can withdraw your approval, and whoever requested it can cancel it.",
          ),
      note: t(
        "Una solicitud pendiente todavía no es un pago realizado.",
        "A pending request is not yet a completed payment.",
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
        "Desde aquí puedes añadir o quitar personas y cambiar las aprobaciones necesarias. Cambiar el equipo necesita las mismas aprobaciones y la bóveda conserva su dirección.",
        "Add or remove people and change the approvals needed here. Changing the team needs the same approvals, and the vault keeps its address.",
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
        `La comisión de servicio de esta bóveda es ${fee} % por pago, en la misma moneda que envías. SoroSafe cubre el coste de red cuando puede; si no, tu wallet paga unos céntimos.`,
        `This vault's service fee is ${fee}% per payment, in the currency you send. SoroSafe covers network fees when it can; otherwise your wallet pays a few cents.`,
      ),
      note: t(
        "Revisa el importe y la comisión antes de confirmar en tu wallet.",
        "Review the amount and fee before confirming in your wallet.",
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
