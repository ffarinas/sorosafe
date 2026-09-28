"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import {
  ArrowUpRight,
  ArrowDownLeft,
  ArrowLeft,
  Check,
  ChevronRight,
  CircleDollarSign,
  Copy,
  Eye,
  Globe2,
  Info,
  Plus,
  QrCode,
  RotateCcw,
  Search,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "@/components/ui/dialog";
import styles from "./tokens.module.css";

type Code = "USDC" | "USDT0" | "XLM" | "EURC";
type Coin = {
  code: Code;
  name: string;
  issuerName: string;
  issuer: string;
  source: string;
  rate: number;
};
// Mainnet identities are reference data only. This page never builds or sends transactions.
const coins: Coin[] = [
  {
    code: "USDC",
    name: "USD Coin",
    issuerName: "Circle",
    issuer: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
    source: "https://developers.circle.com/stablecoins/usdc-contract-addresses",
    rate: 1,
  },
  {
    code: "USDT0",
    name: "USDT0",
    issuerName: "USDT0",
    issuer: "GATISXX6BZ6NC7IKQBY37CJD4SOZL3CYZJWXEDG6JVIY4WBS6KXJHN6Q",
    source: "https://developers.stellar.org/launch/usdt0",
    rate: 1,
  },
  {
    code: "XLM",
    name: "Stellar Lumens",
    issuerName: "Stellar",
    issuer: "",
    source: "https://developers.stellar.org/docs/learn/fundamentals/lumens",
    rate: 0.25,
  },
  {
    code: "EURC",
    name: "EURC",
    issuerName: "Circle",
    issuer: "GDHU6WRG4IEQXM5NZ4BMPKOXHW76MZM4Y2IEMFDVXBSDP6SJY4ITNPP2",
    source: "https://developers.circle.com/stablecoins/eurc-contract-addresses",
    rate: 1.1,
  },
];
type Request = {
  id: string;
  kind: "payment" | "enable";
  code: Code;
  amount: number;
  contact: string;
  note: string;
  approvals: number;
  done: boolean;
};
const startingBalances: Record<Code, number> = {
  USDC: 12450,
  USDT0: 3250,
  XLM: 120,
  EURC: 0,
};
const initialRequests: Request[] = [
  {
    id: "hotel",
    kind: "payment",
    code: "USDC",
    amount: 1250,
    contact: "Hotel Miradouro",
    note: "Alojamiento · Meridian 2026",
    approvals: 2,
    done: false,
  },
];
const contacts = ["Hotel Miradouro", "Proveedor de agua", "Pedro"];
const people = ["Ana", "Pedro", "Lucía", "Sofía", "Diego"];
const demoFee = 0.00001;

function CoinMark({ code }: { code: Code }) {
  return (
    <span
      className={`${styles.coinMark} ${styles[code.toLowerCase()]}`}
      aria-hidden="true"
    >
      {code === "USDC" ? (
        <CircleDollarSign size={30} strokeWidth={1.5} />
      ) : code === "USDT0" ? (
        <span>
          ₮<small>0</small>
        </span>
      ) : code === "EURC" ? (
        "€"
      ) : (
        <svg viewBox="0 0 32 32" width="28" height="28" fill="none">
          <circle cx="16" cy="16" r="9" stroke="currentColor" strokeWidth="2" />
          <path
            d="M3 23 29 9M3 18 29 4"
            stroke="currentColor"
            strokeWidth="2.5"
          />
        </svg>
      )}
    </span>
  );
}

