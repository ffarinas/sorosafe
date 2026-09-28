"use client";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  ArrowUpRight,
  ArrowDownLeft,
  ArrowLeft,
  Plus,
  ShieldCheck,
  Users,
  Check,
  Globe2,
  Copy,
  Link2,
  Wallet,
  ChevronRight,
  RefreshCw,
  Loader2,
  X,
  CheckCheck,
  ContactRound,
  Clock3,
  LogOut,
  ExternalLink,
  Send,
  Landmark,
  LockKeyhole,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Toaster, toast } from "sonner";
import type { Payment, State } from "@/lib/domain";
import { SHORT } from "@/lib/domain";
import { errors } from "@/lib/messages";
import { useVaultTools } from "@/lib/use-vault-tools";
import {
  assertPayment,
  bootstrapVault,
  connectWallet,
  disconnectWallet,
  signXdr,
  temporaryWalletStatus,
} from "@/lib/client-wallet";
const empty: State = {
  user: null,
  vaults: [],
  people: [],
  contacts: [],
  payments: [],
  balances: [],
};
async function api<T = Record<string, string>>(
  action: string,
  body: Record<string, unknown> = {},
): Promise<T> {
  const r = await fetch("/api/junto", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, ...body }),
  });
  const d = (await r.json()) as T & { error?: string };
  if (!r.ok) throw new Error(d.error);
  return d;
}
const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0])
    .join("")
    .toUpperCase();
