"use client";
import { ContractVault } from "@/components/contract-vault";
import { NetworkBanner } from "@/components/network-banner";
import { IntroTour, SetupTour } from "@/components/product-tour/tour-guide";
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
  ShieldAlert,
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
  Settings2,
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
import type {
  Activation,
  Balance,
  Payment,
  Person,
  State,
  Vault,
} from "@/lib/domain";
import {
  assetKey,
  findAsset,
  canSpend,
  normalizeAmount,
  sameAsset,
  type CatalogAsset,
} from "@/lib/assets";
import { VaultAssets, AssetMark } from "@/components/vault-assets";
import { NETWORKS } from "@/lib/network";
import { SHORT } from "@/lib/domain";
import { errors } from "@/lib/messages";
import { useVaultTools } from "@/lib/use-vault-tools";
import {
  assertPayment,
  loginWithWallet,
  assertActivation,
  ensureTestFunds,
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
// Name the server gives an account that has not chosen one yet.
const NEW_NAME = "Team member";
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
    [asset, setAsset] = useState(""),
    [assetLocked, setAssetLocked] = useState(false),
    [note, setNote] = useState(""),
    [review, setReview] = useState(false);
  const [activation, setActivation] = useState<Activation | null>(null);
  const [enableCurrency, setEnableCurrency] = useState<CatalogAsset | null>(
    null,
  );
  const chain = data.network || NETWORKS.mainnet;
  useVaultTools(
    data,
    setTab,
    data.vault?.custody !== "soroban" || data.vault.status !== "active",
  );
  const authPurpose = useRef("login");
  // New accounts are asked for a name once, after their first sign-in.
  const askedName = useRef(false);
  const seq = useRef(0);
  const t = (a: string, b: string) => (es ? a : b);
  const v = data.vault,
    me = data.user;
  const configured = !!v && v.size >= 1 && v.threshold >= 1;
  useEffect(() => {
    if (!me || me.name !== NEW_NAME || askedName.current || modal || busy)
      return;
    askedName.current = true;
    setPersonName("");
    setModal("profile");
  }, [me, modal, busy]);
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
    const fetchState = async (vault?: string) => {
      const r = await fetch(
        `/api/junto${vault ? "?vault=" + encodeURIComponent(vault) : ""}`,
        { cache: "no-store" },
      );
      const d = (await r.json()) as State & { error?: string };
      if (!r.ok) throw new Error(d.error);
      return d;
    };
    try {
      const d = await fetchState(id);
      if (n === seq.current) {
        setData(d);
        setLoadError("");
      }
    } catch (e) {
      if (n === seq.current) {
        const code = e instanceof Error ? e.message : "UNAVAILABLE";
        setLoadError(code);
        if (code === "NOT_MEMBER") {
          // A successful on-chain rotation can remove the current user.
          // Close that vault instead of keeping its cached private metadata.
          setSelected("");
          history.replaceState(null, "", "/");
          // Open the next vault this person still belongs to, if any, rather
          // than dropping them on the create-vault form.
          const next = await fetchState().catch(() => undefined);
          if (n !== seq.current) return;
          if (next?.vault) {
            setData(next);
            return;
          }
          setData((previous) => ({
            ...empty,
            user: previous.user,
            network: previous.network,
            factory: previous.factory,
            catalog: previous.catalog,
            vaults: previous.vaults.filter(
              (vault) => vault.id !== (id || previous.vault?.id),
            ),
          }));
        }
      }
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
    setModal("");
    setAsset("");
    setActivation(null);
    setData({ ...empty, network: data.network, catalog: data.catalog });
    setLoaded(false);
    setSelected(id);
    history.replaceState(null, "", "/?vault=" + id);
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
  const create = async (owner = me?.address) => {
    const vaultName = name.trim();
    const r = await api("create", { name: vaultName });
    setInvite("");
    setModal("");
    setName("");
    if (!owner) return choose(r.id);
    try {
      // Deploy the vault right away: the creator is its only signer (1 of 1)
      // and adds people later from Team. One wallet signature, no waiting.
      await ensureTestFunds(owner, chain);
      const quote = await api<Activation>("prepareVault", { vault: r.id });
      await assertActivation(
        quote,
        {
          custody: "soroban",
          owner,
          name: vaultName,
          threshold: 1,
        } as Vault,
        [{ address: owner } as Person],
        chain,
        data.factory,
      );
      const signed = await signXdr(quote.xdr, owner, chain);
      await api("activate", { vault: r.id, signed });
      toast.success(
        t(
          "Tu bóveda está lista en Stellar.",
          "Your vault is ready on Stellar.",
        ),
      );
    } finally {
      // If the signature is rejected, the vault stays ready to activate.
      choose(r.id);
    }
  };
  const join = async () => {
    const r = await api("join", { invite: joinToken });
    setJoinToken("");
    setJoinInfo(undefined);
    choose(r.id);
    setModal("");
    toast.success(t("Ya estás en la bóveda.", "You’re in the vault."));
  };
  // Returning users: one click opens Freighter and lands in their last vault.
  const signIn = () => {
    authPurpose.current = "login";
    void connect(false);
  };
  const connect = async (temp: boolean) => {
    await work(async () => {
      let key: string;
      try {
        key = await connectWallet(temp, chain);
      } catch (e) {
        // Without Freighter, show the options (install it or a test wallet).
        if (!temp && e instanceof Error && e.message === "INSTALL_FREIGHTER") {
          setModal("connect");
          return;
        }
        throw e;
      }
      // Returning accounts keep their name; new ones are asked afterwards.
      await loginWithWallet(key, undefined, chain);
      setModal("");
      if (joinToken) await join();
      else if (authPurpose.current === "create" && name.trim())
        await create(key);
      else {
        setSelected("");
        history.replaceState(null, "", "/");
        await refresh();
      }
    });
  };
  const pending = data.payments.filter((p) =>
    ["pending", "submitting"].includes(p.status),
  );
  const payment = data.payments.find((p) => p.id === payId);
  const contact = data.contacts.find((c) => c.id === contactId);
  const [code, issuer] = asset.split("|");
  const chosenAsset = findAsset(data.balances, asset);
  const nativeBalance = data.balances.find((balance) => !balance.issuer);
  const sendReady =
    !!v &&
    v.status === "active" &&
    !data.chainError &&
    !loadError &&
    !pending.length &&
    !!data.paymentFee;
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
      ? p.kind === "enable"
        ? t("Habilitada", "Enabled")
        : t("Pagado", "Paid")
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
  const newPayment = (chosen?: Balance) => {
    setReview(false);
    setAmount("");
    setNote("");
    setContactId("");
    setAsset(chosen ? assetKey(chosen) : "");
    setAssetLocked(!!chosen);
    setModal("send");
  };
  const receive = (chosen?: Balance) => {
    setAsset(chosen ? assetKey(chosen) : "");
    setModal("receive");
  };
  const configure = () => {
    setSize(v?.size || 3);
    setThreshold(v?.threshold || 2);
    setTab("team");
    setModal("configure");
  };
  const saveConfiguration = (e: FormEvent) => {
    e.preventDefault();
    void work(async () => {
      await api("configure", { vault: v?.id, size, threshold });
      setInvite("");
      await refresh(v?.id);
      setModal("");
      toast.success(
        t(
          "Configuración guardada. Ya puedes invitar a tu equipo.",
          "Settings saved. You can now invite your team.",
        ),
      );
    });
  };
  const requestInvite = () =>
    void work(async () => {
      const r = await api("invite", { vault: v?.id });
      setInvite(`${location.origin}/?invite=${r.invite}`);
      setModal("invite");
    });
  const removeMember = (address: string) =>
    void work(async () => {
      await api("removeMember", { vault: v?.id, address });
      setInvite("");
      await refresh(v?.id);
      toast.success(
        t(
          "Persona quitada. El enlace anterior ya no sirve.",
          "Person removed. The previous invite link no longer works.",
        ),
      );
    });
  const discardActivation = () =>
    void work(async () => {
      if (!v) return;
      await api("discardActivation", { vault: v.id });
      setActivation(null);
      await refresh(v.id);
      toast.success(
        t(
          "Activación descartada. Revisa el equipo y vuelve a activar.",
          "Activation discarded. Review the team and activate again.",
        ),
      );
    });
  const activate = () =>
    void work(async () => {
      if (!v || !me) return;
      // The current address is taken by a contract with other rules.
      if (data.policyMismatch) throw new Error("POLICY_CHANGED");
      if (!activation || activation.expires <= Date.now() / 1000) {
        const quote = await api<Activation>("prepareVault", { vault: v.id });
        await assertActivation(quote, v, data.people, chain, data.factory);
        setActivation(quote);
        await refresh(v.id);
        return;
      }
      await assertActivation(activation, v, data.people, chain, data.factory);
      const signed = await signXdr(activation.xdr, me.address, chain);
      await api("activate", { vault: v.id, signed });
      setModal("");
      setActivation(null);
      await refresh(v.id);
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
      await assertPayment(p, v.address, chain);
      const signed = await signXdr(p.xdr, me.address, chain);
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
        <strong>
          {p.kind === "enable"
            ? t(`Habilitar ${p.code}`, `Enable ${p.code}`)
            : p.recipient}
        </strong>
        <span>
          {p.kind === "enable"
            ? t("Añadir moneda a la bóveda", "Add currency to the vault")
            : p.note}
        </span>
      </span>
      <span className="payment-status">
        <span className={`badge ${p.status === "paid" ? "green" : ""}`}>
          {status(p)}
        </span>
        <small>{date(p.created)}</small>
      </span>
      <span className="payment-amount">
        {p.kind === "enable" ? (
          <AssetMark asset={p} network={chain.id} />
        ) : (
          <>
            {money(p.amount)} <small>{p.code}</small>
          </>
        )}
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
  const profileForm = (
    <form
      className="modal-body"
      onSubmit={(e) => {
        e.preventDefault();
        void work(async () => {
          await api("profile", { name: personName.trim() });
          setModal("");
          await refresh(selected);
        });
      }}
    >
      <label>
        {t("Tu nombre", "Your name")}
        <input
          required
          autoFocus
          maxLength={60}
          value={personName}
          onChange={(e) => setPersonName(e.target.value)}
          placeholder={t(
            "Como te conoce tu equipo",
            "What your team calls you",
          )}
        />
      </label>
      <button className="primary wide" disabled={busy}>
        {t("Guardar", "Save")}
      </button>
      <button
        type="button"
        className="text-button"
        onClick={() => setModal("")}
      >
        {t("Ahora no", "Not now")}
      </button>
    </form>
  );
  const vaultPicker = (
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
              {vault.size
                ? `${vault.threshold} / ${vault.size}`
                : t("Por configurar", "Set up needed")}{" "}
              ·{" "}
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
  );
  if (
    v?.custody === "soroban" &&
    v.status === "active" &&
    v.address &&
    !showCreate
  )
    return (
      <>
        <ContractVault
          address={v.address}
          chain={chain}
          factory={data.factory}
          initialSigner={me?.address}
          people={data.people}
          contacts={data.contacts}
          metadataId={v.id}
          es={es}
          onLanguage={language}
          onBack={() => setModal("vaults")}
          onMetadataChange={() => refresh(v.id)}
          tourBlocked={!!modal}
        />
        <Dialog
          open={modal === "vaults"}
          onOpenChange={(open) => {
            if (!open) setModal("");
          }}
        >
          <DialogContent className="junto-dialog" showCloseButton={false}>
            <DialogClose className="dialog-x" aria-label={t("Cerrar", "Close")}>
              <X size={19} />
            </DialogClose>
            <DialogTitle className="dialog-title">
              {t("Tus bóvedas", "Your vaults")}
            </DialogTitle>
            <DialogDescription className="dialog-description">
              {t(
                "Cada bóveda tiene su equipo y sus contactos.",
                "Every vault has its own team and contacts.",
              )}
            </DialogDescription>
            {vaultPicker}
          </DialogContent>
        </Dialog>
        <Dialog
          open={modal === "profile" && !!me}
          onOpenChange={(open) => {
            if (!open && !busy) setModal("");
          }}
        >
          <DialogContent className="junto-dialog" showCloseButton={false}>
            <DialogTitle className="dialog-title">
              {t("¿Cómo te llamamos?", "What should we call you?")}
            </DialogTitle>
            <DialogDescription className="dialog-description">
              {t(
                "Tu equipo verá este nombre junto a tus aprobaciones.",
                "Your team will see this name next to your approvals.",
              )}
            </DialogDescription>
            {profileForm}
          </DialogContent>
        </Dialog>
      </>
    );
  const setupVisible = (!v || showCreate || !!joinToken) && loaded;
  return (
    <div className="app">
      <Toaster position="bottom-right" richColors />
      <NetworkBanner chain={chain} es={es} />
      <header className="topbar">
        <button
          className="brand"
          onClick={() => {
            setShowCreate(false);
            setTab("overview");
          }}
          aria-label="SoroSafe"
        >
          <span className="brand-icon">s</span>sorosafe
          <span className="brand-dot">.</span>
        </button>
        <div className="header-right">
          <span className="network" data-product-tour="app-network">
            {chain.label}
          </span>
          <button
            className="language"
            onClick={language}
            aria-label={t("Cambiar a inglés", "Switch to Spanish")}
          >
            <Globe2 size={16} />
            {es ? "ES" : "EN"}
          </button>
          {me ? (
            <button
              className="identity"
              data-product-tour="app-identity"
              onClick={() => setModal("account")}
            >
              <span className="avatar small">{initials(me.name)}</span>
              <span>{me.name}</span>
            </button>
          ) : (
            <button
              className="secondary login-button"
              data-product-tour="app-identity"
              disabled={busy}
              onClick={signIn}
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
            <div data-product-tour="intro-story">
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
            </div>
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
                  : t("Prepara tu bóveda", "Set up your vault")}
              </p>
              <p>
                <span>3</span>
                {joinToken
                  ? t("Entra a la misma bóveda", "Join the same vault")
                  : t("Invita a tu equipo", "Invite your team")}
              </p>
            </div>
            <div className="stellar-mark">
              <ShieldCheck size={18} />
              {t("Tus claves siguen siendo tuyas.", "Your keys stay yours.")}
            </div>
            <IntroTour
              es={es}
              joining={!!joinToken}
              testnet={chain.id === "testnet"}
              blocked={busy || !!modal}
            />
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
          <section className="setup-card" data-product-tour="intro-form">
            <div className="card-kicker">
              <span className="icon-box">
                <Users size={24} />
              </span>
              <span>
                {joinToken
                  ? t("BÓVEDA COMPARTIDA", "SHARED VAULT")
                  : t("TU NUEVA BÓVEDA", "YOUR NEW VAULT")}
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
                <button
                  className="primary wide"
                  disabled={busy || !joinInfo || joinInfo.status !== "draft"}
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
                {!me ? (
                  <div className="returning">
                    <span>
                      {t("¿Ya tienes una bóveda?", "Already have a vault?")}
                    </span>
                    <button
                      type="button"
                      className="secondary"
                      disabled={busy}
                      onClick={signIn}
                    >
                      <Wallet size={17} />
                      {t("Entrar con tu wallet", "Sign in with your wallet")}
                    </button>
                  </div>
                ) : null}
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
                    placeholder={t(
                      "Gastos del equipo 2026",
                      "Team expenses 2026",
                    )}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </label>
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
                    chain.id === "mainnet"
                      ? "Tus fondos, protegidos por las firmas del equipo."
                      : "Solo fondos de prueba. Sin dinero real.",
                    chain.id === "mainnet"
                      ? "Your funds, protected by your team’s signatures."
                      : "Test funds only. No real money.",
                  )}
                </div>
              </form>
            )}
          </section>
        </main>
      ) : v ? (
        <main className="dashboard">
          <div className="vault-heading" data-product-tour="setup-status">
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
                {configured
                  ? t(
                      `${v.threshold} de ${v.size} aprobaciones`,
                      `${v.threshold} of ${v.size} approvals`,
                    )
                  : t("Pendiente de configurar", "Settings needed")}
                <span>·</span>
                {v.status === "active"
                  ? t("Bóveda activa", "Active vault")
                  : t("Preparando la bóveda", "Setting up")}
              </div>
            </div>
            <div className="heading-actions">
              {v.status !== "active" && (
                <SetupTour
                  es={es}
                  account={me?.address}
                  network={chain.id}
                  blocked={busy || !!modal}
                  onStart={() => setTab("overview")}
                />
              )}
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
                    if (
                      v.status === "draft" &&
                      me?.address === v.owner &&
                      configured
                    )
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
            <TabsList
              variant="line"
              className="vault-tabs"
              data-product-tour="setup-navigation"
            >
              {[
                ["overview", t("Resumen", "Overview")],
                ["payments", t("Pagos", "Payments")],
                ["contacts", t("Contactos", "Contacts")],
                ["team", t("Equipo y ajustes", "Team & settings")],
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
                    {t("Saldo en XLM", "XLM balance")}
                    <Wallet size={19} />
                  </div>
                  <div
                    className="balance"
                    title={
                      nativeBalance ? money(nativeBalance.balance) : undefined
                    }
                  >
                    {data.chainError || !nativeBalance
                      ? "—"
                      : new Intl.NumberFormat(es ? "es-ES" : "en-US", {
                          maximumFractionDigits: 2,
                        }).format(Number(nativeBalance.balance))}
                    <span>XLM</span>
                  </div>
                  <p className="balance-caption">
                    {v.status === "active"
                      ? t(
                          chain.id === "mainnet"
                            ? "Fondos en Stellar Mainnet"
                            : "Fondos de prueba en Stellar",
                          chain.id === "mainnet"
                            ? "Funds on Stellar Mainnet"
                            : "Test funds on Stellar",
                        )
                      : t(
                          "El saldo aparece al activar la bóveda",
                          "Your balance appears when the vault is active",
                        )}
                  </p>
                  <div className="balance-actions">
                    <button
                      className="primary"
                      disabled={!sendReady}
                      onClick={() => newPayment()}
                    >
                      <ArrowUpRight size={19} />
                      {t("Enviar", "Send")}
                    </button>
                    <button
                      className="secondary"
                      disabled={v.status !== "active"}
                      onClick={() => receive()}
                    >
                      <ArrowDownLeft size={19} />
                      {t("Recibir", "Receive")}
                    </button>
                  </div>
                </section>
                <section className="next-panel" data-product-tour="setup-next">
                  <span className="eyebrow">
                    {t("Tu siguiente paso", "Up next")}
                  </span>
                  {v.status !== "active" && data.policyMismatch ? (
                    <>
                      <div className="round-icon">
                        <ShieldAlert size={22} />
                      </div>
                      <h2>
                        {t(
                          "La activación no coincide con lo acordado.",
                          "This activation does not match what was agreed.",
                        )}
                      </h2>
                      <p>
                        {t(
                          "El contrato en Stellar tiene otros firmantes o aprobaciones. No lo uses ni le envíes fondos.",
                          "The contract on Stellar has other signers or approvals. Do not use it or send it funds.",
                        )}
                      </p>
                      {v.owner === me?.address ? (
                        <button
                          className="text-button"
                          disabled={busy}
                          onClick={discardActivation}
                        >
                          {t(
                            "Descartar y volver a preparar",
                            "Discard and prepare again",
                          )}
                        </button>
                      ) : null}
                    </>
                  ) : v.status !== "active" ? (
                    <>
                      <div className="round-icon">
                        <Users size={22} />
                      </div>
                      <h2>
                        {!configured
                          ? t(
                              "Tu bóveda está creada.",
                              "Your vault is created.",
                            )
                          : data.people.length === v.size
                            ? t(
                                "Todo el equipo está aquí.",
                                "Everyone is here.",
                              )
                            : t(
                                "Reúne a tu equipo.",
                                "Bring your team together.",
                              )}
                      </h2>
                      <p>
                        {!configured
                          ? t(
                              "En Equipo y ajustes puedes elegir quiénes participarán y cuántas aprobaciones necesitará cada pago.",
                              "In Team & settings, choose your team size and how many approvals each payment will need.",
                            )
                          : data.people.length === v.size
                            ? t(
                                "Revisen las personas y la regla de aprobación antes de activar los fondos compartidos.",
                                "Review the people and approval rule before activating your shared funds.",
                              )
                            : t(
                                `${data.people.length} de ${v.size} personas se unieron. Comparte la invitación para entrar a esta misma bóveda.`,
                                `${data.people.length} of ${v.size} people joined. Share the invitation to enter this same vault.`,
                              )}
                      </p>
                      {v.owner === me?.address ? (
                        <button
                          className="text-button"
                          onClick={() =>
                            !configured
                              ? configure()
                              : data.people.length === v.size
                                ? setModal("activate")
                                : requestInvite()
                          }
                        >
                          {!configured
                            ? t("Configurar bóveda", "Set up vault")
                            : data.people.length === v.size
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
              {v.custody === "soroban" && v.status !== "active" ? null : (
                <VaultAssets
                  data={data}
                  es={es}
                  onSend={newPayment}
                  onReceive={receive}
                  onDetails={(balance) => {
                    setAsset(assetKey(balance));
                    setModal("asset");
                  }}
                  onCatalog={() => setModal("catalog")}
                />
              )}
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
                    onClick={() => newPayment()}
                    disabled={!sendReady}
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
                  {configured &&
                  v.status === "draft" &&
                  v.owner === me?.address ? (
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
                      {configured
                        ? t(
                            `${v.threshold} de ${v.size} aprobaciones para mover fondos`,
                            `${v.threshold} of ${v.size} approvals to move funds`,
                          )
                        : t(
                            "Configura las reglas de tu bóveda",
                            "Set your vault’s rules",
                          )}
                    </strong>
                    <p>
                      {configured
                        ? t(
                            "La misma regla protege los cambios de control de la cuenta.",
                            "The same rule protects changes to account control.",
                          )
                        : t(
                            "Elige el tamaño del equipo y las aprobaciones antes de invitarlo.",
                            "Choose your team size and approvals before inviting anyone.",
                          )}
                    </p>
                  </div>
                  {v.status === "draft" && v.owner === me?.address ? (
                    <button className="secondary" onClick={configure}>
                      <Settings2 size={17} />
                      {t("Configuración", "Settings")}
                    </button>
                  ) : (
                    <span className="badge">
                      {v.status === "active"
                        ? t("Activa en Stellar", "Active on Stellar")
                        : t("Por activar", "Not active yet")}
                    </span>
                  )}
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
                    {v.status === "draft" &&
                    v.owner === me?.address &&
                    p.address !== v.owner ? (
                      <button
                        className="text-button"
                        disabled={busy}
                        onClick={() => removeMember(p.address)}
                      >
                        {t("Quitar", "Remove")}
                      </button>
                    ) : (
                      <Check size={18} />
                    )}
                  </div>
                ))}
                {v.status !== "active" &&
                v.owner === me?.address &&
                data.policyMismatch ? (
                  <button
                    className="primary"
                    disabled={busy}
                    onClick={discardActivation}
                  >
                    {t(
                      "Descartar y volver a preparar",
                      "Discard and prepare again",
                    )}
                  </button>
                ) : v.status !== "active" &&
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
        sorosafe{" "}
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
            {modal === "enable"
              ? t(
                  `Habilitar ${enableCurrency?.code || ""}`,
                  `Enable ${enableCurrency?.code || ""}`,
                )
              : modal === "asset"
                ? chosenAsset?.code ||
                  t("Moneda no disponible", "Currency unavailable")
                : modal === "catalog"
                  ? t("Catálogo de monedas", "Currency catalog")
                  : modal === "receive" && chosenAsset
                    ? t(
                        `Recibir ${chosenAsset.code}`,
                        `Receive ${chosenAsset.code}`,
                      )
                    : modal === "connect"
                      ? t("Entra en SoroSafe", "Sign in to SoroSafe")
                      : modal === "configure"
                        ? t("Configuración de la bóveda", "Vault settings")
                        : modal === "contact"
                          ? t("Nuevo contacto compartido", "New shared contact")
                          : modal === "send"
                            ? review
                              ? t("Revisa tu pago", "Review your payment")
                              : t("Prepara un pago", "Prepare a payment")
                            : modal === "invite"
                              ? t(
                                  "Invita a esta bóveda",
                                  "Invite to this vault",
                                )
                              : modal === "receive"
                                ? t("Recibir fondos", "Receive funds")
                                : modal === "activate"
                                  ? t(
                                      "Todo listo para decidir juntos",
                                      "Ready to decide together",
                                    )
                                  : modal === "payment"
                                    ? payment?.kind === "enable"
                                      ? t("Habilitar moneda", "Enable currency")
                                      : t("Detalle del pago", "Payment details")
                                    : modal === "profile"
                                      ? t(
                                          "¿Cómo te llamamos?",
                                          "What should we call you?",
                                        )
                                      : modal === "vaults"
                                        ? t("Tus bóvedas", "Your vaults")
                                        : t("Tu wallet", "Your wallet")}
          </DialogTitle>
          <DialogDescription className="dialog-description">
            {modal === "enable"
              ? t(
                  "Tu equipo debe aprobar esta moneda antes de recibirla.",
                  "Your team must approve this currency before receiving it.",
                )
              : modal === "catalog"
                ? t(
                    "Habilita una moneda con la aprobación de tu equipo.",
                    "Enable a currency with your team’s approval.",
                  )
                : modal === "asset"
                  ? t(
                      `Saldo y disponibilidad consultados en ${chain.label}.`,
                      `Balance and availability read from ${chain.label}.`,
                    )
                  : modal === "connect"
                    ? t(
                        "Usa tu wallet de Stellar para crear tu cuenta o volver a entrar. Solo confirmarás tu identidad; no se enviará dinero.",
                        "Use your Stellar wallet to create your account or sign back in. You’ll confirm your identity; no money will be sent.",
                      )
                    : modal === "configure"
                      ? t(
                          "Estas reglas se aplicarán al activar la bóveda. Puedes ajustarlas mientras preparas el equipo.",
                          "These rules will apply when you activate the vault. You can edit them while setting up your team.",
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
                                    `Usa esta dirección únicamente en ${chain.label}.`,
                                    `Use this address only on ${chain.label}.`,
                                  )
                                : modal === "payment"
                                  ? t(
                                      payment?.kind === "enable"
                                        ? "Revisa la moneda, el emisor y la reserva antes de firmar."
                                        : "Revisa el destinatario, el importe y la dirección antes de firmar.",
                                      payment?.kind === "enable"
                                        ? "Check the currency, issuer and reserve before signing."
                                        : "Check the recipient, amount, and address before signing.",
                                    )
                                  : modal === "profile"
                                    ? t(
                                        "Tu equipo verá este nombre junto a tus aprobaciones.",
                                        "Your team will see this name next to your approvals.",
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
              <button
                className="primary wide"
                disabled={busy}
                onClick={() => void connect(false)}
              >
                <Wallet size={19} />
                {t("Continuar con Freighter", "Continue with Freighter")}
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
              <p className="footnote">
                {t(
                  "No necesitas otra contraseña. Necesitas Freighter instalado en este navegador.",
                  "No extra password needed. Freighter must be installed in this browser.",
                )}
              </p>
              {chain.id === "testnet" ? (
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
                    disabled={busy}
                    onClick={() => void connect(true)}
                  >
                    {t("Usar wallet temporal", "Use a temporary wallet")}
                    <ArrowUpRight size={17} />
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
          {modal === "catalog" ? (
            <div className="modal-body">
              {data.catalog?.map((currency) => {
                const enabled = data.balances.some((balance) =>
                  sameAsset(balance, currency),
                );
                const pendingEnable = data.payments.find(
                  (p) =>
                    p.kind === "enable" &&
                    sameAsset(p, currency) &&
                    ["pending", "submitting"].includes(p.status),
                );
                return (
                  <div className="catalog-currency" key={assetKey(currency)}>
                    <div className="catalog-heading">
                      <AssetMark asset={currency} network={chain.id} />
                      <div>
                        <strong>{currency.code}</strong>
                        <p>
                          {currency.issuerName} · {chain.label}
                        </p>
                      </div>
                      {enabled ? (
                        <span className="badge green">
                          {t("Habilitada", "Enabled")}
                        </span>
                      ) : null}
                    </div>
                    <details>
                      <summary>
                        {t("Identidad de la moneda", "Currency identity")}
                      </summary>
                      <p className="full-address">{currency.issuer}</p>
                      <a
                        className="text-button"
                        href={currency.source}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {t("Información del activo", "Asset information")}
                        <ExternalLink size={14} />
                      </a>
                    </details>
                    {!enabled ? (
                      <button
                        className="secondary wide"
                        disabled={
                          busy ||
                          data.chainError ||
                          v?.status !== "active" ||
                          (!pendingEnable && !sendReady)
                        }
                        onClick={() => {
                          if (pendingEnable) {
                            setPayId(pendingEnable.id);
                            setModal("payment");
                          } else {
                            setEnableCurrency(currency);
                            setModal("enable");
                          }
                        }}
                      >
                        {pendingEnable
                          ? t("Ver aprobaciones", "View approvals")
                          : t(
                              `Habilitar ${currency.code}`,
                              `Enable ${currency.code}`,
                            )}
                        <ArrowUpRight size={17} />
                      </button>
                    ) : null}
                  </div>
                );
              })}
              <p className="footnote">
                {v?.status !== "active"
                  ? t(
                      "Activa la bóveda para habilitar estas monedas.",
                      "Activate the vault to enable these currencies.",
                    )
                  : t(
                      "Las monedas habilitadas aparecerán en tu bóveda con el saldo registrado en Stellar.",
                      "Enabled currencies appear in your vault with their balance from Stellar.",
                    )}
              </p>
            </div>
          ) : null}
          {modal === "enable" && enableCurrency && v ? (
            <div className="modal-body">
              <AssetMark asset={enableCurrency} network={chain.id} />
              <dl className="details">
                <dt>{t("Moneda", "Currency")}</dt>
                <dd>
                  {enableCurrency.code} · {enableCurrency.issuerName}
                </dd>
                <dt>{t("Red", "Network")}</dt>
                <dd>{chain.label}</dd>
                <dt>{t("Emisor", "Issuer")}</dt>
                <dd className="full-address">{enableCurrency.issuer}</dd>
                <dt>{t("Reserva adicional", "Additional reserve")}</dt>
                <dd>{data.baseReserve ? money(data.baseReserve) : "—"} XLM</dd>
                <dt>{t("Comisión prevista", "Expected fee")}</dt>
                <dd>{data.paymentFee ? money(data.paymentFee) : "—"} XLM</dd>
                <dt>{t("Aprobaciones", "Approvals")}</dt>
                <dd>
                  {v.threshold} / {v.size}
                </dd>
              </dl>
              <p className="footnote">
                {t(
                  "La reserva permanece en tu bóveda. Habilitar una moneda permite recibirla; no la compra ni envía dinero al emisor.",
                  "The reserve stays in your vault. Enabling a currency lets you receive it; it does not buy it or send money to its issuer.",
                )}
              </p>
              <button
                className="primary wide"
                disabled={
                  busy || !sendReady || !data.baseReserve || !data.paymentFee
                }
                onClick={() =>
                  void work(async () => {
                    const result = await api("enableAsset", {
                      vault: v.id,
                      code: enableCurrency.code,
                      issuer: enableCurrency.issuer,
                    });
                    await refresh(v.id);
                    setPayId(result.id);
                    setModal("payment");
                  })
                }
              >
                {t("Pedir aprobaciones", "Request approvals")}
                {busy ? (
                  <Loader2 className="spin" size={18} />
                ) : (
                  <Users size={18} />
                )}
              </button>
            </div>
          ) : null}
          {modal === "asset" ? (
            <div className="modal-body">
              {chosenAsset && !data.chainError ? (
                <>
                  <AssetMark asset={chosenAsset} network={chain.id} />
                  <div className="review-amount">
                    {money(chosenAsset.balance)} <span>{chosenAsset.code}</span>
                  </div>
                  <dl className="details">
                    <dt>{t("Disponible para enviar", "Available to send")}</dt>
                    <dd>
                      {money(chosenAsset.available)} {chosenAsset.code}
                    </dd>
                    <dt>{t("Por aprobar", "Awaiting approval")}</dt>
                    <dd>
                      {money(chosenAsset.pending)} {chosenAsset.code}
                    </dd>
                    {Number(chosenAsset.reserve) > 0 ? (
                      <>
                        <dt>{t("Reserva de la cuenta", "Account reserve")}</dt>
                        <dd>{money(chosenAsset.reserve)} XLM</dd>
                      </>
                    ) : null}
                    {Number(chosenAsset.liabilities) > 0 ? (
                      <>
                        <dt>
                          {t("Comprometido en ofertas", "Committed to offers")}
                        </dt>
                        <dd>
                          {money(chosenAsset.liabilities)} {chosenAsset.code}
                        </dd>
                      </>
                    ) : null}
                    <dt>
                      {t(
                        "Comisión prevista por pago",
                        "Expected fee per payment",
                      )}
                    </dt>
                    <dd>
                      {data.paymentFee ? money(data.paymentFee) : "—"} XLM
                    </dd>
                    <dt>{t("Red", "Network")}</dt>
                    <dd>{chain.label}</dd>
                    {chosenAsset.issuer ? (
                      <>
                        <dt>{t("Emisor", "Issuer")}</dt>
                        <dd className="full-address">{chosenAsset.issuer}</dd>
                      </>
                    ) : null}
                  </dl>
                  <div className="balance-actions">
                    <button
                      className="primary"
                      disabled={
                        !sendReady ||
                        !chosenAsset.authorized ||
                        Number(chosenAsset.available) <= 0
                      }
                      onClick={() => newPayment(chosenAsset)}
                    >
                      <ArrowUpRight size={17} />
                      {t("Enviar", "Send")}
                    </button>
                    <button
                      className="secondary"
                      disabled={!chosenAsset.authorized}
                      onClick={() => receive(chosenAsset)}
                    >
                      <ArrowDownLeft size={17} />
                      {t("Recibir", "Receive")}
                    </button>
                  </div>
                </>
              ) : (
                <p className="notice">{err(new Error("ASSET_UNAVAILABLE"))}</p>
              )}
            </div>
          ) : null}
          {modal === "configure" && v ? (
            <form className="modal-body" onSubmit={saveConfiguration}>
              <div className="invite-name">
                <Settings2 size={22} />
                <strong>{v.name}</strong>
              </div>
              <div className="form-pair">
                <label>
                  {t("Personas, incluyéndote", "People, including you")}
                  <input
                    type="number"
                    required
                    min={Math.max(2, data.people.length)}
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
                    required
                    min={2}
                    max={size}
                    value={threshold}
                    onChange={(e) => setThreshold(Number(e.target.value))}
                  />
                </label>
              </div>
              <p className="rule-sentence">
                <ShieldCheck size={18} />
                {t(
                  `${threshold} de ${size} personas deberán aprobar cada pago.`,
                  `${threshold} of ${size} people will need to approve each payment.`,
                )}
              </p>
              <p className="footnote">
                {t(
                  "Todos tendrán su propia firma. Al guardar, los enlaces anteriores dejarán de funcionar; podrás crear una nueva invitación con estas reglas.",
                  "Everyone will have their own signature. Saving closes earlier invitation links; you can create a new invitation with these rules.",
                )}
              </p>
              <button className="primary wide" disabled={busy}>
                {busy ? (
                  <Loader2 size={18} className="spin" />
                ) : (
                  t("Guardar configuración", "Save settings")
                )}
                <Check size={18} />
              </button>
            </form>
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
                  v.custody === "soroban"
                    ? "La bóveda y su protección se crean juntas en Stellar. Tu wallet pagará el coste de creación. Los cambios de equipo requerirán sus aprobaciones."
                    : "Tu wallet aportará los XLM iniciales. La cuenta y su protección multifirma se crean juntas.",
                  v.custody === "soroban"
                    ? "The vault and its protection are created together on Stellar. Your wallet pays the creation cost. Team changes will require approvals."
                    : "Your wallet provides the initial XLM. The account and its multisig protection are created together.",
                )}
              </p>
              {activation ? (
                <dl className="details">
                  {activation.kind === "soroban" ? (
                    <>
                      <dt>{t("Comisión por pago", "Fee per payment")}</dt>
                      <dd>{(activation.feeBps || 0) / 100}%</dd>
                      <dt>{t("Destino de la comisión", "Fee recipient")}</dt>
                      <dd className="full-address">{activation.collector}</dd>
                    </>
                  ) : (
                    <>
                      <dt>{t("Aporte a la bóveda", "Vault funding")}</dt>
                      <dd>{money(activation.funding)} XLM</dd>
                    </>
                  )}
                  <dt>{t("Comisión de creación", "Creation fee")}</dt>
                  <dd>{money(activation.fee)} XLM</dd>
                  <dt>{t("Red", "Network")}</dt>
                  <dd>{chain.label}</dd>
                  <dt>{t("Desde tu wallet", "From your wallet")}</dt>
                  <dd className="full-address">{me?.address}</dd>
                </dl>
              ) : null}
              {activation && activation.kind !== "soroban" ? (
                <p className="footnote">
                  {t(
                    "El aporte permanece en la bóveda y cubre la reserva del equipo, las monedas del catálogo y sus primeras comisiones.",
                    "The funding stays in the vault and covers the team reserve, catalog currencies and their initial fees.",
                  )}
                </p>
              ) : null}
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
                    {activation
                      ? t("Firmar y activar", "Sign and activate")
                      : t("Revisar coste", "Review cost")}
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
                  placeholder={t(
                    "Alojamiento del equipo",
                    "Team accommodation",
                  )}
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
                if (!sendReady || !chosenAsset || !contact) {
                  toast.error(err(new Error("ASSET_UNAVAILABLE")));
                  return;
                }
                if (!canSpend(chosenAsset, amount)) {
                  toast.error(err(new Error("INSUFFICIENT_FUNDS")));
                  return;
                }
                if (!review) {
                  setReview(true);
                  return;
                }
                void work(async () => {
                  await api("payment", {
                    vault: v?.id,
                    contact: contactId,
                    amount,
                    code: chosenAsset.code,
                    issuer: chosenAsset.issuer,
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
                      {t("Añadido por", "Added by")} {contact.creatorName} ·{" "}
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
                          setAmount(normalizeAmount(e.target.value))
                        }
                        placeholder="0.00"
                      />
                    </label>
                    <div>
                      <label>{t("Moneda", "Asset")}</label>
                      {assetLocked ? (
                        <div
                          className="locked-asset"
                          aria-label={t("Moneda del pago", "Payment currency")}
                        >
                          <LockKeyhole size={17} />
                          <strong>{code}</strong>
                        </div>
                      ) : (
                        <Select value={asset} onValueChange={setAsset}>
                          <SelectTrigger
                            className="junto-select"
                            aria-label={t("Elegir moneda", "Choose currency")}
                          >
                            <SelectValue
                              placeholder={t(
                                "Elige una moneda",
                                "Choose a currency",
                              )}
                            />
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
                      )}
                    </div>
                  </div>
                  {chosenAsset ? (
                    <div className="destination-hint">
                      <p>
                        {t("Disponible", "Available")}:{" "}
                        {money(chosenAsset.available)} {chosenAsset.code} ·
                        {chain.label}
                      </p>
                      {chosenAsset.issuer ? (
                        <details>
                          <summary>{t("Ver emisor", "View issuer")}</summary>
                          <p className="full-address">{chosenAsset.issuer}</p>
                        </details>
                      ) : null}
                    </div>
                  ) : asset ? (
                    <p className="notice" role="alert">
                      {err(new Error("ASSET_UNAVAILABLE"))}
                    </p>
                  ) : null}
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
                      !sendReady ||
                      !contactId ||
                      !note ||
                      !canSpend(chosenAsset, amount)
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
                    <dt>{t("Red", "Network")}</dt>
                    <dd>{chain.label}</dd>
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
                    <dd>
                      {data.paymentFee ? money(data.paymentFee) : "—"} XLM
                    </dd>
                  </dl>
                  <div className="notice">
                    {t(
                      "La moneda, el emisor, el destinatario y el importe quedarán fijos al pedir las firmas.",
                      "The currency, issuer, recipient and amount are fixed once signatures are requested.",
                    )}
                  </div>
                  <button
                    className="primary wide"
                    disabled={
                      busy || !sendReady || !canSpend(chosenAsset, amount)
                    }
                  >
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
                {payment.kind === "enable" ? (
                  <AssetMark asset={payment} network={chain.id} />
                ) : (
                  money(payment.amount)
                )}{" "}
                <span>{payment.code}</span>
              </div>
              <dl className="details">
                <dt>
                  {payment.kind === "enable"
                    ? t("Bóveda", "Vault")
                    : t("Para", "To")}
                </dt>
                <dd>
                  {payment.kind === "enable" ? v.name : payment.recipient}
                </dd>
                <dt>{t("Red", "Network")}</dt>
                <dd>{chain.label}</dd>
                <dt>{t("Dirección", "Address")}</dt>
                <dd className="full-address">{payment.destination}</dd>
                {payment.issuer ? (
                  <>
                    <dt>{t("Emisor", "Issuer")}</dt>
                    <dd className="full-address">{payment.issuer}</dd>
                  </>
                ) : null}
                {payment.kind === "enable" ? (
                  <>
                    <dt>{t("Reserva adicional", "Additional reserve")}</dt>
                    <dd>
                      {payment.reserve ? money(payment.reserve) : "—"} XLM
                    </dd>
                  </>
                ) : (
                  <>
                    <dt>Memo</dt>
                    <dd>{payment.memo || "—"}</dd>
                    <dt>{t("Motivo", "Purpose")}</dt>
                    <dd>{payment.note}</dd>
                  </>
                )}
                <dt>{t("Preparado por", "Prepared by")}</dt>
                <dd>{payment.proposerName}</dd>
                <dt>{t("Comisión prevista", "Expected fee")}</dt>
                <dd>{payment.fee ? money(payment.fee) : "—"} XLM</dd>
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
                  href={`${chain.explorer}/tx/${payment.hash}`}
                >
                  {t("Ver recibo en Stellar", "View receipt on Stellar")}
                  <ExternalLink size={17} />
                </a>
              ) : null}
              {payment.status !== "paid" ? (
                <p className="footnote">
                  {t(
                    "Las firmas confirman exactamente esta operación. Vence el",
                    "Signatures confirm this exact operation. Expires",
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
              {chosenAsset ? (
                <div className="receive-asset">
                  <AssetMark asset={chosenAsset} network={chain.id} />
                  <strong>
                    {chosenAsset.code} · {chain.label}
                  </strong>
                  {chosenAsset.issuer ? (
                    <details>
                      <summary>{t("Ver emisor", "View issuer")}</summary>
                      <p className="full-address">{chosenAsset.issuer}</p>
                    </details>
                  ) : null}
                </div>
              ) : (
                <p>
                  {data.balances
                    .filter((balance) => balance.authorized)
                    .map((balance) => balance.code)
                    .join(" · ")}
                </p>
              )}
              <div className="address-block">{v.address}</div>
              <button
                className="primary wide"
                disabled={!!asset && (!chosenAsset || !chosenAsset.authorized)}
                onClick={() => void copy(v.address || "")}
              >
                <Copy size={17} />
                {t("Copiar dirección", "Copy address")}
              </button>
              <p className="footnote">
                {t(
                  `Recibe únicamente las monedas habilitadas, por ${chain.label}.`,
                  `Receive only enabled currencies, using ${chain.label}.`,
                )}
              </p>
            </div>
          ) : null}
          {modal === "vaults" ? vaultPicker : null}
          {modal === "profile" && me ? profileForm : null}
          {modal === "account" && me ? (
            <div className="modal-body">
              <span className="avatar large">{initials(me.name)}</span>
              <h3>{me.name}</h3>
              <button
                className="text-button"
                onClick={() => {
                  setPersonName(me.name === NEW_NAME ? "" : me.name);
                  setModal("profile");
                }}
              >
                {t("Cambiar nombre", "Change name")}
              </button>
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
