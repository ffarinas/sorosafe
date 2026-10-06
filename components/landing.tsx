import type { ReactNode } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  BookUser,
  Check,
  ChevronDown,
  Eye,
  Fingerprint,
  Globe2,
  KeyRound,
  Layers3,
  ShieldCheck,
  Users,
  Zap,
} from "lucide-react";
import type { NetworkConfig } from "@/lib/network";
import { BrandWordmark } from "./brand-wordmark";
import "./landing.css";

// Monochrome brand kit v1: ink, paper, graphite; Inter only.
// Marketing content. The hero card is a labelled illustration, never live data.
export function LandingLayout({
  marketing,
  es,
  chain,
  children,
}: {
  marketing: boolean;
  es: boolean;
  chain: NetworkConfig;
  children: ReactNode;
}) {
  if (!marketing) return <main className="onboarding">{children}</main>;
  const t = (spanish: string, english: string) => (es ? spanish : english);
  const integrations = [
    {
      name: "Soroban",
      label: t(
        "Cada bóveda, un contrato verificado",
        "Every vault, a verified contract",
      ),
      body: t(
        "Cada bóveda tiene su propia dirección en Stellar, y SoroSafe comprueba que es una versión auténtica antes de abrirla.",
        "Each vault has its own address on Stellar, and SoroSafe checks it's a genuine version before opening it.",
      ),
      href: "https://developers.stellar.org/docs/build/smart-contracts/overview",
      icon: Layers3,
    },
    {
      name: "Freighter",
      label: t(
        "Tu wallet sigue en tus manos",
        "Your wallet stays in your hands",
      ),
      body: t(
        "Revisas cada operación en tu wallet antes de firmar. Tus claves se quedan contigo; SoroSafe nunca te pide tu frase de recuperación.",
        "You review every operation in your wallet before signing. Your keys stay with you; SoroSafe never asks for your recovery phrase.",
      ),
      href: "https://www.freighter.app/",
      icon: KeyRound,
    },
    {
      name: "SEP-10",
      label: t(
        "Entra sin otra contraseña",
        "Sign in without another password",
      ),
      body: t(
        "Entras confirmando en tu wallet. Iniciar sesión nunca mueve dinero.",
        "Sign in by confirming in your wallet. Signing in never moves money.",
      ),
      href: "https://developers.stellar.org/docs/build/apps/wallet/sep10",
      icon: Fingerprint,
    },
    {
      name: "Stellar Asset Contracts",
      label: t(
        "La moneda exacta, siempre",
        "The exact currency, every time",
      ),
      body: t(
        "SoroSafe comprueba la moneda exacta, así que un token que se le parezca no puede colarse en un pago.",
        "SoroSafe checks the exact currency, so a look-alike token can't slip into a payment.",
      ),
      href: "https://developers.stellar.org/docs/tokens/stellar-asset-contract",
      icon: ShieldCheck,
    },
    {
      name: "Stellar RPC + SDK",
      label: t(
        "Información que puedes verificar",
        "Information you can verify",
      ),
      body: t(
        "Saldos, firmantes y aprobaciones se leen directamente de Stellar. Cada operación confirmada tiene su recibo en Stellar Expert.",
        "Balances, signers, and approvals are read directly from Stellar. Every confirmed operation has its receipt on Stellar Expert.",
      ),
      href: "https://developers.stellar.org/docs/data/apis/rpc",
      icon: Globe2,
    },
  ];
  const questions = [
    {
      title: t(
        "¿Por qué un contrato si Stellar ya tiene multifirma?",
        "Why a contract if Stellar already has multisig?",
      ),
      body: t(
        "La multifirma nativa de Stellar también protege con umbrales. El contrato añade una dirección propia para la bóveda, solicitudes y aprobaciones en cadena y reglas para cambiar el equipo. SoroSafe lo convierte en un espacio de trabajo compartido.",
        "Stellar's native multisig also protects funds with thresholds. The contract adds a dedicated vault address, on-chain requests and approvals, and rules for team changes. SoroSafe turns that into a shared workspace.",
      ),
    },
    {
      title: t(
        "¿SoroSafe puede mover mi dinero?",
        "Can SoroSafe move my money?",
      ),
      body: t(
        "No. SoroSafe no tiene una clave de retiro ni un administrador con acceso a los fondos. Los pagos y los cambios de equipo deben cumplir la regla de la bóveda, y los contratos actuales no se pueden actualizar.",
        "No. SoroSafe has no withdrawal key and no administrator with access to the funds. Payments and team changes must meet the vault's rule, and the current contracts cannot be upgraded.",
      ),
    },
    {
      title: t(
        "¿Qué depende de los servidores de SoroSafe?",
        "What depends on SoroSafe's servers?",
      ),
      body: t(
        "Los nombres, los contactos compartidos y las invitaciones. Los fondos, las reglas y las aprobaciones viven en Stellar, y la vista directa del contrato permite operar sin el backend de SoroSafe.",
        "Names, shared contacts, and invitations. Funds, rules, and approvals live on Stellar, and the direct contract view lets you operate without SoroSafe's backend.",
      ),
    },
    {
      title: t(
        "¿Necesito XLM para usar SoroSafe?",
        "Do I need XLM to use SoroSafe?",
      ),
      body: t(
        "Para el día a día, no. SoroSafe cubre las comisiones de red de solicitudes, aprobaciones y depósitos cuando puede (hasta un límite diario). Crear una bóveda tiene una pequeña comisión que paga quien la crea.",
        "Not for daily use. SoroSafe covers network fees for requests, approvals and deposits when it can (up to a daily limit). Creating a vault has a small fee paid by whoever creates it.",
      ),
    },
    chain.id === "testnet"
      ? {
          title: t(
            "¿Las monedas de prueba son reales?",
            "Are the test currencies real?",
          ),
          body: t(
            "No tienen valor. USDT0 aún no existe en Testnet, así que el USDT0 de prueba lo emite SoroSafe con un suministro fijo. Mainnet, con USDC y USDT0 oficiales, es el siguiente paso.",
            "They have no value. USDT0 isn't on Testnet yet, so the test USDT0 is issued by SoroSafe with a fixed supply. Mainnet, with official USDC and USDT0, is the next step.",
          ),
        }
      : {
          title: t(
            "¿Qué monedas puedo usar?",
            "Which currencies can I use?",
          ),
          body: t(
            "Las que admite el contrato de tu bóveda; las verás con su saldo dentro de ella. Un símbolo de moneda por sí solo no identifica un activo.",
            "The ones your vault's contract supports; you'll see them with their balances inside it. A currency symbol alone does not identify an asset.",
          ),
        },
  ];
  const steps = [
    {
      title: t("Ponle nombre y firma una vez", "Name it and sign once"),
      body: t(
        "Elige un nombre y confirma en tu wallet. La bóveda recibe su propia dirección en Stellar.",
        "Pick a name and confirm in your wallet. The vault gets its own address on Stellar.",
      ),
    },
    {
      title: t(
        "Añade personas y elige la regla",
        "Add people and choose the rule",
      ),
      body: t(
        "Invita a quienes aprueban pagos y decide cuántas aprobaciones hacen falta, por ejemplo 2 de 3.",
        "Invite the people who approve payments and decide how many approvals it takes, like 2 of 3.",
      ),
    },
    {
      title: t("Solicitud → aprobación → pagado", "Request → approve → paid"),
      body: t(
        "Alguien pide un pago y el resto lo revisa. Con las aprobaciones suficientes, se paga automáticamente si hay saldo.",
        "Someone requests a payment and the others review it. Once enough people approve, it's paid automatically if funds are there.",
      ),
    },
  ];
  const features = [
    {
      icon: BookUser,
      title: t(
        "Los contactos\nson del equipo.",
        "Contacts belong\nto the team.",
      ),
      body: t(
        "Una misma libreta para todos. Ves quién añadió cada dirección y si ya recibió pagos de la bóveda.",
        "One address book for everyone. See who added an address and whether it has received payments from the vault.",
      ),
    },
    {
      icon: Eye,
      title: t(
        "Todo a la vista\nantes de firmar.",
        "The full picture\nbefore signing.",
      ),
      body: t(
        "Destinatario, moneda, importe y comisiones, antes de confirmar. Nadie aprueba a ciegas.",
        "Recipient, currency, amount, and fees, before you confirm. Nobody approves blind.",
      ),
    },
    {
      icon: Zap,
      title: t(
        "Sin comisiones de red,\nnormalmente.",
        "No network fees,\nusually.",
      ),
      body: t(
        "SoroSafe las paga con un fee-bump de Stellar cuando puede; si no, tu wallet paga unos céntimos y todo sigue funcionando.",
        "SoroSafe pays them with a Stellar fee-bump when it can; if not, your wallet pays a few cents and everything still works.",
      ),
    },
  ];
  const approvers = [
    { initial: "M", name: "Marta", approved: true },
    { initial: "J", name: "Javier", approved: true },
    { initial: "A", name: "Ana", approved: false },
  ];
  return (
    <main className="landing" lang={es ? "es" : "en"} id="landing-main">
      <section className="landing-hero landing-width">
        <div className="landing-hero-copy" data-product-tour="intro-story">
          <p className="landing-kicker">
            {t(
              "Dinero de empresa compartido, sobre Stellar",
              "Shared company money on Stellar",
            )}
          </p>
          <h1>
            {t("Dinero compartido.", "Shared money.")}
            <br />
            <span>{t("Aprobado en equipo.", "Approved together.")}</span>
          </h1>
          <p className="landing-lead">
            {t(
              "Una bóveda para el dinero de tu empresa. Tu equipo elige quién aprueba y cuántas aprobaciones necesita cada pago. Ningún pago sale sin esas aprobaciones.",
              "One vault for your company's money. Your team chooses who approves and how many approvals each payment needs. No payment leaves without those approvals.",
            )}
          </p>
          <div className="landing-cta-row">
            <a
              className="primary landing-cta"
              href="#create-vault"
              onClick={(event) => {
                // Land in the name field, ready to type.
                const input = document.getElementById("vault-name");
                if (!input) return;
                event.preventDefault();
                // A smooth scroll is cancelled by focus(); jump straight there.
                input.scrollIntoView({ block: "center" });
                input.focus({ preventScroll: true });
              }}
            >
              {t("Crear bóveda", "Create vault")}
              <span>
                <ArrowUpRight size={19} aria-hidden="true" />
              </span>
            </a>
            <a className="landing-text-link" href="#how">
              {t("Ver cómo funciona", "See how it works")}
              <ArrowDownRight size={18} aria-hidden="true" />
            </a>
          </div>
        </div>
        <div className="landing-hero-art">
          {/* Decorative texture behind an illustrative card, never live data. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/shared-control.webp"
            width="1448"
            height="1086"
            fetchPriority="high"
            alt=""
          />
          <div
            className="hero-vault-card"
            role="img"
            aria-label={t(
              "Ilustración de una bóveda: regla de 2 de 3 aprobaciones y un pago esperando a Ana.",
              "Illustration of a vault: a 2-of-3 approval rule and a payment waiting for Ana.",
            )}
          >
            <div className="hero-vault-top">
              <span className="hero-vault-name">
                {t("Tesorería", "Treasury")}
              </span>
              <span className="hero-vault-example">
                {t("Ejemplo", "Example")}
              </span>
            </div>
            <div className="hero-vault-balance">
              {es ? "12.480,00" : "12,480.00"}
              <span>USDC</span>
            </div>
            <div className="hero-vault-rule">
              <span className="hero-avatars" aria-hidden="true">
                {approvers.map(({ initial }) => (
                  <span key={initial}>{initial}</span>
                ))}
              </span>
              <span className="hero-vault-chip">
                <ShieldCheck size={13} aria-hidden="true" />
                {t("2 de 3 aprobaciones", "2 of 3 approvals")}
              </span>
            </div>
            <div className="hero-vault-request">
              <div>
                <strong>{t("Pago a Estudio Norte", "Pay Northwind Studio")}</strong>
                <span>{es ? "1.200,00 USDC" : "1,200.00 USDC"}</span>
              </div>
              <div className="hero-vault-status">
                <span className="hero-vault-progress" aria-hidden="true">
                  <span />
                </span>
                {t("1 de 2 · Esperando a Ana", "1 of 2 · Waiting for Ana")}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section
        className="landing-how landing-width"
        id="how"
        aria-labelledby="how-title"
      >
        <div className="landing-section-heading">
          <p className="landing-kicker">{t("Cómo funciona", "How it works")}</p>
          <h2 id="how-title">
            {t("Tres pasos, sin sorpresas.", "Three steps, no surprises.")}
          </h2>
        </div>
        <ol className="landing-steps">
          {steps.map(({ title, body }, index) => (
            <li key={title}>
              <span className="landing-step-number" aria-hidden="true">
                {index + 1}
              </span>
              <h3>{title}</h3>
              <p>{body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="landing-why" id="why" aria-labelledby="why-title">
        <div className="landing-width">
          <div className="landing-illustrated-heading">
            <div className="landing-section-heading">
              <p className="landing-kicker">
                {t("Por qué SoroSafe", "Why SoroSafe")}
              </p>
              <h2 id="why-title">
                {t(
                  "Control compartido,\nsin complicaciones.",
                  "Shared control,\nwithout the complexity.",
                )}
              </h2>
              <p>
                {t(
                  "Para equipos que gestionan dinero juntos: todos ven la misma bóveda, los mismos contactos y las mismas solicitudes.",
                  "For teams that manage money together: everyone sees the same vault, the same contacts, and the same requests.",
                )}
              </p>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              className="landing-section-art landing-section-art-shared"
              src="/brand/shared-glass.webp"
              width="768"
              height="576"
              loading="lazy"
              decoding="async"
              alt=""
              aria-hidden="true"
            />
          </div>
          <div className="landing-features">
            <article className="landing-feature-main">
              <Users size={30} strokeWidth={1.4} aria-hidden="true" />
              <h3>
                {t(
                  "Varias personas.\nUna misma bóveda.",
                  "Multiple people.\nOne shared vault.",
                )}
              </h3>
              <p>
                {t(
                  "Empieza con tu wallet, añade a tu equipo y decide cuántas aprobaciones autorizan un pago. La dirección de la bóveda no cambia.",
                  "Start with your wallet, add your team, and decide how many approvals authorize a payment. The vault address stays the same.",
                )}
              </p>
              <div
                className="approval-visual"
                role="img"
                aria-label={t(
                  "Ejemplo de regla 2 de 3: dos personas ya aprobaron.",
                  "Example 2-of-3 rule: two people have approved.",
                )}
              >
                <div className="approval-people" aria-hidden="true">
                  {approvers.map(({ initial, name, approved }) => (
                    <div
                      key={initial}
                      className={approved ? "is-approved" : undefined}
                    >
                      <span className="approval-avatar">
                        {initial}
                        {approved && (
                          <span className="approval-check">
                            <Check size={11} strokeWidth={3} />
                          </span>
                        )}
                      </span>
                      <small>{name}</small>
                    </div>
                  ))}
                </div>
                <div className="approval-result" aria-hidden="true">
                  <strong>{t("2 de 3", "2 of 3")}</strong>
                  <span>{t("Aprobado · pagado", "Approved · paid")}</span>
                </div>
              </div>
            </article>
            {features.map(({ icon: Icon, title, body }) => (
              <article className="landing-feature" key={title}>
                <Icon size={22} strokeWidth={1.5} aria-hidden="true" />
                <div>
                  <h3>{title}</h3>
                  <p>{body}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section
        className="landing-security landing-width"
        id="security"
        aria-labelledby="security-title"
      >
        <div className="landing-section-heading">
          <p className="landing-kicker">
            {t("Seguridad y custodia", "Security & custody")}
          </p>
          <h2 id="security-title">
            {t(
              "El contrato guarda el dinero.\nTu equipo decide.",
              "The contract holds the money.\nYour team decides.",
            )}
          </h2>
          <p>
            {t(
              "Tu bóveda tiene su propia dirección en Stellar. El contrato exige las aprobaciones acordadas para pagar o cambiar el equipo.",
              "Your vault has its own address on Stellar. The contract requires the agreed approvals for payments and team changes.",
            )}
          </p>
        </div>
        <div className="landing-security-grid">
          <div
            className="landing-contract-model"
            aria-label={t(
              "Modelo de custodia de SoroSafe",
              "SoroSafe custody model",
            )}
          >
            <div className="contract-model-top">
              <KeyRound size={21} strokeWidth={1.5} aria-hidden="true" />
              <span>{t("Wallets del equipo", "Team wallets")}</span>
            </div>
            <div className="contract-model-connection">
              <span>
                {t(
                  "Firman según la regla acordada",
                  "Sign according to the agreed rule",
                )}
              </span>
              <ArrowDownRight size={24} strokeWidth={1.5} aria-hidden="true" />
            </div>
            <div className="contract-model-vault">
              <ShieldCheck size={32} strokeWidth={1.4} aria-hidden="true" />
              <strong>{t("Bóveda SoroSafe", "SoroSafe vault")}</strong>
              <span>
                {t("Smart contract en Stellar", "Smart contract on Stellar")}
              </span>
              <div>
                <span>{t("Fondos", "Funds")}</span>
                <span>{t("Reglas", "Rules")}</span>
                <span>{t("Aprobaciones", "Approvals")}</span>
              </div>
            </div>
          </div>
          <div className="landing-security-points">
            {[
              [
                t(
                  "Sin una llave de retiro de SoroSafe",
                  "No SoroSafe withdrawal key",
                ),
                t(
                  "Quien creó la app no tiene acceso privilegiado a los fondos. El contrato exige la regla de tu equipo.",
                  "The app's creator has no privileged access to the funds. The contract enforces your team's rule.",
                ),
              ],
              [
                t(
                  "Reglas que también se cumplen fuera de la app",
                  "Rules enforced beyond the app",
                ),
                t(
                  "La custodia y las aprobaciones viven en Stellar. La interfaz facilita usarlas; el contrato es quien las aplica.",
                  "Custody and approvals live on Stellar. The interface makes them easy to use; the contract enforces them.",
                ),
              ],
              [
                t(
                  "Una sola clave no basta si tu regla exige más",
                  "One key is not enough when your rule requires more",
                ),
                t(
                  "Con una regla de varias aprobaciones, una clave expuesta no puede autorizar un pago. Una bóveda 1 de 1 depende de su único firmante.",
                  "With a multi-approval rule, one exposed key cannot authorize a payment. A 1-of-1 vault depends on its only signer.",
                ),
              ],
            ].map(([title, body]) => (
              <article key={title}>
                <Check size={21} strokeWidth={1.7} aria-hidden="true" />
                <div>
                  <h3>{title}</h3>
                  <p>{body}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
        <p className="landing-security-note">
          {t(
            "La seguridad depende del código, las claves y la configuración. Los contratos actuales aún no cuentan con una auditoría independiente.",
            "Security depends on the code, keys, and configuration. The current contracts have not yet been independently audited.",
          )}
        </p>
      </section>

      <section
        className="landing-stellar landing-width"
        id="stellar"
        aria-labelledby="stellar-title"
      >
        <div className="landing-stellar-intro">
          <div className="landing-stellar-title">
            <div className="landing-stellar-signature">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/assets/xlm.svg" alt="" width="34" height="34" />
              <span>Stellar</span>
            </div>
            <h2 id="stellar-title">
              {t(
                "Una red hecha para mover dinero.",
                "A network built to move money.",
              )}
            </h2>
            <p>
              {t(
                "Pagos rápidos, costes de red bajos y activos digitales. La base para que compartir dinero sea una tarea cotidiana.",
                "Fast payments, low network costs, and digital assets. The foundation for making shared money an everyday experience.",
              )}
            </p>
            <a
              className="landing-text-link"
              href="https://stellar.org/learn/intro-to-stellar"
              target="_blank"
              rel="noreferrer"
            >
              {t("Conoce Stellar", "Discover Stellar")}
              <ArrowUpRight size={17} aria-hidden="true" />
            </a>
          </div>
          <div className="landing-network-benefits">
            {[
              {
                icon: Zap,
                title: t(
                  "Decisiones que avanzan",
                  "Decisions that move forward",
                ),
                body: t(
                  "Una red pensada para pagos, con confirmaciones en segundos y costes que revisas antes de firmar.",
                  "A network built for payments, with confirmations in seconds and costs you review before signing.",
                ),
              },
              {
                icon: Globe2,
                title: t(
                  "Tu equipo, en cualquier lugar",
                  "Your team, anywhere",
                ),
                body: t(
                  "Una dirección compartida, acceso a cualquier hora y un registro que todos pueden comprobar.",
                  "One shared address, around-the-clock access, and a record everyone can check.",
                ),
              },
            ].map(({ icon: Icon, title, body }) => (
              <article key={title}>
                <Icon size={22} strokeWidth={1.5} aria-hidden="true" />
                <div>
                  <h3>{title}</h3>
                  <p>{body}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
        <h3 className="landing-integrations-title">
          {t(
            "Stellar, detrás de cada firma",
            "Stellar, behind every signature",
          )}
        </h3>
        <div className="landing-integration-list">
          {integrations.map(
            ({ name, label, body, href, icon: Icon }, index) => (
              <details
                key={name}
                open={index === 0}
                name="stellar-integrations"
              >
                <summary>
                  <Icon size={21} strokeWidth={1.5} aria-hidden="true" />
                  <span className="integration-text">
                    <span className="integration-name">{name}</span>
                    <span className="integration-label">{label}</span>
                  </span>
                  <ChevronDown
                    size={18}
                    className="disclosure-icon"
                    aria-hidden="true"
                  />
                </summary>
                <div className="integration-detail">
                  <p>{body}</p>
                  <a href={href} target="_blank" rel="noreferrer">
                    {t("Documentación oficial", "Official documentation")}
                    <ArrowUpRight size={15} aria-hidden="true" />
                  </a>
                </div>
              </details>
            ),
          )}
        </div>
      </section>

      <section
        className="landing-questions landing-width"
        id="faq"
        aria-labelledby="questions-title"
      >
        <div>
          <p className="landing-kicker">
            {t("Preguntas frecuentes", "FAQ")}
          </p>
          <h2 id="questions-title">
            {t("Antes de empezar.", "Before you start.")}
          </h2>
        </div>
        <div>
          {questions.map(({ title, body }) => (
            <details key={title}>
              <summary>
                {title}
                <ChevronDown
                  size={19}
                  className="disclosure-icon"
                  aria-hidden="true"
                />
              </summary>
              <p>{body}</p>
            </details>
          ))}
        </div>
      </section>
      {chain.id === "testnet" && (
        <div
          className="landing-try landing-width"
          aria-labelledby="try-title"
          role="region"
        >
          <div className="landing-assets">
            <div className="landing-asset-logos" aria-hidden="true">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/assets/xlm.svg" width="40" height="40" alt="" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/assets/usdc.svg" width="40" height="40" alt="" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/assets/usdt0.svg" width="40" height="40" alt="" />
            </div>
            <div>
              <p className="landing-kicker">
                {t("Pruébalo en Testnet", "Try it on Testnet")}
              </p>
              <h3 id="try-title">
                {t(
                  "XLM, USDC y USDT0, listos para probar.",
                  "XLM, USDC, and USDT0, ready to test.",
                )}
              </h3>
              <p>
                {t(
                  "Pruébalo con dólares de prueba (USDC, USDT0) y XLM. Un botón te da fondos de prueba. Sin dinero real.",
                  "Try it with test dollars (USDC, USDT0) and XLM. One button gets you test funds. No real money involved.",
                )}
              </p>
            </div>
          </div>
        </div>
      )}
      <section
        className="onboarding landing-create"
        id="create-vault"
        aria-label={t("Crear una bóveda", "Create a vault")}
      >
        {children}
      </section>
    </main>
  );
}

export function LandingFooter({ es }: { es: boolean }) {
  return (
    <footer className="landing-footer">
      <div className="landing-width">
        <div className="landing-footer-top">
          <p>
            {es ? "Hecho para decidir juntos." : "Made to decide together."}
          </p>
          <a href="#landing-main">
            {es ? "Volver arriba" : "Back to top"}
            <ArrowUpRight size={17} aria-hidden="true" />
          </a>
        </div>
        <BrandWordmark className="landing-footer-wordmark" />
        <div className="landing-footer-bottom">
          <span>{es ? "Construido sobre Stellar." : "Built on Stellar."}</span>
          <span>
            {es
              ? "Proyecto independiente del ecosistema Stellar."
              : "An independent project in the Stellar ecosystem."}
          </span>
          <div className="landing-footer-links">
            <a href="/brand/sorosafe-logo.svg" download>
              {es ? "Descargar logo" : "Download logo"}
              <ArrowUpRight size={14} aria-hidden="true" />
            </a>
            <a
              href="https://github.com/ffarinas/sorosafe"
              target="_blank"
              rel="noopener noreferrer"
            >
              {es ? "Código fuente" : "Source code"}
              <ArrowUpRight size={14} aria-hidden="true" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