export default function Home() {
  const [es, setEs] = useState(true),
    [data, setData] = useState<State>(empty),
    [loaded, setLoaded] = useState(false),
    [busy, setBusy] = useState(false),
    [loadError, setLoadError] = useState("");
  const [selected, setSelected] = useState(""),
    [tab, setTab] = useState("overview"),
    [modal, setModal] = useState(""),
    [showCreate, setShowCreate] = useState(false),
    [payId, setPayId] = useState("");
  const [name, setName] = useState(""),
    [personName, setPersonName] = useState(""),
    [size, setSize] = useState(3),
    [threshold, setThreshold] = useState(2),
    [invite, setInvite] = useState(""),
    [joinToken, setJoinToken] = useState(""),
    [joinInfo, setJoinInfo] = useState<State["invite"]>();
  const [contactName, setContactName] = useState(""),
    [address, setAddress] = useState(""),
    [memo, setMemo] = useState(""),
    [search, setSearch] = useState("");
  const [contactId, setContactId] = useState(""),
    [amount, setAmount] = useState(""),
    [asset, setAsset] = useState("XLM|"),
    [note, setNote] = useState(""),
    [review, setReview] = useState(false);
  useVaultTools(data, setTab);
  const authPurpose = useRef("login");
  const seq = useRef(0);
  const t = (a: string, b: string) => (es ? a : b);
  const v = data.vault,
    me = data.user;
  const tempStatus = me ? temporaryWalletStatus(me.address) : "none",
    temporary = tempStatus === "active",
    lostTemporary = tempStatus === "lost";
  const err = (e: unknown) => {
    const code = e instanceof Error ? e.message : "";
    return (
      errors[code]?.[es ? 0 : 1] ||
      t(
        "No pudimos completar la acción. Inténtalo de nuevo.",
        "We could not complete this action. Please try again.",
      )
    );
  };
  const refresh = useCallback(async (id?: string) => {
    const n = ++seq.current;
    try {
      const r = await fetch(
        `/api/junto${id ? "?vault=" + encodeURIComponent(id) : ""}`,
        { cache: "no-store" },
      );
      const d = (await r.json()) as State & { error?: string };
      if (!r.ok) throw new Error(d.error);
      if (n === seq.current) {
        setData(d);
        setLoadError("");
      }
    } catch (e) {
      if (n === seq.current)
        setLoadError(e instanceof Error ? e.message : "UNAVAILABLE");
    } finally {
      if (n === seq.current) setLoaded(true);
    }
  }, []);
  useEffect(() => {
    const saved = localStorage.getItem("junto-language");
    const params = new URLSearchParams(location.search);
    const id = params.get("vault") || "";
    // Initial hydration fetches external session and vault state; updates follow the response.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh(id).then(() => {
      if (saved) setEs(saved === "es");
      setSelected(id);
    });
    const token = params.get("invite");
    if (token) {
      fetch("/api/junto?invite=" + encodeURIComponent(token))
        .then(
          (r) =>
            r.json() as Promise<{ invite?: State["invite"]; error?: string }>,
        )
        .then((d) => {
          setJoinToken(token);
          if (d.invite) setJoinInfo(d.invite);
          else setLoadError(d.error || "UNAVAILABLE");
        })
        .catch(() => setLoadError("NETWORK_UNAVAILABLE"));
    }
  }, [refresh]);
  useEffect(() => {
    document.documentElement.lang = es ? "es" : "en";
  }, [es]);
  useEffect(() => {
    if (!me) return;
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void refresh(selected);
    }, 15000);
    return () => clearInterval(timer);
  }, [me, selected, refresh]);
  const work = async (fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      toast.error(err(e));
    } finally {
      setBusy(false);
    }
  };
  const choose = (id: string) => {
    setSelected(id);
    history.replaceState(null, "", "?vault=" + id);
    setTab("overview");
    setShowCreate(false);
    void refresh(id);
  };
  const language = () => {
    setEs(!es);
    localStorage.setItem("junto-language", es ? "en" : "es");
  };
  const copy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(t("Copiado", "Copied"));
    } catch {
      toast.error(
        t(
          "No se pudo copiar. Selecciona el texto.",
          "Could not copy. Select the text instead.",
        ),
      );
    }
  };
  const create = async () => {
    const r = await api("create", { name, threshold, size });
    setInvite(`${location.origin}/?invite=${r.invite}`);
    choose(r.id);
    setModal("invite");
    setName("");
  };
  const join = async () => {
    const r = await api("join", { invite: joinToken });
    setJoinToken("");
    setJoinInfo(undefined);
    choose(r.id);
    setModal("");
    toast.success(t("Ya estás en la bóveda.", "You’re in the vault."));
  };
  const connect = async (temp: boolean) => {
    await work(async () => {
      const key = await connectWallet(temp);
      const c = await api("challenge", { address: key });
      const signed = await signXdr(c.xdr, key);
      await api("login", {
        id: c.id,
        name: personName || me?.name || "Team member",
        signed,
      });
      setModal("");
      if (joinToken) await join();
      else if (authPurpose.current === "create" && name.trim()) await create();
      else await refresh(selected);
    });
  };
  const pending = data.payments.filter((p) =>
    ["pending", "submitting"].includes(p.status),
  );
  const payment = data.payments.find((p) => p.id === payId);
  const contact = data.contacts.find((c) => c.id === contactId);
  const [code, issuer] = asset.split("|");
  const money = (n: string) =>
    new Intl.NumberFormat(es ? "es-ES" : "en-US", {
      maximumFractionDigits: 7,
    }).format(Number(n));
  const date = (n: number) =>
    new Date(n * 1000).toLocaleDateString(es ? "es-ES" : "en-US", {
      day: "numeric",
      month: "short",
    });
  const status = (p: Payment) =>
    p.status === "paid"
      ? t("Pagado", "Paid")
      : p.status === "submitting"
        ? t("Confirmando en Stellar", "Confirming on Stellar")
        : p.status === "expired"
          ? t("Vencido", "Expired")
          : p.status === "failed"
            ? t("No enviado", "Not sent")
            : t(
                `${p.approvals.length} de ${v?.threshold} aprobaciones`,
                `${p.approvals.length} of ${v?.threshold} approvals`,
              );
  const newPayment = () => {
    setReview(false);
    setAmount("");
    setNote("");
    setContactId("");
    setAsset(
      data.balances[0]
        ? `${data.balances[0].code}|${data.balances[0].issuer}`
        : "XLM|",
    );
    setModal("send");
  };
  const requestInvite = () =>
    void work(async () => {
      const r = await api("invite", { vault: v?.id });
      setInvite(`${location.origin}/?invite=${r.invite}`);
      setModal("invite");
    });
  const activate = () =>
    void work(async () => {
      await bootstrapVault(
        (address) => api("prepareActivation", { vault: v?.id, address }),
        (signed) => api("activate", { vault: v?.id, signed }),
      );
      setModal("");
      await refresh(v?.id);
      toast.success(
        t(
          "La bóveda está activa en Stellar.",
          "The vault is active on Stellar.",
        ),
      );
    });
  const approve = (p: Payment) =>
    void work(async () => {
      if (!me || !v?.address) return;
      await assertPayment(p, v.address);
      const signed = await signXdr(p.xdr, me.address);
      await api("approve", { vault: v.id, payment: p.id, signed });
      await refresh(v.id);
      toast.success(
        t(
          "Tu aprobación quedó registrada.",
          "Your approval has been recorded.",
        ),
      );
    });
  const row = (p: Payment) => (
    <button
      key={p.id}
      className="payment-row"
      onClick={() => {
        setPayId(p.id);
        setModal("payment");
      }}
    >
      <span className={`payment-icon ${p.status === "paid" ? "done" : ""}`}>
        {p.status === "paid" ? <Check size={19} /> : <ArrowUpRight size={20} />}
      </span>
      <span className="payment-text">
        <strong>{p.recipient}</strong>
        <span>{p.note}</span>
      </span>
      <span className="payment-status">
        <span className={`badge ${p.status === "paid" ? "green" : ""}`}>
          {status(p)}
        </span>
        <small>{date(p.created)}</small>
      </span>
      <span className="payment-amount">
        {money(p.amount)} <small>{p.code}</small>
      </span>
      <ChevronRight size={17} />
    </button>
  );
  const submitCreate = (e: FormEvent) => {
    e.preventDefault();
    if (!me) {
      authPurpose.current = "create";
      setModal("connect");
      return;
    }
    void work(create);
  };
  const setupVisible = (!v || showCreate || !!joinToken) && loaded;
  return (
    <div className="app">
      <Toaster position="bottom-right" richColors />
      <header className="topbar">
        <button
          className="brand"
          onClick={() => {
            setShowCreate(false);
            setTab("overview");
          }}
          aria-label="Junto"
        >
          <span className="brand-icon">j</span>junto
          <span className="brand-dot">.</span>
        </button>
        <div className="header-right">
          <span className="network">Stellar Testnet</span>
          <button
            className="language"
            onClick={language}
            aria-label={t("Cambiar a inglés", "Switch to Spanish")}
          >
            <Globe2 size={16} />
            {es ? "ES" : "EN"}
          </button>
          {me ? (
            <button className="identity" onClick={() => setModal("account")}>
              <span className="avatar small">{initials(me.name)}</span>
              <span>{me.name}</span>
            </button>
          ) : (
            <button
              className="secondary login-button"
              onClick={() => {
                authPurpose.current = "login";
                setModal("connect");
              }}
            >
              {t("Entrar", "Sign in")}
            </button>
          )}
        </div>
      </header>
      {loadError ? (
        <div className="error-banner" role="alert">
          {err(new Error(loadError))}
          <button onClick={() => void refresh(selected)}>
            {t("Reintentar", "Retry")}
          </button>
        </div>
      ) : null}
      {!loaded ? (
        <div className="loading">
          <Loader2 className="spin" />
          {t("Abriendo tus bóvedas…", "Opening your vaults…")}
        </div>
      ) : setupVisible ? (
        <main className="onboarding">
          <div className="intro">
            <p className="eyebrow">
              {joinToken
                ? t("Te invitaron", "You’re invited")
                : t("Dinero en equipo", "Money, together")}
            </p>
            <h1>
              {joinToken
                ? t(
                    "Tu equipo.\nLa misma bóveda.",
                    "Your team.\nThe same vault.",
                  )
                : t(
                    "Una bóveda.\nTodo tu equipo.",
                    "One vault.\nYour whole team.",
                  )}
            </h1>
            <p className="intro-copy">
              {joinToken
                ? t(
                    "Entra a la bóveda que ya creó tu equipo. Los contactos y los pagos estarán ahí para todos.",
                    "Join the vault your team already created. Contacts and payments will be there for everyone.",
                  )
                : t(
                    "Un lugar para compartir fondos, organizar pagos y decidir juntos.",
                    "A place to share funds, organize payments, and decide together.",
                  )}
            </p>
            <div className="steps">
              <p>
                <span>1</span>
                {joinToken
                  ? t("Confirma tu nombre", "Confirm your name")
                  : t("Dale un nombre", "Give it a name")}
              </p>
              <p>
                <span>2</span>
                {joinToken
                  ? t("Conecta tu wallet", "Connect your wallet")
                  : t("Invita a tu equipo", "Invite your team")}
              </p>
              <p>
                <span>3</span>
                {joinToken
                  ? t("Entra a la misma bóveda", "Join the same vault")
                  : t("Decidan cómo aprobar", "Choose how to approve")}
              </p>
            </div>
            <div className="stellar-mark">
              <ShieldCheck size={18} />
              {t("Tus claves siguen siendo tuyas.", "Your keys stay yours.")}
            </div>
            {showCreate ? (
              <button
                className="text-button"
                onClick={() => setShowCreate(false)}
              >
                <ArrowLeft size={16} />
                {t("Volver a mi bóveda", "Back to my vault")}
              </button>
            ) : null}
          </div>
          <section className="setup-card">
            <div className="card-kicker">
              <span className="icon-box">
                <Users size={24} />
              </span>
              <span>
                {joinToken ? t("BÓVEDA COMPARTIDA", "SHARED VAULT") : "01 / 03"}
              </span>
            </div>
            {joinToken ? (
              <>
                <h2>
                  {joinInfo?.name || t("Abrir invitación", "Open invitation")}
                </h2>
                <p>
                  {joinInfo
                    ? t(
                        `${joinInfo.count} de ${joinInfo.size} personas ya se unieron. Cada pago necesita ${joinInfo.threshold} aprobaciones.`,
                        `${joinInfo.count} of ${joinInfo.size} people have joined. Each payment needs ${joinInfo.threshold} approvals.`,
                      )
                    : t("Comprobando invitación…", "Checking invitation…")}
                </p>
                {!me ? (
                  <label>
                    {t("Tu nombre", "Your name")}
                    <input
                      value={personName}
                      onChange={(e) => setPersonName(e.target.value)}
                      maxLength={60}
                      placeholder={t(
                        "Como te conoce tu equipo",
                        "What your team calls you",
                      )}
                    />
                  </label>
                ) : null}
                <button
                  className="primary wide"
                  disabled={
                    busy ||
                    !joinInfo ||
                    joinInfo.status !== "draft" ||
                    (!me && !personName.trim())
                  }
                  onClick={() =>
                    me
                      ? void work(join)
                      : ((authPurpose.current = "join"), setModal("connect"))
                  }
                >
                  {t("Unirme a esta bóveda", "Join this vault")}
                  <ArrowUpRight size={19} />
                </button>
                <p className="small-note">
                  {t(
                    "Tendrás tu propia firma.",
                    "You’ll have your own signing key.",
                  )}
                </p>
              </>
            ) : (
              <form onSubmit={submitCreate}>
                <h2>{t("Crea tu bóveda", "Create your vault")}</h2>
                <p className="muted">
                  {t(
                    "Para un viaje, un proyecto o los gastos de tu empresa.",
                    "For a trip, a project, or your company’s expenses.",
                  )}
                </p>
                <label>
                  {t("Nombre de la bóveda", "Vault name")}
                  <input
                    required
                    maxLength={80}
                    placeholder="Meridian · Lisboa 2026"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </label>
                {!me ? (
                  <label>
                    {t("Tu nombre", "Your name")}
                    <input
                      required
                      maxLength={60}
                      value={personName}
                      onChange={(e) => setPersonName(e.target.value)}
                      placeholder={t(
                        "Como te conoce tu equipo",
                        "What your team calls you",
                      )}
                    />
                  </label>
                ) : null}
                <div className="form-pair">
                  <label>
                    {t("Personas, incluyéndote", "People, including you")}
                    <input
                      type="number"
                      min={2}
                      max={20}
                      value={size}
                      onChange={(e) => {
                        const n = Number(e.target.value);
                        setSize(n);
                        if (threshold > n) setThreshold(n);
                      }}
                    />
                  </label>
                  <label>
                    {t("Aprobaciones por pago", "Approvals per payment")}
                    <input
                      type="number"
                      min={2}
                      max={size}
                      value={threshold}
                      onChange={(e) => setThreshold(Number(e.target.value))}
                    />
                  </label>
                </div>
                <p className="rule-sentence">
                  <ShieldCheck size={16} />
                  {t(
                    `${threshold} de ${size} personas deben estar de acuerdo.`,
                    `${threshold} of ${size} people must agree.`,
                  )}
                </p>
                <button className="primary wide" disabled={busy}>
                  {busy ? (
                    <Loader2 className="spin" size={19} />
                  ) : (
                    t("Continuar", "Continue")
                  )}
                  <ArrowUpRight size={19} />
                </button>
                <div className="small-note">
                  <LockKeyhole size={14} />
                  {t(
                    "Solo fondos de prueba. Sin dinero real.",
                    "Test funds only. No real money.",
                  )}
                </div>
              </form>
            )}
          </section>
        </main>
      ) : v ? (
        <main className="dashboard">
          <div className="vault-heading">
            <div>
              <button
                className="vault-switch"
                onClick={() => setModal("vaults")}
              >
                {t("Mis bóvedas", "My vaults")}
                <ChevronRight size={13} />
              </button>
              <h1>{v.name}</h1>
              <div className="vault-meta">
                <ShieldCheck size={15} />
                {t(
                  `${v.threshold} de ${v.size} aprobaciones`,
                  `${v.threshold} of ${v.size} approvals`,
                )}
                <span>·</span>
                {v.status === "active"
                  ? t("Bóveda activa", "Active vault")
                  : t("Preparando la bóveda", "Setting up")}
              </div>
            </div>
            <div className="heading-actions">
              <button
                className="icon-button"
                onClick={() => void refresh(v.id)}
                aria-label={t("Actualizar", "Refresh")}
              >
                <RefreshCw size={18} />
              </button>
              <div className="avatar-stack">
                {data.people.slice(0, 5).map((p) => (
                  <span key={p.address} className="avatar" title={p.name}>
                    {initials(p.name)}
                  </span>
                ))}
                <button
                  className="avatar add"
                  onClick={() => {
                    if (v.status === "draft" && me?.address === v.owner)
                      requestInvite();
                    else setTab("team");
                  }}
                  aria-label={t("Ver equipo", "View team")}
                >
                  <Users size={15} />
                </button>
              </div>
            </div>
          </div>
          {lostTemporary ? (
            <div className="notice" role="status">
              {t(
                "La clave de esta wallet temporal ya no está disponible. Desconecta desde tu perfil para empezar otra prueba.",
                "This temporary wallet’s key is no longer available. Disconnect from your profile to start another test.",
              )}
            </div>
          ) : null}
          {temporary ? (
            <div className="notice">
              {t(
                "Usas una wallet temporal de prueba. Al recargar o cerrar esta página perderás su clave.",
                "You’re using a temporary test wallet. Reloading or closing this page loses its key.",
              )}
            </div>
          ) : null}
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList variant="line" className="vault-tabs">
              {[
                ["overview", t("Resumen", "Overview")],
                ["payments", t("Pagos", "Payments")],
                ["contacts", t("Contactos", "Contacts")],
                ["team", t("Equipo", "Team")],
              ].map(([value, label]) => (
                <TabsTrigger key={value} value={value}>
                  {label}
                  {value === "payments" && pending.length ? (
                    <span className="count">{pending.length}</span>
                  ) : null}
                </TabsTrigger>
              ))}
            </TabsList>
            <TabsContent value="overview">
              <div className="overview-grid">
                <section className="balance-panel">
                  <div className="section-label">
                    {t("Saldo de la bóveda", "Vault balance")}
                    <Wallet size={19} />
                  </div>
                  <div
                    className="balance"
                    title={money(data.balances[0]?.balance || "0")}
                  >
                    {data.chainError
                      ? "—"
                      : new Intl.NumberFormat(es ? "es-ES" : "en-US", {
                          maximumFractionDigits: 2,
                        }).format(Number(data.balances[0]?.balance || "0"))}
                    <span>{data.balances[0]?.code || "XLM"}</span>
                  </div>
                  <p className="balance-caption">
                    {v.status === "active"
                      ? t(
                          "Fondos de prueba en Stellar",
                          "Test funds on Stellar",
                        )
                      : t(
                          "El saldo aparece al activar la bóveda",
                          "Your balance appears when the vault is active",
                        )}
                  </p>
                  <div className="balance-actions">
                    <button
                      className="primary"
                      disabled={v.status !== "active" || !!pending.length}
                      onClick={newPayment}
                    >
                      <ArrowUpRight size={19} />
                      {t("Enviar", "Send")}
                    </button>
                    <button
                      className="secondary"
                      disabled={v.status !== "active"}
                      onClick={() => setModal("receive")}
                    >
                      <ArrowDownLeft size={19} />
                      {t("Recibir", "Receive")}
                    </button>
                  </div>
                  {data.balances.slice(1).map((b) => (
                    <p className="other-balance" key={b.code + b.issuer}>
                      {b.code}
                      <span>{money(b.balance)}</span>
                    </p>
                  ))}
                </section>
                <section className="next-panel">
                  <span className="eyebrow">
                    {t("Tu siguiente paso", "Up next")}
                  </span>
                  {v.status !== "active" ? (
                    <>
                      <div className="round-icon">
                        <Users size={22} />
                      </div>
                      <h2>
                        {data.people.length === v.size
                          ? t("Todo el equipo está aquí.", "Everyone is here.")
                          : t(
                              "Reúne a tu equipo.",
                              "Bring your team together.",
                            )}
                      </h2>
                      <p>
                        {data.people.length === v.size
                          ? t(
                              "Revisen las personas y la regla de aprobación antes de activar los fondos compartidos.",
                              "Review the people and approval rule before activating your shared funds.",
                            )
                          : t(
                              `${data.people.length} de ${v.size} personas se unieron. Comparte la invitación para entrar a esta misma bóveda.`,
                              `${data.people.length} of ${v.size} people joined. Share the invitation to enter this same vault.`,
                            )}
                      </p>
                      {v.owner === me?.address && v.status === "draft" ? (
                        <button
                          className="text-button"
                          onClick={() =>
                            data.people.length === v.size
                              ? setModal("activate")
                              : requestInvite()
                          }
                        >
                          {data.people.length === v.size
                            ? t("Revisar y activar", "Review and activate")
                            : t("Invitar al equipo", "Invite your team")}
                          <ArrowUpRight size={17} />
                        </button>
                      ) : (
                        <p className="muted">
                          {t(
                            "Quien creó la bóveda confirmará la activación.",
                            "The vault creator will confirm activation.",
                          )}
                        </p>
                      )}
                    </>
                  ) : pending.length ? (
                    <>
                      <div className="round-icon">
                        <Clock3 size={23} />
                      </div>
                      <h2>
                        {t("Una decisión compartida.", "A shared decision.")}
                      </h2>
                      <p>
                        {t(
                          `Hay un pago a ${pending[0].recipient} esperando al equipo.`,
                          `A payment to ${pending[0].recipient} is waiting for the team.`,
                        )}
                      </p>
                      <button
                        className="text-button"
                        onClick={() => {
                          setPayId(pending[0].id);
                          setModal("payment");
                        }}
                      >
                        {t("Revisar pago", "Review payment")}
                        <ArrowUpRight size={17} />
                      </button>
                    </>
                  ) : (
                    <>
                      <div className="round-icon">
                        <CheckCheck size={24} />
                      </div>
                      <h2>{t("Todo al día.", "All caught up.")}</h2>
                      <p>
                        {t(
                          "Cuando alguien prepare un pago, aparecerá aquí para que el equipo lo revise.",
                          "When someone prepares a payment, it will appear here for the team to review.",
                        )}
                      </p>
                      <button
                        className="text-button"
                        onClick={() => setTab("contacts")}
                      >
                        {t("Ver contactos compartidos", "View shared contacts")}
                        <ArrowUpRight size={17} />
                      </button>
                    </>
                  )}
                </section>
              </div>
              <section className="section">
                <div className="section-heading">
                  <h2>{t("Actividad reciente", "Recent activity")}</h2>
                  {data.payments.length ? (
                    <button
                      className="text-button"
                      onClick={() => setTab("payments")}
                    >
                      {t("Ver todos", "View all")}
                      <ChevronRight size={16} />
                    </button>
                  ) : null}
                </div>
                {data.payments.length ? (
                  <div className="list">
                    {data.payments.slice(0, 5).map(row)}
                  </div>
                ) : (
                  <div className="empty-row">
                    <span className="empty-icon">
                      <ArrowUpRight size={22} />
                    </span>
                    <div>
                      <strong>
                        {t(
                          "Aquí empieza la historia de tu bóveda.",
                          "Your vault’s story starts here.",
                        )}
                      </strong>
                      <p>
                        {t(
                          "Cada pago, sus aprobaciones y su recibo, en un mismo lugar.",
                          "Every payment, its approvals, and its receipt, in one place.",
                        )}
                      </p>
                    </div>
                  </div>
                )}
              </section>
              <div className="shared-strip">
                <ContactRound size={22} />
                <span>
                  <strong>
                    {t(
                      "Una libreta para todos.",
                      "One address book for everyone.",
                    )}
                  </strong>
                  <span>
                    {t(
                      "Los contactos que añada una persona estarán disponibles para todo el equipo.",
                      "Contacts added by one person are available to the whole team.",
                    )}
                  </span>
                </span>
                <button
                  className="secondary"
                  onClick={() => setTab("contacts")}
                >
                  {t("Ver libreta", "View contacts")}
                </button>
              </div>
            </TabsContent>
            <TabsContent value="payments">
              <section className="section">
                <div className="section-heading">
                  <div>
                    <h2>{t("Pagos del equipo", "Team payments")}</h2>
                    <p>
                      {t(
                        "Todos ven qué se está pagando y quién lo aprobó.",
                        "Everyone sees what’s being paid and who approved it.",
                      )}
                    </p>
                  </div>
                  <button
                    className="primary"
                    onClick={newPayment}
                    disabled={v.status !== "active" || !!pending.length}
                  >
                    <Plus size={18} />
                    {t("Nuevo pago", "New payment")}
                  </button>
                </div>
                {data.payments.length ? (
                  <div className="list">{data.payments.map(row)}</div>
                ) : (
                  <div className="empty-large">
                    <Send size={29} />
                    <h3>{t("Todavía no hay pagos.", "No payments yet.")}</h3>
                    <p>
                      {t(
                        "El primer pago aparecerá aquí con su progreso.",
                        "Your first payment will appear here with its progress.",
                      )}
                    </p>
                  </div>
                )}
              </section>
            </TabsContent>
            <TabsContent value="contacts">
              <section className="section">
                <div className="section-heading">
                  <div>
                    <h2>{t("Contactos compartidos", "Shared contacts")}</h2>
                    <p>
                      {t(
                        "La misma libreta, para todo el equipo.",
                        "The same address book, for the entire team.",
                      )}
                    </p>
                  </div>
                  <button
                    className="primary"
                    onClick={() => {
                      setContactName("");
                      setAddress("");
                      setMemo("");
                      setModal("contact");
                    }}
                  >
                    <Plus size={18} />
                    {t("Añadir contacto", "Add contact")}
                  </button>
                </div>
                {data.contacts.length > 5 ? (
                  <input
                    className="search"
                    aria-label={t("Buscar contactos", "Search contacts")}
                    placeholder={t(
                      "Buscar por nombre o dirección",
                      "Search by name or address",
                    )}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                ) : null}
                <div className="contact-list">
                  {data.contacts
                    .filter((c) =>
                      (c.name + c.address)
                        .toLowerCase()
                        .includes(search.toLowerCase()),
                    )
                    .map((c) => (
                      <article className="contact-row" key={c.id}>
                        <span className="avatar contact-avatar">
                          {initials(c.name)}
                        </span>
                        <div className="contact-info">
                          <strong>{c.name}</strong>
                          <button
                            className="address-button"
                            onClick={() => void copy(c.address)}
                            title={c.address}
                          >
                            {SHORT(c.address)}
                            <Copy size={12} />
                          </button>
                          {c.memo ? <small>Memo: {c.memo}</small> : null}
                        </div>
                        <div className="contact-history">
                          <span
                            className={`badge ${c.paidCount ? "green" : ""}`}
                          >
                            {c.paidCount
                              ? t(
                                  `${c.paidCount} pago${c.paidCount === 1 ? "" : "s"} recibido${c.paidCount === 1 ? "" : "s"}`,
                                  `${c.paidCount} payment${c.paidCount === 1 ? "" : "s"} received`,
                                )
                              : t("Sin pagos todavía", "No payments yet")}
                          </span>
                          <small>
                            {t("Añadido por", "Added by")} {c.creatorName}
                          </small>
                        </div>
                        <button
                          className="icon-button"
                          disabled={v.status !== "active" || !!pending.length}
                          aria-label={t(`Pagar a ${c.name}`, `Pay ${c.name}`)}
                          onClick={() => {
                            newPayment();
                            setContactId(c.id);
                          }}
                        >
                          <ArrowUpRight size={19} />
                        </button>
                      </article>
                    ))}
                </div>
                {!data.contacts.length ? (
                  <div className="empty-large">
                    <ContactRound size={30} />
                    <h3>
                      {t(
                        "Guárdalo una vez. Compártelo con todos.",
                        "Save it once. Share it with everyone.",
                      )}
                    </h3>
                    <p>
                      {t(
                        "Añade el alojamiento, un proveedor o cualquier persona a la que el equipo vaya a pagar.",
                        "Add accommodation, a supplier, or anyone your team needs to pay.",
                      )}
                    </p>
                  </div>
                ) : null}
              </section>
            </TabsContent>
            <TabsContent value="team">
              <section className="section">
                <div className="section-heading">
                  <div>
                    <h2>{t("Tu equipo", "Your team")}</h2>
                    <p>
                      {t(
                        "Cada persona firma con su propia wallet.",
                        "Each person signs with their own wallet.",
                      )}
                    </p>
                  </div>
                  {v.status === "draft" && v.owner === me?.address ? (
                    <button className="primary" onClick={requestInvite}>
                      <Link2 size={17} />
                      {t("Invitar", "Invite")}
                    </button>
                  ) : null}
                </div>
                <div className="team-rule">
                  <ShieldCheck size={24} />
                  <div>
                    <strong>
                      {t(
                        `${v.threshold} de ${v.size} aprobaciones para mover fondos`,
                        `${v.threshold} of ${v.size} approvals to move funds`,
                      )}
                    </strong>
                    <p>
                      {t(
                        "La misma regla protege los cambios de control de la cuenta.",
                        "The same rule protects changes to account control.",
                      )}
                    </p>
                  </div>
                  <span className="badge">
                    {v.status === "active"
                      ? t("Activa en Stellar", "Active on Stellar")
                      : t("Por activar", "Not active yet")}
                  </span>
                </div>
                {data.people.map((p) => (
                  <div className="person-row" key={p.address}>
                    <span className="avatar">{initials(p.name)}</span>
                    <div>
                      <strong>
                        {p.name}
                        {p.address === me?.address ? (
                          <span className="you">{t(" · Tú", " · You")}</span>
                        ) : null}
                      </strong>
                      <button
                        className="address-button"
                        onClick={() => void copy(p.address)}
                      >
                        {SHORT(p.address)}
                        <Copy size={12} />
                      </button>
                    </div>
                    <span className="badge">
                      {p.address === v.owner
                        ? t("Creador · Firmante", "Creator · Signer")
                        : t("Firmante", "Signer")}
                    </span>
                    <Check size={18} />
                  </div>
                ))}
                {v.status === "draft" &&
                v.owner === me?.address &&
                data.people.length === v.size ? (
                  <button
                    className="primary"
                    onClick={() => setModal("activate")}
                  >
                    {t("Revisar y activar bóveda", "Review and activate vault")}
                    <ArrowUpRight size={18} />
                  </button>
                ) : null}
                {v.status === "active" ? (
                  <p className="footnote">
                    {t(
                      "Esta versión conserva la regla y los firmantes definidos al activar la bóveda.",
                      "This version keeps the rule and signers defined when activating the vault.",
                    )}
                  </p>
                ) : null}
              </section>
            </TabsContent>
          </Tabs>
          {data.chainError ? (
            <div className="notice">
              {t(
                "No pudimos verificar el estado actual en Stellar. Actualiza antes de aprobar.",
                "We could not verify the current state on Stellar. Refresh before approving.",
              )}
            </div>
          ) : null}
        </main>
      ) : null}
      <footer>
        junto{" "}
        <span>
          {t(
            "Hecho para decidir juntos. Construido sobre Stellar.",
            "Made to decide together. Built on Stellar.",
          )}
        </span>
      </footer>
      <Dialog
        open={!!modal}
        onOpenChange={(open) => {
          if (!open && !busy) setModal("");
        }}
      >
        <DialogContent className="junto-dialog" showCloseButton={false}>
          <DialogClose
            className="dialog-x"
            disabled={busy}
            aria-label={t("Cerrar", "Close")}
          >
            <X size={19} />
          </DialogClose>
          <DialogTitle className="dialog-title">
            {modal === "connect"
              ? t("Tu firma es tuya.", "Your signature is yours.")
              : modal === "contact"
                ? t("Nuevo contacto compartido", "New shared contact")
                : modal === "send"
                  ? review
                    ? t("Revisa tu pago", "Review your payment")
                    : t("Prepara un pago", "Prepare a payment")
                  : modal === "invite"
                    ? t("Invita a esta bóveda", "Invite to this vault")
                    : modal === "receive"
                      ? t("Recibir fondos", "Receive funds")
                      : modal === "activate"
                        ? t(
                            "Todo listo para decidir juntos",
                            "Ready to decide together",
                          )
                        : modal === "payment"
                          ? t("Detalle del pago", "Payment details")
                          : modal === "vaults"
                            ? t("Tus bóvedas", "Your vaults")
                            : t("Tu wallet", "Your wallet")}
          </DialogTitle>
          <DialogDescription className="dialog-description">
            {modal === "connect"
              ? t(
                  "Confirma tu identidad con tu wallet. Esta firma no mueve fondos.",
                  "Confirm your identity with your wallet. This signature moves no funds.",
                )
              : modal === "contact"
                ? t(
                    "Todo el equipo verá este contacto y quién lo añadió.",
                    "The whole team will see this contact and who added it.",
                  )
                : modal === "send"
                  ? t(
                      "El dinero se envía cuando el equipo completa las aprobaciones.",
                      "Money is sent when the team completes the approvals.",
                    )
                  : modal === "invite"
                    ? t(
                        "Quien abra el enlace entrará a esta misma bóveda.",
                        "Anyone opening this link will join this same vault.",
                      )
                    : modal === "activate"
                      ? t(
                          "Revisa las personas y la regla. Así quedará protegida la bóveda en Stellar.",
                          "Review the people and rule. This is how Stellar will protect your vault.",
                        )
                      : modal === "receive"
                        ? t(
                            "Usa esta dirección únicamente en Stellar Testnet.",
                            "Use this address only on Stellar Testnet.",
                          )
                        : modal === "payment"
                          ? t(
                              "Revisa el destinatario, el importe y la dirección antes de firmar.",
                              "Check the recipient, amount, and address before signing.",
                            )
                          : modal === "vaults"
                            ? t(
                                "Cada bóveda tiene su equipo y sus contactos.",
                                "Every vault has its own team and contacts.",
                              )
                            : t(
                                "La clave privada permanece en tu wallet.",
                                "The private key stays in your wallet.",
                              )}
          </DialogDescription>
          {modal === "connect" ? (
            <div className="modal-body">
              {!me ? (
                <label>
                  {t("Tu nombre", "Your name")}
                  <input
                    value={personName}
                    onChange={(e) => setPersonName(e.target.value)}
                    maxLength={60}
                  />
                </label>
              ) : null}
              <button
                className="primary wide"
                disabled={busy || (!personName && !me)}
                onClick={() => void connect(false)}
              >
                <Wallet size={19} />
                {t("Conectar Freighter", "Connect Freighter")}
                {busy ? (
                  <Loader2 className="spin" size={18} />
                ) : (
                  <ArrowUpRight size={18} />
                )}
              </button>
              <a
                className="text-button"
                target="_blank"
                rel="noreferrer"
                href="https://www.freighter.app/"
              >
                {t("Conseguir Freighter", "Get Freighter")}
                <ExternalLink size={14} />
              </a>
              <div className="test-wallet">
                <strong>
                  {t("¿Solo quieres probar?", "Just trying it out?")}
                </strong>
                <p>
                  {t(
                    "Crea una wallet temporal de Testnet. Su clave se pierde al recargar o cerrar esta página.",
                    "Create a temporary Testnet wallet. Its key is lost when you reload or close this page.",
                  )}
                </p>
                <button
                  className="secondary wide"
                  disabled={busy || (!personName && !me)}
                  onClick={() => void connect(true)}
                >
                  {t("Usar wallet temporal", "Use a temporary wallet")}
                  <ArrowUpRight size={17} />
                </button>
              </div>
            </div>
          ) : null}
          {modal === "invite" ? (
            <div className="modal-body">
              <div className="invite-name">
                <Users size={22} />
                <strong>{v?.name}</strong>
              </div>
              <label>
                {t("Enlace de invitación", "Invitation link")}
                <input
                  readOnly
                  value={invite}
                  onFocus={(e) => e.target.select()}
                />
              </label>
              <button
                className="primary wide"
                onClick={() => void copy(invite)}
              >
                <Copy size={17} />
                {t("Copiar invitación", "Copy invitation")}
              </button>
              <p className="footnote">
                {t(
                  "Comparte el enlace solo con tu equipo. Al activar la bóveda, las invitaciones se cierran. Generar otro enlace invalida el anterior.",
                  "Share this link only with your team. Invitations close when the vault is activated. Generating a new link invalidates the previous one.",
                )}
              </p>
            </div>
          ) : null}
          {modal === "activate" && v ? (
            <div className="modal-body">
              <div className="rule-card">
                <ShieldCheck size={27} />
                <strong>
                  {t(
                    `${v.threshold} de ${v.size} personas`,
                    `${v.threshold} of ${v.size} people`,
                  )}
                </strong>
                <span>
                  {t(
                    "para aprobar cada operación",
                    "to approve every operation",
                  )}
                </span>
              </div>
              {data.people.map((p) => (
                <div className="review-person" key={p.address}>
                  <span className="avatar small">{initials(p.name)}</span>
                  <span>
                    <strong>{p.name}</strong>
                    <code>{p.address}</code>
                  </span>
                </div>
              ))}
              <p className="footnote">
                {t(
                  "Se creará una cuenta nueva con fondos de prueba. La regla también protege cambios de firmantes. Esta versión no permite editar el equipo después.",
                  "A new account with test funds will be created. The rule also protects signer changes. This version does not support editing the team afterwards.",
                )}
              </p>
              <button
                className="primary wide"
                disabled={busy}
                onClick={activate}
              >
                {busy ? (
                  <>
                    <Loader2 className="spin" size={18} />
                    {t("Activando en Stellar…", "Activating on Stellar…")}
                  </>
                ) : (
                  <>
                    {t("Confirmar y activar", "Confirm and activate")}
                    <ArrowUpRight size={18} />
                  </>
                )}
              </button>
            </div>
          ) : null}
          {modal === "contact" ? (
            <form
              className="modal-body"
              onSubmit={(e) => {
                e.preventDefault();
                void work(async () => {
                  await api("contact", {
                    vault: v?.id,
                    name: contactName,
                    address,
                    memo,
                  });
                  await refresh(v?.id);
                  setModal("");
                  toast.success(
                    t(
                      "Contacto compartido con todo el equipo.",
                      "Contact shared with the whole team.",
                    ),
                  );
                });
              }}
            >
              <label>
                {t("Nombre", "Name")}
                <input
                  required
                  maxLength={80}
                  placeholder={t("Alojamiento Lisboa", "Lisbon accommodation")}
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                />
              </label>
              <label>
                {t("Dirección de Stellar", "Stellar address")}
                <textarea
                  required
                  maxLength={56}
                  rows={2}
                  placeholder="G…"
                  value={address}
                  onChange={(e) => setAddress(e.target.value.trim())}
                />
              </label>
              <label>
                {t(
                  "Memo, si lo solicita el destinatario",
                  "Memo, if requested by the recipient",
                )}
                <input
                  maxLength={28}
                  value={memo}
                  onChange={(e) => setMemo(e.target.value)}
                  placeholder={t("Opcional", "Optional")}
                />
              </label>
              <div className="inline-info">
                <Users size={17} />
                {t("Visible para todos en", "Visible to everyone in")} {v?.name}
                .
              </div>
              <button className="primary wide" disabled={busy}>
                {t("Guardar para el equipo", "Save for the team")}
                {busy ? (
                  <Loader2 className="spin" size={18} />
                ) : (
                  <Check size={18} />
                )}
              </button>
            </form>
          ) : null}
          {modal === "send" ? (
            <form
              className="modal-body"
              onSubmit={(e) => {
                e.preventDefault();
                if (!review) {
                  setReview(true);
                  return;
                }
                void work(async () => {
                  await api("payment", {
                    vault: v?.id,
                    contact: contactId,
                    amount,
                    code,
                    issuer,
                    note,
                  });
                  setModal("");
                  setTab("payments");
                  await refresh(v?.id);
                  toast.success(
                    t(
                      "El pago está listo para las firmas del equipo.",
                      "The payment is ready for the team’s signatures.",
                    ),
                  );
                });
              }}
            >
              {!data.contacts.length ? (
                <div className="empty-large">
                  <ContactRound />
                  <p>
                    {t(
                      "Primero guarda un destinatario en la libreta compartida.",
                      "First save a recipient in your shared address book.",
                    )}
                  </p>
                  <button
                    type="button"
                    className="primary"
                    onClick={() => setModal("contact")}
                  >
                    {t("Añadir contacto", "Add contact")}
                  </button>
                </div>
              ) : !review ? (
                <>
                  <label>
                    {t("¿A quién le pagamos?", "Who are we paying?")}
                  </label>
                  <Select value={contactId} onValueChange={setContactId}>
                    <SelectTrigger className="junto-select">
                      <SelectValue
                        placeholder={t(
                          "Elige un contacto compartido",
                          "Choose a shared contact",
                        )}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {data.contacts.map((c) => (
                        <SelectItem value={c.id} key={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {contact ? (
                    <p className="destination-hint">
                      {SHORT(contact.address)} ·{" "}
                      {contact.paidCount
                        ? t("Ya recibió pagos", "Paid before")
                        : t(
                            "Primer pago a esta dirección",
                            "First payment to this address",
                          )}
                    </p>
                  ) : null}
                  <div className="form-pair">
                    <label>
                      {t("Importe", "Amount")}
                      <input
                        required
                        inputMode="decimal"
                        pattern="[0-9]+(\.[0-9]{1,7})?"
                        value={amount}
                        onChange={(e) =>
                          setAmount(e.target.value.replace(",", "."))
                        }
                        placeholder="0.00"
                      />
                    </label>
                    <div>
                      <label>{t("Moneda", "Asset")}</label>
                      <Select value={asset} onValueChange={setAsset}>
                        <SelectTrigger className="junto-select">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {data.balances.map((b) => (
                            <SelectItem
                              key={b.code + b.issuer}
                              value={`${b.code}|${b.issuer}`}
                            >
                              {b.code}
                              {b.issuer ? " · " + SHORT(b.issuer) : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <label>
                    {t("¿Para qué es?", "What’s it for?")}
                    <input
                      required
                      maxLength={160}
                      placeholder={t(
                        "Reserva del alojamiento del equipo",
                        "Team accommodation reservation",
                      )}
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                    />
                  </label>
                  <button
                    className="primary wide"
                    disabled={
                      !contactId || !amount || !note || Number(amount) <= 0
                    }
                  >
                    {t("Revisar pago", "Review payment")}
                    <ArrowUpRight size={17} />
                  </button>
                </>
              ) : (
                <>
                  <div className="review-amount">
                    {money(amount)} <span>{code}</span>
                  </div>
                  <dl className="details">
                    <dt>{t("Para", "To")}</dt>
                    <dd>{contact?.name}</dd>
                    <dt>{t("Dirección", "Address")}</dt>
                    <dd className="full-address">{contact?.address}</dd>
                    {issuer ? (
                      <>
                        <dt>{t("Emisor", "Issuer")}</dt>
                        <dd className="full-address">{issuer}</dd>
                      </>
                    ) : null}
                    <dt>Memo</dt>
                    <dd>{contact?.memo || "—"}</dd>
                    <dt>{t("Motivo", "Purpose")}</dt>
                    <dd>{note}</dd>
                    <dt>{t("Aprobaciones", "Approvals")}</dt>
                    <dd>
                      {v?.threshold} / {v?.size}
                    </dd>
                    <dt>{t("Comisión prevista", "Expected fee")}</dt>
                    <dd>0.00001 XLM</dd>
                  </dl>
                  <div className="notice">
                    {t(
                      "El destinatario y el importe quedarán fijos al pedir las firmas.",
                      "The recipient and amount are fixed once signatures are requested.",
                    )}
                  </div>
                  <button className="primary wide" disabled={busy}>
                    {t("Pedir aprobaciones", "Request approvals")}
                    {busy ? (
                      <Loader2 className="spin" size={18} />
                    ) : (
                      <Users size={18} />
                    )}
                  </button>
                  <button
                    className="text-button"
                    type="button"
                    disabled={busy}
                    onClick={() => setReview(false)}
                  >
                    <ArrowLeft size={15} />
                    {t("Editar", "Edit")}
                  </button>
                </>
              )}
            </form>
          ) : null}
          {modal === "payment" && payment && v ? (
            <div className="modal-body">
              <span
                className={`badge ${payment.status === "paid" ? "green" : ""}`}
              >
                {status(payment)}
              </span>
              <div className="review-amount">
                {money(payment.amount)} <span>{payment.code}</span>
              </div>
              <dl className="details">
                <dt>{t("Para", "To")}</dt>
                <dd>{payment.recipient}</dd>
                <dt>{t("Dirección", "Address")}</dt>
                <dd className="full-address">{payment.destination}</dd>
                {payment.issuer ? (
                  <>
                    <dt>{t("Emisor", "Issuer")}</dt>
                    <dd className="full-address">{payment.issuer}</dd>
                  </>
                ) : null}
                <dt>Memo</dt>
                <dd>{payment.memo || "—"}</dd>
                <dt>{t("Motivo", "Purpose")}</dt>
                <dd>{payment.note}</dd>
                <dt>{t("Preparado por", "Prepared by")}</dt>
                <dd>{payment.proposerName}</dd>
                <dt>{t("Comisión prevista", "Expected fee")}</dt>
                <dd>0.00001 XLM</dd>
              </dl>
              <h3 className="mini-heading">
                {t("Aprobaciones del equipo", "Team approvals")}
              </h3>
              <div className="approval-list">
                {data.people.map((p) => (
                  <div key={p.address}>
                    <span className="avatar small">{initials(p.name)}</span>
                    <span>{p.name}</span>
                    {payment.approvals.some((a) => a.address === p.address) ? (
                      <Check size={18} className="green-text" />
                    ) : (
                      <span className="muted tiny">
                        {payment.status === "paid"
                          ? t("Sin firmar", "Not signed")
                          : t("Pendiente", "Waiting")}
                      </span>
                    )}
                  </div>
                ))}
              </div>
              {payment.status === "pending" &&
              !payment.approvals.some((a) => a.address === me?.address) ? (
                <button
                  className="primary wide"
                  disabled={busy || data.chainError || lostTemporary}
                  onClick={() => approve(payment)}
                >
                  {busy ? (
                    <Loader2 className="spin" size={18} />
                  ) : (
                    <ShieldCheck size={18} />
                  )}{" "}
                  {t("Aprobar con mi firma", "Approve with my signature")}
                </button>
              ) : payment.status === "pending" ||
                payment.status === "submitting" ? (
                <button
                  className="secondary wide"
                  disabled={busy}
                  onClick={() =>
                    void work(async () => {
                      await api("retry", { vault: v.id, payment: payment.id });
                      await refresh(v.id);
                    })
                  }
                >
                  <RefreshCw size={16} />
                  {t("Comprobar estado", "Check status")}
                </button>
              ) : null}
              {payment.status === "paid" ? (
                <a
                  className="primary wide"
                  target="_blank"
                  rel="noreferrer"
                  href={`https://stellar.expert/explorer/testnet/tx/${payment.hash}`}
                >
                  {t("Ver recibo en Stellar", "View receipt on Stellar")}
                  <ExternalLink size={17} />
                </a>
              ) : null}
              {payment.status !== "paid" ? (
                <p className="footnote">
                  {t(
                    "Las firmas confirman exactamente este pago. Vence el",
                    "Signatures confirm this exact payment. Expires",
                  )}{" "}
                  {new Date(payment.expires * 1000).toLocaleString(
                    es ? "es-ES" : "en-US",
                  )}
                  .
                </p>
              ) : null}
            </div>
          ) : null}
          {modal === "receive" && v?.address ? (
            <div className="modal-body">
              <div className="receive-icon">
                <ArrowDownLeft size={36} />
              </div>
              <h3>{v.name}</h3>
              <div className="address-block">{v.address}</div>
              <button
                className="primary wide"
                onClick={() => void copy(v.address || "")}
              >
                <Copy size={17} />
                {t("Copiar dirección", "Copy address")}
              </button>
              <p className="footnote">
                {t(
                  "Envía solo activos habilitados en esta cuenta. No envíes dinero real a Testnet.",
                  "Send only assets enabled on this account. Do not send real money to Testnet.",
                )}
              </p>
            </div>
          ) : null}
          {modal === "vaults" ? (
            <div className="modal-body">
              {data.vaults.map((vault) => (
                <button
                  key={vault.id}
                  className="vault-item"
                  onClick={() => {
                    choose(vault.id);
                    setModal("");
                  }}
                >
                  <span className="icon-box">
                    <Landmark size={20} />
                  </span>
                  <span>
                    <strong>{vault.name}</strong>
                    <small>
                      {vault.threshold} / {vault.size} ·{" "}
                      {vault.status === "active"
                        ? t("Activa", "Active")
                        : t("Preparando", "Setting up")}
                    </small>
                  </span>
                  <ChevronRight size={18} />
                </button>
              ))}
              <button
                className="primary wide"
                onClick={() => {
                  setShowCreate(true);
                  setModal("");
                  setName("");
                }}
              >
                <Plus size={17} />
                {t("Crear otra bóveda", "Create another vault")}
              </button>
            </div>
          ) : null}
          {modal === "account" && me ? (
            <div className="modal-body">
              <span className="avatar large">{initials(me.name)}</span>
              <h3>{me.name}</h3>
              <div className="address-block">{me.address}</div>
              <button
                className="secondary wide"
                onClick={() => void copy(me.address)}
              >
                <Copy size={17} />
                {t("Copiar dirección", "Copy address")}
              </button>
              <button
                className="text-button"
                disabled={busy}
                onClick={() =>
                  void work(async () => {
                    await api("logout");
                    disconnectWallet();
                    setModal("");
                    setJoinToken("");
                    setSelected("");
                    history.replaceState(null, "", "/");
                    await refresh();
                  })
                }
              >
                <LogOut size={17} />
                {t("Desconectar", "Disconnect")}
              </button>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