export default function TokensPreview() {
  const [es, setEs] = useState(true);
  const [enabled, setEnabled] = useState<Code[]>(["USDC", "USDT0", "XLM"]);
  const [balances, setBalances] = useState(startingBalances);
  const [requests, setRequests] = useState<Request[]>(initialRequests);
  const [view, setView] = useState<"coins" | "activity">("coins");
  const [modal, setModal] = useState("");
  const [selected, setSelected] = useState<Code>("USDC");
  const [search, setSearch] = useState("");
  const [contact, setContact] = useState(contacts[0]);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [review, setReview] = useState(false);
  const [requestId, setRequestId] = useState("hotel");
  const [feedback, setFeedback] = useState("");
  const [formError, setFormError] = useState("");
  const t = (a: string, b: string) => (es ? a : b);
  const format = (n: number, digits = 2) =>
    new Intl.NumberFormat(es ? "es-ES" : "en-US", {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(n);
  const coin = coins.find((c) => c.code === selected)!;
  const current = requests.find((r) => r.id === requestId);
  const pending = requests.filter((r) => !r.done);
  const reserve =
    (2 + people.length + enabled.filter((c) => c !== "XLM").length) * 0.5;
  const allocated = (code: Code) =>
    pending
      .filter((r) => r.kind === "payment" && r.code === code)
      .reduce((sum, r) => sum + r.amount, 0);
  const available = (code: Code) =>
    Math.max(
      0,
      balances[code] -
        allocated(code) -
        (code === "XLM"
          ? reserve +
            pending.length * demoFee +
            pending.filter((r) => r.kind === "enable").length * 0.5
          : 0),
    );
  const total = coins.reduce((sum, c) => sum + balances[c.code] * c.rate, 0);
  useEffect(() => {
    document.documentElement.lang = es ? "es" : "en";
  }, [es]);
  const open = (name: string, code: Code = selected) => {
    setModal(name);
    setSelected(code);
    setFeedback("");
    setFormError("");
  };
  const send = (code: Code = "USDC") => {
    setAmount("");
    setNote("");
    setReview(false);
    setContact(contacts[0]);
    open("send", code);
  };
  const showRequest = (r: Request) => {
    setRequestId(r.id);
    open("request", r.code);
  };
  const add = () => {
    setSearch("");
    open("catalog");
  };
  const reset = () => {
    setEnabled(["USDC", "USDT0", "XLM"]);
    setBalances(startingBalances);
    setRequests(initialRequests);
    setModal("");
    setFeedback("");
    setView("coins");
  };
  const createRequest = (kind: Request["kind"]) => {
    if (
      kind === "enable" &&
      (enabled.includes(selected) ||
        pending.some((r) => r.kind === "enable" && r.code === selected))
    )
      return;
    if (
      kind === "payment" &&
      (!Number.isFinite(Number(amount)) ||
        Number(amount) <= 0 ||
        Number(amount) > available(selected))
    ) {
      setFormError(
        t(
          "Revisa el importe y el saldo disponible.",
          "Check the amount and available balance.",
        ),
      );
      setReview(false);
      return;
    }
    const r: Request = {
      id: crypto.randomUUID(),
      kind,
      code: selected,
      amount: kind === "payment" ? Number(amount) : 0,
      contact,
      note,
      approvals: 0,
      done: false,
    };
    setRequests((prev) => [r, ...prev]);
    setRequestId(r.id);
    open("request");
  };
  const approve = () => {
    if (!current || current.done) return;
    const approvals = current.approvals + 1,
      done = approvals >= 3;
    if (done) {
      setBalances((prev) => ({
        ...prev,
        [current.code]:
          prev[current.code] -
          (current.kind === "payment" ? current.amount : 0),
        XLM:
          prev.XLM -
          (current.kind === "payment" && current.code === "XLM"
            ? current.amount
            : 0) -
          demoFee,
      }));
      if (current.kind === "enable")
        setEnabled((prev) => [...prev, current.code]);
    }
    setRequests((prev) =>
      prev.map((r) => (r.id === current.id ? { ...r, approvals, done } : r)),
    );
  };
  const reviewPayment = (e: FormEvent) => {
    e.preventDefault();
    if (
      !Number.isFinite(Number(amount)) ||
      Number(amount) <= 0 ||
      Number(amount) > available(selected)
    ) {
      setFormError(
        t(
          "El importe debe ser mayor que cero y no superar el saldo disponible.",
          "Enter an amount greater than zero and within the available balance.",
        ),
      );
      return;
    }
    setFormError("");
    setReview(true);
  };
  const title =
    modal === "catalog"
      ? t("Añadir moneda", "Add currency")
      : modal === "enable"
        ? t(`Habilitar ${selected}`, `Enable ${selected}`)
        : modal === "send"
          ? review
            ? t("Revisa tu pago", "Review your payment")
            : t("Preparar un pago", "Prepare a payment")
          : modal === "receive"
            ? t(`Recibir ${selected}`, `Receive ${selected}`)
            : modal === "request"
              ? current?.kind === "enable"
                ? t(`Habilitar ${current.code}`, `Enable ${current.code}`)
                : t("Detalle del pago", "Payment details")
              : modal === "valuation"
                ? t("Cómo se calcula el saldo", "How the balance is calculated")
                : selected;

  return (
    <div className={`app ${styles.preview}`}>
      <header className="topbar">
        <Link href="/" className="brand" aria-label="Junto">
          <span className="brand-icon">j</span>junto
          <span className="brand-dot">.</span>
        </Link>
        <div className="header-right">
          <Link className={styles.back} href="/">
            <ArrowLeft size={15} />
            {t("Volver a Junto", "Back to Junto")}
          </Link>
          <button
            className="language"
            aria-label={t("Cambiar a inglés", "Switch to Spanish")}
            onClick={() => setEs(!es)}
          >
            <Globe2 size={16} />
            {es ? "ES" : "EN"}
          </button>
        </div>
      </header>
      <div className={styles.previewBar}>
        <div>
          <Eye size={16} />
          <strong>
            {t("Vista previa interactiva", "Interactive preview")}
          </strong>
          <span>
            {t(
              "Saldos de ejemplo. Sin movimientos de dinero.",
              "Sample balances. No money moves.",
            )}
          </span>
        </div>
        <button
          onClick={reset}
          aria-label={t("Restablecer vista previa", "Reset preview")}
        >
          <RotateCcw size={14} />
          <span>{t("Restablecer", "Reset")}</span>
        </button>
      </div>
      <main className={styles.main}>
        <div className={styles.heading}>
          <div>
            <p className="eyebrow">
              {t("Bóveda compartida", "Shared vault")} <span> / </span> Stellar
            </p>
            <h1>Meridian · Lisboa 2026</h1>
            <p className={styles.teamMeta}>
              <ShieldCheck size={16} />
              {t(
                "3 de 5 personas aprueban cada operación",
                "3 of 5 people approve each operation",
              )}
            </p>
          </div>
          <div className={styles.team}>
            <div className="avatar-stack">
              {people.map((p) => (
                <span className="avatar" key={p} title={p}>
                  {p[0]}
                </span>
              ))}
            </div>
            <span>{t("Tu equipo", "Your team")}</span>
          </div>
        </div>
        <div className={styles.summary}>
          <section
            className={styles.total}
            aria-label={t("Saldo estimado", "Estimated balance")}
          >
            <div className={styles.totalLabel}>
              {t("Saldo estimado de la bóveda", "Estimated vault balance")}
              <button
                onClick={() => open("valuation")}
                aria-label={t(
                  "Ver cálculo del saldo",
                  "View balance calculation",
                )}
              >
                <Info size={17} />
              </button>
            </div>
            <p className={styles.totalAmount}>
              {format(total)} <span>USD</span>
            </p>
            <p className={styles.totalNote}>
              {t(
                "Cada moneda conserva su propio saldo.",
                "Each currency keeps its own balance.",
              )}
            </p>
            <div className={styles.heroActions}>
              <button onClick={() => send()}>
                <ArrowUpRight size={18} />
                {t("Enviar", "Send")}
              </button>
              <button onClick={() => open("receive", "USDC")}>
                <ArrowDownLeft size={18} />
                {t("Recibir", "Receive")}
              </button>
              <span>{t("Conversión de ejemplo", "Sample conversion")}</span>
            </div>
          </section>
          <section
            className={styles.pending}
            aria-label={t("Por aprobar", "To approve")}
          >
            <div className={styles.pendingTitle}>
              <span>{t("Por aprobar", "To approve")}</span>
              <span className="badge">{pending.length}</span>
            </div>
            {pending.length ? (
              <>
                <h2>
                  {pending[0].kind === "enable"
                    ? t(
                        `Habilitar ${pending[0].code}`,
                        `Enable ${pending[0].code}`,
                      )
                    : pending[0].contact}
                </h2>
                <p className={styles.pendingAmount}>
                  {pending[0].kind === "payment"
                    ? `${format(pending[0].amount)} ${pending[0].code}`
                    : t(
                        "Una nueva moneda para todo el equipo",
                        "A new currency for the whole team",
                      )}
                </p>
                <div className={styles.progress}>
                  {[1, 2, 3].map((n) => (
                    <span
                      className={n <= pending[0].approvals ? styles.filled : ""}
                      key={n}
                    />
                  ))}
                  <small>{pending[0].approvals} / 3</small>
                </div>
                <button
                  className="text-button"
                  onClick={() => showRequest(pending[0])}
                >
                  {t("Revisar solicitud", "Review request")}
                  <ArrowUpRight size={17} />
                </button>
              </>
            ) : (
              <>
                <h2>{t("Todo al día.", "All caught up.")}</h2>
                <p>
                  {t(
                    "Las próximas solicitudes del equipo aparecerán aquí.",
                    "Your team’s next requests will appear here.",
                  )}
                </p>
              </>
            )}
          </section>
        </div>
        <section className={styles.currencies}>
          <div className={styles.sectionHeading}>
            <div
              className={styles.viewTabs}
              role="tablist"
              onKeyDown={(e) => {
                if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key))
                  return;
                e.preventDefault();
                const next =
                  e.key === "Home"
                    ? "coins"
                    : e.key === "End"
                      ? "activity"
                      : view === "coins"
                        ? "activity"
                        : "coins";
                setView(next);
                document.getElementById(`${next}-tab`)?.focus();
              }}
              aria-label={t("Monedas y movimientos", "Currencies and activity")}
            >
              <button
                role="tab"
                id="coins-tab"
                aria-controls="coins-panel"
                aria-selected={view === "coins"}
                tabIndex={view === "coins" ? 0 : -1}
                onClick={() => setView("coins")}
              >
                {t("Monedas", "Currencies")}
                <span>{enabled.length}</span>
              </button>
              <button
                role="tab"
                id="activity-tab"
                aria-controls="activity-panel"
                aria-selected={view === "activity"}
                tabIndex={view === "activity" ? 0 : -1}
                onClick={() => setView("activity")}
              >
                {t("Movimientos", "Activity")}
              </button>
            </div>
            <button className="secondary" onClick={add}>
              <Plus size={17} />
              {t("Añadir moneda", "Add currency")}
            </button>
          </div>
          {view === "coins" ? (
            <div role="tabpanel" id="coins-panel" aria-labelledby="coins-tab">
              <div className={styles.columnHead} aria-hidden="true">
                <span>{t("Moneda", "Currency")}</span>
                <span>{t("Saldo", "Balance")}</span>
                <span>{t("Disponible", "Available")}</span>
                <span />
              </div>
              {coins
                .filter((c) => enabled.includes(c.code))
                .map((c) => (
                  <article
                    className={styles.assetRow}
                    key={c.code}
                    aria-label={c.code}
                  >
                    <button
                      className={styles.assetIdentity}
                      onClick={() => open("details", c.code)}
                      aria-label={t(
                        `Ver detalles de ${c.code}`,
                        `View ${c.code} details`,
                      )}
                    >
                      <CoinMark code={c.code} />
                      <span>
                        <strong>
                          {c.code}
                          <ChevronRight size={13} />
                        </strong>
                        <small>
                          {c.code === "USDT0" ? "Tether USD · USDT0" : c.name}
                        </small>
                      </span>
                    </button>
                    <div className={styles.rowBalance}>
                      <small className={styles.mobileLabel}>
                        {t("Saldo", "Balance")}
                      </small>
                      <strong>{format(balances[c.code])}</strong>
                      <span>{c.code}</span>
                    </div>
                    <div className={styles.rowAvailable}>
                      <small className={styles.mobileLabel}>
                        {t("Disponible", "Available")}
                      </small>
                      <strong>{format(available(c.code))}</strong>
                      <span>
                        {c.code === "XLM"
                          ? t(
                              `${format(reserve)} XLM de reserva`,
                              `${format(reserve)} XLM reserve`,
                            )
                          : allocated(c.code)
                            ? t(
                                `${format(allocated(c.code))} por aprobar`,
                                `${format(allocated(c.code))} awaiting approval`,
                              )
                            : t("Listo para usar", "Ready to use")}
                      </span>
                    </div>
                    <div className={styles.rowActions}>
                      <button
                        className="secondary"
                        onClick={() => send(c.code)}
                        aria-label={t(`Enviar ${c.code}`, `Send ${c.code}`)}
                      >
                        <ArrowUpRight size={16} />
                        <span>{t("Enviar", "Send")}</span>
                      </button>
                      <button
                        className="icon-button"
                        onClick={() => open("receive", c.code)}
                        aria-label={t(`Recibir ${c.code}`, `Receive ${c.code}`)}
                        title={t("Recibir", "Receive")}
                      >
                        <ArrowDownLeft size={19} />
                      </button>
                    </div>
                  </article>
                ))}
              <p className={styles.sharedNote}>
                <Users size={16} />
                {t(
                  "Las mismas monedas, los mismos saldos, para todo el equipo.",
                  "The same currencies and balances for the whole team.",
                )}
              </p>
            </div>
          ) : (
            <div
              role="tabpanel"
              id="activity-panel"
              aria-labelledby="activity-tab"
              className={styles.activity}
            >
              {requests.map((r) => (
                <button
                  key={r.id}
                  className={styles.activityRow}
                  onClick={() => showRequest(r)}
                >
                  <span className={styles.activityIcon}>
                    {r.kind === "enable" ? (
                      <Plus size={20} />
                    ) : (
                      <ArrowUpRight size={20} />
                    )}
                  </span>
                  <span>
                    <strong>
                      {r.kind === "enable"
                        ? t(`Habilitar ${r.code}`, `Enable ${r.code}`)
                        : r.contact}
                    </strong>
                    <small>
                      {r.note || t("Solicitud del equipo", "Team request")}
                    </small>
                  </span>
                  <span className={`badge ${r.done ? "green" : ""}`}>
                    {r.done
                      ? t("Completado · ejemplo", "Completed · sample")
                      : `${r.approvals} / 3`}
                  </span>
                  <strong>
                    {r.kind === "payment"
                      ? `−${format(r.amount)} ${r.code}`
                      : r.code}
                  </strong>
                  <ChevronRight size={15} />
                </button>
              ))}
              <div className={styles.activityRow}>
                <span className={styles.activityIcon}>
                  <ArrowDownLeft size={20} />
                </span>
                <span>
                  <strong>{t("Fondos para el viaje", "Travel funds")}</strong>
                  <small>
                    {t("Ingreso de ejemplo · Ana", "Sample deposit · Ana")}
                  </small>
                </span>
                <span className="badge green">
                  {t("Recibido · ejemplo", "Received · sample")}
                </span>
                <strong>+{format(12450)} USDC</strong>
              </div>
            </div>
          )}
        </section>
        <div className={styles.reserveNote}>
          <ShieldCheck size={22} />
          <div>
            <strong>
              {t(
                "XLM para mantener la bóveda en marcha",
                "XLM keeps the vault running",
              )}
            </strong>
            <p>
              {t(
                "Una pequeña parte queda reservada por la red. El resto permite pagar comisiones o enviarlo como cualquier otra moneda.",
                "A small portion is reserved by the network. The rest can cover fees or be sent like any other currency.",
              )}
            </p>
          </div>
          <button
            className="text-button"
            onClick={() => open("details", "XLM")}
          >
            {t("Ver detalle", "View details")}
            <ArrowUpRight size={16} />
          </button>
        </div>
      </main>
      <footer>
        junto
        <span>
          {t(
            "Hecho para decidir juntos. Construido sobre Stellar.",
            "Made to decide together. Built on Stellar.",
          )}
        </span>
      </footer>
      <Dialog
        open={!!modal}
        onOpenChange={(v) => {
          if (!v) setModal("");
        }}
      >
        <DialogContent
          className={`junto-dialog ${styles.dialog}`}
          showCloseButton={false}
        >
          <DialogClose className="dialog-x" aria-label={t("Cerrar", "Close")}>
            <X size={19} />
          </DialogClose>
          <p className={styles.dialogPreview}>
            <Eye size={13} />
            {t("Vista previa · datos de ejemplo", "Preview · sample data")}
          </p>
          <DialogTitle className="dialog-title">{title}</DialogTitle>
          <DialogDescription className="dialog-description">
            {modal === "catalog"
              ? t(
                  "Elige una moneda para compartirla con tu equipo.",
                  "Choose a currency to share with your team.",
                )
              : modal === "enable"
                ? t(
                    "Cuando el equipo apruebe, la bóveda podrá recibir esta moneda.",
                    "Once your team approves, the vault can receive this currency.",
                  )
                : modal === "send"
                  ? t(
                      "El equipo revisa y aprueba antes de enviar el dinero.",
                      "Your team reviews and approves before money is sent.",
                    )
                  : modal === "receive"
                    ? t(
                        "Comparte la dirección de esta bóveda y la red correcta.",
                        "Share this vault’s address and the correct network.",
                      )
                    : modal === "request"
                      ? t(
                          "Todos revisan la misma operación.",
                          "Everyone reviews the same operation.",
                        )
                      : modal === "valuation"
                        ? t(
                            "Estas cotizaciones son ilustrativas; no son precios de mercado.",
                            "These rates are illustrative, not market prices.",
                          )
                        : t(
                            "Saldo y disponibilidad de esta moneda en la bóveda.",
                            "This currency’s balance and availability in your vault.",
                          )}
          </DialogDescription>
          <div className={styles.dialogBody}>
            {modal === "catalog" ? (
              <>
                <div className={styles.search}>
                  <Search size={17} />
                  <input
                    aria-label={t("Buscar moneda", "Search currencies")}
                    placeholder={t("Buscar moneda", "Search currencies")}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                {coins
                  .filter((c) =>
                    (c.code + c.name)
                      .toLowerCase()
                      .includes(search.toLowerCase()),
                  )
                  .map((c) => {
                    const waiting = pending.find(
                      (r) => r.kind === "enable" && r.code === c.code,
                    );
                    return (
                      <button
                        className={styles.catalogRow}
                        key={c.code}
                        onClick={() =>
                          waiting
                            ? showRequest(waiting)
                            : open(
                                enabled.includes(c.code) ? "details" : "enable",
                                c.code,
                              )
                        }
                      >
                        <CoinMark code={c.code} />
                        <span>
                          <strong>{c.code}</strong>
                          <small>{c.issuerName} · Stellar</small>
                        </span>
                        <span className="badge">
                          {enabled.includes(c.code)
                            ? t("En la bóveda", "In your vault")
                            : waiting
                              ? t("Por aprobar", "Awaiting approval")
                              : t("Añadir", "Add")}
                        </span>
                        <ChevronRight size={16} />
                      </button>
                    );
                  })}
                {!coins.some((c) =>
                  (c.code + c.name)
                    .toLowerCase()
                    .includes(search.toLowerCase()),
                ) ? (
                  <p className={styles.empty}>
                    {t(
                      "No encontramos esa moneda en el catálogo.",
                      "We couldn’t find that currency in the catalog.",
                    )}
                  </p>
                ) : null}
                <p className="footnote">
                  {t(
                    "Cada moneda se identifica por su emisor, además de su nombre.",
                    "Each currency is identified by its issuer as well as its name.",
                  )}
                </p>
              </>
            ) : null}
            {modal === "enable" ? (
              <>
                <div className={styles.coinHeading}>
                  <CoinMark code={selected} />
                  <div>
                    <strong>{selected}</strong>
                    <span>{coin.issuerName} · Stellar</span>
                  </div>
                </div>
                <dl className={styles.facts}>
                  <div>
                    <dt>{t("Disponible para", "Available to")}</dt>
                    <dd>{t("Todo el equipo", "The whole team")}</dd>
                  </div>
                  <div>
                    <dt>{t("Aprobaciones necesarias", "Approvals needed")}</dt>
                    <dd>3 / 5</dd>
                  </div>
                  <div>
                    <dt>{t("Reserva adicional", "Additional reserve")}</dt>
                    <dd>{format(0.5)} XLM</dd>
                  </div>
                  <div>
                    <dt>{t("Comisión de ejemplo", "Sample fee")}</dt>
                    <dd>{format(demoFee, 5)} XLM</dd>
                  </div>
                </dl>
                <p className={styles.infoBox}>
                  {t(
                    "La reserva sigue siendo parte de tu saldo, pero no estará disponible para enviar mientras la moneda esté habilitada.",
                    "The reserve remains part of your balance, but cannot be sent while the currency is enabled.",
                  )}
                </p>
                <button
                  className="primary wide"
                  onClick={() => createRequest("enable")}
                >
                  {t("Solicitar aprobaciones", "Request approvals")}
                  <ArrowUpRight size={17} />
                </button>
              </>
            ) : null}
            {modal === "send" ? (
              <form onSubmit={reviewPayment}>
                {!review ? (
                  <>
                    <label>
                      {t("Pagar a", "Pay to")}
                      <select
                        value={contact}
                        onChange={(e) => setContact(e.target.value)}
                      >
                        {contacts.map((c) => (
                          <option key={c}>{c}</option>
                        ))}
                      </select>
                    </label>
                    <p className={styles.contactHint}>
                      <Users size={14} />
                      {t(
                        "Libreta compartida · añadido por Ana",
                        "Shared address book · added by Ana",
                      )}
                    </p>
                    <div className={styles.paymentFields}>
                      <label>
                        {t("Importe", "Amount")}
                        <input
                          autoFocus
                          type="number"
                          min="0.01"
                          step="0.01"
                          required
                          max={available(selected)}
                          value={amount}
                          placeholder="0.00"
                          onChange={(e) => setAmount(e.target.value)}
                        />
                      </label>
                      <label>
                        {t("Moneda", "Currency")}
                        <select
                          value={selected}
                          onChange={(e) => {
                            setSelected(e.target.value as Code);
                            setFormError("");
                          }}
                        >
                          {coins
                            .filter((c) => enabled.includes(c.code))
                            .map((c) => (
                              <option key={c.code}>{c.code}</option>
                            ))}
                        </select>
                      </label>
                    </div>
                    <p className={styles.availableText}>
                      {t("Disponible", "Available")}:{" "}
                      {format(available(selected))} {selected}
                    </p>
                    <label>
                      {t("Concepto (opcional)", "Note (optional)")}
                      <input
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        maxLength={160}
                        placeholder={t(
                          "Ej. Reserva del alojamiento",
                          "E.g. Accommodation booking",
                        )}
                      />
                    </label>
                    {formError ? (
                      <p role="alert" className={styles.formError}>
                        {formError}
                      </p>
                    ) : null}
                    <button type="submit" className="primary wide">
                      {t("Revisar pago", "Review payment")}
                      <ArrowUpRight size={17} />
                    </button>
                  </>
                ) : (
                  <>
                    <div className={styles.paymentReview}>
                      <CoinMark code={selected} />
                      <p>
                        {format(Number(amount))} <span>{selected}</span>
                      </p>
                      <span>
                        {t("para", "to")} {contact}
                      </span>
                    </div>
                    <dl className={styles.facts}>
                      <div>
                        <dt>{t("Red", "Network")}</dt>
                        <dd>Stellar</dd>
                      </div>
                      <div>
                        <dt>{t("Concepto", "Note")}</dt>
                        <dd>{note || "—"}</dd>
                      </div>
                      <div>
                        <dt>{t("Aprobaciones", "Approvals")}</dt>
                        <dd>3 / 5</dd>
                      </div>
                      <div>
                        <dt>{t("Comisión de ejemplo", "Sample fee")}</dt>
                        <dd>{format(demoFee, 5)} XLM</dd>
                      </div>
                    </dl>
                    <details className={styles.identityDetails}>
                      <summary>
                        {t(
                          "Ver destinatario y moneda",
                          "View recipient and currency",
                        )}
                      </summary>
                      <p>
                        {contact} ·{" "}
                        {t("Dirección de ejemplo", "Sample address")}
                      </p>
                      <p>
                        {selected} · {coin.issuerName}
                      </p>
                      {coin.issuer ? <code>{coin.issuer}</code> : null}
                    </details>
                    <button
                      type="button"
                      className="primary wide"
                      onClick={() => createRequest("payment")}
                    >
                      {t("Solicitar aprobaciones", "Request approvals")}
                      <ArrowUpRight size={17} />
                    </button>
                    <button
                      type="button"
                      className="text-button"
                      onClick={() => setReview(false)}
                    >
                      <ArrowLeft size={15} />
                      {t("Editar pago", "Edit payment")}
                    </button>
                  </>
                )}
              </form>
            ) : null}
            {modal === "receive" ? (
              <>
                <label>
                  {t("Moneda que vas a recibir", "Currency to receive")}
                  <select
                    value={selected}
                    onChange={(e) => {
                      setSelected(e.target.value as Code);
                      setFeedback("");
                    }}
                  >
                    {coins
                      .filter((c) => enabled.includes(c.code))
                      .map((c) => (
                        <option key={c.code}>{c.code}</option>
                      ))}
                  </select>
                </label>
                <div className={styles.receiveCard}>
                  <CoinMark code={selected} />
                  <strong>{selected} · Stellar</strong>
                  <div className={styles.qr}>
                    <QrCode size={112} strokeWidth={1.1} aria-hidden="true" />
                    <span>{t("QR de ejemplo", "Sample QR")}</span>
                  </div>
                  <p>{t("Dirección de la bóveda", "Vault address")}</p>
                  <code>{t("DIRECCIÓN DE EJEMPLO", "SAMPLE ADDRESS")}</code>
                </div>
                <p className={styles.infoBox}>
                  {t(
                    `Recibe ${selected} únicamente por la red Stellar. La persona que envía debe elegir esta misma red.`,
                    `Receive ${selected} only on the Stellar network. The sender must choose the same network.`,
                  )}
                </p>
                <button
                  className="primary wide"
                  onClick={() =>
                    setFeedback(
                      t(
                        "En la versión conectada, este botón copiará la dirección de tu bóveda.",
                        "In the connected version, this button will copy your vault’s address.",
                      ),
                    )
                  }
                >
                  {t("Copiar dirección", "Copy address")}
                  <Copy size={17} />
                </button>
                <p className={styles.feedback} role="status">
                  {feedback}
                </p>
              </>
            ) : null}
            {modal === "details" ? (
              <>
                <div className={styles.coinHeading}>
                  <CoinMark code={selected} />
                  <div>
                    <strong>{coin.name}</strong>
                    <span>{coin.issuerName} · Stellar</span>
                  </div>
                </div>
                <div className={styles.detailBalance}>
                  <small>{t("Saldo", "Balance")}</small>
                  <strong>
                    {format(balances[selected])} <span>{selected}</span>
                  </strong>
                </div>
                <dl className={styles.facts}>
                  <div>
                    <dt>{t("Disponible para enviar", "Available to send")}</dt>
                    <dd>
                      {format(available(selected))} {selected}
                    </dd>
                  </div>
                  {allocated(selected) > 0 ? (
                    <div>
                      <dt>
                        {t("Pagos por aprobar", "Payments awaiting approval")}
                      </dt>
                      <dd>
                        {format(allocated(selected))} {selected}
                      </dd>
                    </div>
                  ) : null}
                  {selected === "XLM" ? (
                    <>
                      <div>
                        <dt>
                          {t("Reservado por la red", "Reserved by the network")}
                        </dt>
                        <dd>{format(reserve)} XLM</dd>
                      </div>
                      <div>
                        <dt>{t("Comisiones previstas", "Expected fees")}</dt>
                        <dd>{format(pending.length * demoFee, 5)} XLM</dd>
                      </div>
                    </>
                  ) : null}
                </dl>
                <div className={styles.detailActions}>
                  <button className="primary" onClick={() => send(selected)}>
                    <ArrowUpRight size={17} />
                    {t("Enviar", "Send")}
                  </button>
                  <button className="secondary" onClick={() => open("receive")}>
                    <ArrowDownLeft size={17} />
                    {t("Recibir", "Receive")}
                  </button>
                </div>
                <details className={styles.identityDetails}>
                  <summary>
                    {t("Identidad de la moneda", "Currency identity")}
                  </summary>
                  <p>
                    {coin.issuer
                      ? t(
                          "Emisor en Stellar mainnet",
                          "Issuer on Stellar mainnet",
                        )
                      : t(
                          "Moneda nativa de Stellar",
                          "Stellar’s native currency",
                        )}
                  </p>
                  {coin.issuer ? <code>{coin.issuer}</code> : null}
                  <a href={coin.source} target="_blank" rel="noreferrer">
                    {t("Ver fuente oficial", "View official source")}
                    <ArrowUpRight size={14} />
                  </a>
                </details>
              </>
            ) : null}
            {modal === "request" && current ? (
              <>
                <div className={styles.requestSummary}>
                  <CoinMark code={current.code} />
                  <strong>
                    {current.kind === "payment"
                      ? `${format(current.amount)} ${current.code}`
                      : current.code}
                  </strong>
                  <span>
                    {current.kind === "payment"
                      ? current.contact
                      : t(
                          "Disponible para todo el equipo",
                          "Available to the whole team",
                        )}
                  </span>
                </div>
                <div className={styles.requestStatus} role="status">
                  <span className={`badge ${current.done ? "green" : ""}`}>
                    {current.done
                      ? t("Completado · ejemplo", "Completed · sample")
                      : t(
                          `${current.approvals} de 3 aprobaciones`,
                          `${current.approvals} of 3 approvals`,
                        )}
                  </span>
                </div>
                <div className={styles.approvers}>
                  {people.slice(0, 3).map((p, i) => (
                    <div key={p}>
                      <span className="avatar">{p[0]}</span>
                      <span>{p}</span>
                      {i < current.approvals ? (
                        <Check size={18} />
                      ) : (
                        <small>{t("Pendiente", "Pending")}</small>
                      )}
                    </div>
                  ))}
                </div>
                <p className={styles.infoBox}>
                  {current.done
                    ? t(
                        "Así se vería la operación confirmada. Solo se actualizaron los saldos de esta vista previa.",
                        "This is how the confirmed operation would look. Only this preview’s balances have changed.",
                      )
                    : t(
                        "Puedes simular las firmas para ver cómo cambia el estado al completar las aprobaciones.",
                        "Simulate signatures to see the status change when approvals are complete.",
                      )}
                </p>
                {!current.done ? (
                  <button className="primary wide" onClick={approve}>
                    {t(
                      "Simular siguiente aprobación",
                      "Simulate next approval",
                    )}
                    <Check size={18} />
                  </button>
                ) : (
                  <button
                    className="primary wide"
                    onClick={() => {
                      setModal("");
                      setView("coins");
                    }}
                  >
                    {t("Volver a las monedas", "Back to currencies")}
                    <ArrowUpRight size={17} />
                  </button>
                )}
              </>
            ) : null}
            {modal === "valuation" ? (
              <>
                <dl className={styles.facts}>
                  {coins
                    .filter((c) => enabled.includes(c.code))
                    .map((c) => (
                      <div key={c.code}>
                        <dt>
                          {format(balances[c.code])} {c.code}
                          <small>
                            1 {c.code} = {format(c.rate)} USD
                          </small>
                        </dt>
                        <dd>{format(balances[c.code] * c.rate)} USD</dd>
                      </div>
                    ))}
                </dl>
                <p className={styles.infoBox}>
                  {t(
                    "El total es una referencia. Los pagos siempre se revisan y aprueban en la moneda elegida.",
                    "The total is a reference. Payments are always reviewed and approved in the selected currency.",
                  )}
                </p>
              </>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
