import type { ReactNode } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  BookUser,
  Check,
  ChevronDown,
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

// Preserve the existing monochrome brand. Design variance 5, motion 3, density 3.
// This is marketing content, never an example wallet or a simulated balance.
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
        "Las reglas viven en el contrato",
        "The rules live in the contract",
      ),
      body: t(
        "Cada bóveda es un smart contract con dirección propia. Una factory registra su origen y la app verifica el código antes de operar.",
        "Every vault is a smart contract with its own address. A factory records its origin, and the app verifies the code before operating.",
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
        "Conecta tu wallet y revisa cada operación antes de firmar. Las claves privadas permanecen contigo; SoroSafe no te pide tu frase de recuperación.",
        "Connect your wallet and review every operation before signing. Your private keys stay with you; SoroSafe never asks for your recovery phrase.",
      ),
      href: "https://www.freighter.app/",
      icon: KeyRound,
    },
    {
      name: "SEP-10",
      label: t(
        "Acceso sin otra contraseña",
        "Sign in without another password",
      ),
      body: t(
        "La autenticación estándar de Stellar permite demostrar que controlas tu wallet. Entrar a SoroSafe y autorizar un pago son acciones separadas.",
        "Stellar's standard authentication proves that you control your wallet. Signing into SoroSafe and authorizing a payment are separate actions.",
      ),
      href: "https://developers.stellar.org/docs/build/apps/wallet/sep10",
      icon: Fingerprint,
    },
    {
      name: "Stellar Asset Contracts",
      label: t(
        "Cada moneda tiene identidad propia",
        "Every currency has its own identity",
      ),
      body: t(
        "Los activos se identifican por su contrato, código y emisor. El pago conserva la moneda elegida desde que lo preparas hasta que firmas.",
        "Assets are identified by their contract, code, and issuer. A payment keeps your selected currency from preparation through signing.",
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
        "Saldos, firmantes y aprobaciones se consultan directamente en Stellar. Al confirmar una operación, puedes abrir su recibo en Stellar Expert.",
        "Balances, signers, and approvals are read directly from Stellar. When an operation is confirmed, you can open its receipt in Stellar Expert.",
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
        "La multifirma nativa de Stellar también protege mediante umbrales. Nuestro contrato añade una dirección propia para la bóveda, solicitudes y aprobaciones en cadena, reglas para cambiar el equipo y comisiones programadas. SoroSafe une esa base con una experiencia de trabajo compartida.",
        "Stellar's native multisig also protects funds through thresholds. Our contract adds a dedicated vault address, on-chain requests and approvals, rules for team changes, and programmed fees. SoroSafe combines that foundation with a shared working experience.",
      ),
    },
    {
      title: t(
        "¿Qué pasa si se expone la clave de una persona?",
        "What if someone's private key is exposed?",
      ),
      body: t(
        "Si la regla exige más de una firma, una sola clave no basta para autorizar un pago. Con una regla de 1 de 1, la seguridad depende del único firmante. Esta protección por umbral existe tanto en nuestro contrato como en una multifirma nativa bien configurada.",
        "If the rule requires more than one signature, a single key cannot authorize a payment. With a 1-of-1 rule, security depends on the only signer. Threshold protection exists in both our contract and a correctly configured native multisig.",
      ),
    },
    {
      title: t(
        "¿SoroSafe puede mover mi dinero?",
        "Can SoroSafe move my money?",
      ),
      body: t(
        "SoroSafe no tiene una clave de retiro ni un administrador con acceso a los fondos. Los pagos y cambios de firmantes deben cumplir la regla de la bóveda. Los contratos actuales no se pueden actualizar.",
        "SoroSafe has no withdrawal key or administrator with access to the funds. Payments and signer changes must meet the vault's approval rule. The current contracts cannot be upgraded.",
      ),
    },
    {
      title: t(
        "¿Qué depende de los servidores de SoroSafe?",
        "What depends on SoroSafe's servers?",
      ),
      body: t(
        "Los nombres, contactos compartidos e invitaciones necesitan nuestros servicios. Los fondos, reglas y aprobaciones viven en Stellar. La vista directa del contrato permite operar sin el backend de SoroSafe, usando una interfaz compatible y acceso a la red.",
        "Names, shared contacts, and invitations use our services. Funds, rules, and approvals live on Stellar. The direct contract view lets you operate without SoroSafe's backend, using a compatible interface and access to the network.",
      ),
    },
    {
      title: t("¿Qué puedo probar hoy?", "What can I try today?"),
      body:
        chain.id === "testnet"
          ? t(
              "La demo funciona en Testnet con XLM, USDC y USDT0 de prueba. SoroSafe consigue XLM de Friendbot por ti, y un botón te da USDT0 de prueba. USDT0 aún no existe en Testnet, así que este es un token de prueba emitido por SoroSafe con suministro fijo. Mainnet, con USDC y USDT0 oficiales, es el siguiente paso. El contrato todavía no cuenta con una auditoría independiente.",
              "The demo runs on Testnet with test XLM, USDC, and USDT0. SoroSafe gets XLM from Friendbot for you, and one button gives you test USDT0. USDT0 has no Testnet deployment yet, so this is a fixed-supply test token issued by SoroSafe. Mainnet, with official USDC and USDT0, is the next step. The contract has not yet been independently audited.",
            )
          : t(
              "Consulta las monedas admitidas y sus saldos dentro de tu bóveda. La compatibilidad depende de los activos permitidos por su contrato; un símbolo de moneda por sí solo no identifica un activo.",
              "Check supported currencies and their balances inside your vault. Compatibility depends on the assets allowed by its contract; a currency symbol alone does not identify an asset.",
            ),
    },
  ];
  return (
    <main className="landing" lang={es ? "es" : "en"} id="landing-main">
      <section className="landing-hero landing-width">
        <div className="landing-hero-copy" data-product-tour="intro-story">
          <p className="landing-kicker">
            {t(
              "Bóvedas multifirma sobre Stellar",
              "Multisig vaults built on Stellar",
            )}
          </p>
          <h1>
            {t("Multifirma.", "Multisig.")}
            <br />
            <span>{t("Para tu equipo.", "For your team.")}</span>
          </h1>
          <p className="landing-lead">
            {t(
              "Comparte el control del dinero. Tu equipo elige quién firma y cuántas aprobaciones necesita cada pago. El contrato hace cumplir esa regla.",
              "Share control of your funds. Your team chooses who signs and how many approvals each payment needs. The contract enforces that rule.",
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
            <a className="landing-text-link" href="#why">
              {t("Conocer SoroSafe", "Explore SoroSafe")}
              <ArrowDownRight size={18} aria-hidden="true" />
            </a>
          </div>
        </div>
        <div className="landing-hero-art">
          {/* Optimized local image. Decorative metaphor, never a product simulation. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/shared-control.webp"
            width="1448"
            height="1086"
            fetchPriority="high"
            alt=""
          />
        </div>
      </section>

      <section
        className="landing-stellar landing-width"
        id="stellar"
        aria-labelledby="stellar-title"
      >
        <div className="landing-stellar-title">
          <div className="landing-stellar-signature">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/assets/xlm.svg" alt="" width="38" height="38" />
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
              title: t("Decisiones que avanzan", "Decisions that move forward"),
              body: t(
                "Una red orientada a pagos, con confirmaciones rápidas y costes que puedes revisar antes de firmar.",
                "A payment-focused network, with fast confirmation and costs you can review before signing.",
              ),
            },
            {
              icon: Globe2,
              title: t(
                "El equipo puede estar en cualquier lugar",
                "Your team can be anywhere",
              ),
              body: t(
                "Una dirección compartida, acceso a la red a cualquier hora y un registro que todos pueden comprobar.",
                "One shared address, around-the-clock network access, and a record everyone can verify.",
              ),
            },
            {
              icon: Layers3,
              title: t(
                "Dinero con reglas programables",
                "Money with programmable rules",
              ),
              body: t(
                "Soroban aplica las decisiones del equipo. Los Stellar Asset Contracts permiten operar con los activos admitidos por la bóveda.",
                "Soroban enforces your team's decisions. Stellar Asset Contracts let you use the assets your vault supports.",
              ),
            },
          ].map(({ icon: Icon, title, body }) => (
            <article key={title}>
              <Icon size={23} strokeWidth={1.5} aria-hidden="true" />
              <div>
                <h3>{title}</h3>
                <p>{body}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section
        className="landing-integrations landing-width"
        aria-labelledby="integrations-title"
      >
        <div className="landing-illustrated-heading">
          <div className="landing-section-heading">
            <h2 id="integrations-title">
              {t(
                "Stellar, detrás de cada firma.",
                "Stellar, behind every signature.",
              )}
            </h2>
            <p>
              {t(
                "Herramientas del ecosistema, conectadas para que tú puedas concentrarte en tu equipo.",
                "Ecosystem tools, connected so you can focus on your team.",
              )}
            </p>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="landing-section-art"
            src="/brand/stellar-orbits.webp"
            width="768"
            height="576"
            loading="lazy"
            decoding="async"
            alt=""
            aria-hidden="true"
          />
        </div>
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
                  <span className="integration-name">{name}</span>
                  <span className="integration-label">{label}</span>
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
        {chain.id === "testnet" && (
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
              <h3>
                {t(
                  "XLM, USDC y USDT0, para probar el flujo.",
                  "XLM, USDC, and USDT0, to try the flow.",
                )}
              </h3>
              <p>
                {t(
                  "Los dos stablecoins con su logo oficial, más XLM. Consigue USDT0 de prueba con un botón (emitido por SoroSafe, porque USDT0 aún no existe en Testnet) y USDC de Circle. Fondos sin valor real; Mainnet es el siguiente paso.",
                  "Both stablecoins with their official logos, plus XLM. Get test USDT0 with one button (issued by SoroSafe, since USDT0 isn't on Testnet yet) and Circle's USDC. No real value; Mainnet is the next step.",
                )}
              </p>
            </div>
          </div>
        )}
      </section>

      <section className="landing-why" id="why" aria-labelledby="why-title">
        <div className="landing-width">
          <div className="landing-illustrated-heading">
            <div className="landing-section-heading">
              <p className="landing-kicker">
                {t("Por qué existe SoroSafe", "Why SoroSafe exists")}
              </p>
              <h2 id="why-title">
                {t(
                  "La multifirma\ndebería ser sencilla.",
                  "Multisig\nshould feel simple.",
                )}
              </h2>
              <p>
                {t(
                  "Controlar el dinero entre varias personas no debería complicar cada pago. SoroSafe reúne firmantes, contactos y aprobaciones en una misma bóveda.",
                  "Sharing control of funds should not complicate every payment. SoroSafe brings signers, contacts, and approvals together in one vault.",
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
              <BookUser size={32} strokeWidth={1.4} aria-hidden="true" />
              <h3>
                {t(
                  "Los contactos\nson del equipo.",
                  "Contacts belong\nto the team.",
                )}
              </h3>
              <p>
                {t(
                  "La misma libreta para todos. Conoce quién añadió cada dirección y si ya recibió pagos de la bóveda.",
                  "One address book for everyone. See who added an address and whether it has received payments from the vault.",
                )}
              </p>
              <div className="feature-principle">
                <Users size={19} aria-hidden="true" />
                {t("El contexto se comparte.", "Context is shared.")}
              </div>
            </article>
            <article className="landing-feature">
              <h3>
                {t(
                  "Varios firmantes.\nUna misma bóveda.",
                  "Multiple signers.\nOne shared vault.",
                )}
              </h3>
              <p>
                {t(
                  "Empieza con tu wallet. Añade firmantes y define cuántas firmas autorizan un pago, sin cambiar la dirección de la bóveda.",
                  "Start with your wallet. Add signers and set how many signatures authorize a payment, keeping the same vault address.",
                )}
              </p>
            </article>
            <article className="landing-feature">
              <h3>
                {t(
                  "Firma con\nel contexto completo.",
                  "Sign with\nthe full picture.",
                )}
              </h3>
              <p>
                {t(
                  "Destinatario, moneda, importe y comisiones, antes de confirmar. La aprobación que completa la regla también completa el pago, si hay saldo.",
                  "Recipient, currency, amount, and fees, before confirming. The approval that meets the rule also completes the payment when funds are available.",
                )}
              </p>
            </article>
          </div>
        </div>
      </section>

      <section
        className="landing-security landing-width"
        id="security"
        aria-labelledby="security-title"
      >
        <div className="landing-section-heading">
          <h2 id="security-title">
            {t(
              "El contrato guarda el dinero.\nTu equipo decide.",
              "The contract holds the money.\nYour team decides.",
            )}
          </h2>
          <p>
            {t(
              "Tu bóveda multifirma tiene su propia dirección en Stellar. El contrato exige las aprobaciones acordadas para pagar o cambiar el equipo.",
              "Your multisig vault has its own address on Stellar. The contract requires the agreed approvals for payments and team changes.",
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
                  "El creador de la app no tiene acceso privilegiado a los fondos. El contrato exige la regla de tu equipo.",
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
                  "Una sola firma no basta si tu regla exige más",
                  "One signature is not enough when your rule requires more",
                ),
                t(
                  "Configura un umbral de varias firmas para compartir el control. Una bóveda 1 de 1 depende de su único firmante.",
                  "Set a threshold of multiple signatures to share control. A 1-of-1 vault depends on its only signer.",
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
        className="landing-questions landing-width"
        aria-labelledby="questions-title"
      >
        <h2 id="questions-title">
          {t("Antes de empezar.", "Before you start.")}
        </h2>
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
          <a href="/brand/sorosafe-wordmark.svg" download>
            {es ? "Descargar logo" : "Download logo"}
            <ArrowUpRight size={14} aria-hidden="true" />
          </a>
        </div>
      </div>
    </footer>
  );
}
