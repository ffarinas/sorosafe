"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Check,
  Copy,
  ExternalLink,
  Globe2,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import { toast, Toaster } from "sonner";
import { StrKey, TransactionBuilder, type xdr } from "@stellar/stellar-sdk";
import { AssetMark } from "./vault-assets";
import { NetworkBanner } from "./network-banner";
import { VaultTour } from "./product-tour/tour-guide";
import type { TourStep } from "./product-tour/types";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "./ui/dialog";
import {
  contractAssets,
  verifiedConfig,
  readContract,
  prepareCall,
  submitContract,
  val,
  actionVal,
  type ContractConfig,
  type ContractProposal,
} from "@/lib/contracts";
import { connectWallet, ensureTestFunds, signXdr } from "@/lib/client-wallet";
import { decimal as exact, normalizeAmount, units } from "@/lib/assets";
// Readable amounts: 90.475 rather than 90.4750000. Parsing stays exact.
const decimal = (value: bigint) => exact(value).replace(/\.?0+$/, "");
import { errors } from "@/lib/messages";
import { SHORT, type Contact, type Person } from "@/lib/domain";
import type { NetworkConfig } from "@/lib/network";
type Intent = {
  xdr: string;
  fee: string;
  title: string;
  details: [string, string][];
  sync?: boolean;
};
export function ContractVault({
  address,
  chain,
  factory,
  initialSigner = "",
  people = [],
  contacts = [],
  metadataId,
  onBack,
  es: esProp,
  onLanguage,
  onMetadataChange,
  onAccount,
  tourBlocked = false,
}: {
  address: string;
  chain: NetworkConfig;
  factory?: string;
  initialSigner?: string;
  people?: Person[];
  contacts?: Contact[];
  metadataId?: string;
  onBack?: () => void;
  /** Language chosen by the parent app; the standalone view keeps its own. */
  es?: boolean;
  onLanguage?: () => void;
  onMetadataChange?: () => Promise<void>;
  /** Inside the app, the identity button opens the account menu. */
  onAccount?: () => void;
  tourBlocked?: boolean;
}) {
  const router = useRouter();
  const [observedAt, setObservedAt] = useState(0);
  const [localEs, setLocalEs] = useState(true),
    [signer, setSigner] = useState(initialSigner);
  const es = esProp ?? localEs;
  useEffect(() => {
    // Standalone /contract: follow the language saved by the main app.
    if (esProp !== undefined) return;
    try {
      const saved = localStorage.getItem("junto-language");
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved) setLocalEs(saved === "es");
    } catch {
      /* Storage can be blocked; Spanish stays the default. */
    }
  }, [esProp]);
  const toggleLanguage = () => {
    if (onLanguage) return onLanguage();
    try {
      localStorage.setItem("junto-language", localEs ? "en" : "es");
    } catch {
      /* The toggle still works for this visit. */
    }
    setLocalEs(!localEs);
  };
  const [config, setConfig] = useState<ContractConfig>(),
    [balances, setBalances] = useState<Record<string, bigint>>({});
  const [proposals, setProposals] = useState<ContractProposal[]>([]),
    [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [section, setSection] = useState("funds"),
    [modal, setModal] = useState(""),
    [selected, setSelected] = useState("");
  const [amount, setAmount] = useState(""),
    [recipient, setRecipient] = useState("");
  const [draftSigner, setDraftSigner] = useState("");
  const [newSigners, setNewSigners] = useState(""),
    [threshold, setThreshold] = useState(2);
  const [intent, setIntent] = useState<Intent>();
  const [paidCounts, setPaidCounts] = useState<Record<string, bigint>>({});
  // The parent refreshes shared metadata; do not freeze contacts at mount.
  const book = contacts;
  const [contactName, setContactName] = useState("");
  const navigateTour = useCallback((step: TourStep) => {
    if (step.section) setSection(step.section);
  }, []);
  const requestId = useRef(0);
  const t = (a: string, b: string) => (es ? a : b);
  const person = (s: string) => {
    const name = people.find((p) => p.address === s)?.name;
    // Signers added on-chain have no chosen name yet: show the short address.
    return name && name !== s ? name : SHORT(s);
  };
  // Contact names first: "Hotel Alfama" says more than a G… address.
  const label = (s: string) =>
    book.find((c) => c.address === s)?.name || person(s);
  const named = (s: string) =>
    book.some((c) => c.address === s) ? `${label(s)}\n${s}` : s;
  const signerList = newSigners.split(/\s+/).filter(Boolean);
  const setSignerList = (list: string[]) => {
    setNewSigners(list.join("\n"));
    setThreshold((n) => Math.min(Math.max(n, 1), Math.max(list.length, 1)));
  };
  const addSigner = (address: string) => {
    const value = address.trim();
    if (!StrKey.isValidEd25519PublicKey(value)) {
      toast.error(errorText(new Error("INVALID_ADDRESS")));
      return;
    }
    if (!signerList.includes(value)) setSignerList([...signerList, value]);
    setDraftSigner("");
  };
  const assets = contractAssets(chain).filter((a) =>
    config?.protocol.assets.includes(a.contract),
  );
  const chosen = assets.find((a) => a.contract === selected);
  const member = !!config?.rules.signers.includes(signer);
  const errorText = (e: unknown) =>
    errors[e instanceof Error ? e.message : ""]?.[es ? 0 : 1] ||
    t(
      "No pudimos completar la operación. Actualiza y vuelve a intentarlo.",
      "We could not complete the operation. Refresh and try again.",
    );
  // The contract rejects a proposal unless expected_id is the current next_id.
  // State polls every 20 s, so read it again right before preparing.
  const freshNextId = async () =>
    (await readContract<ContractConfig>(chain, address, "config")).next_id;
  const openExplorer = (hash: string) =>
    window.open(`${chain.explorer}/tx/${hash}`, "_blank", "noopener");
  const load = useCallback(async () => {
    const request = ++requestId.current;
    try {
      const c = await verifiedConfig(chain, address, factory);
      const allAssets = contractAssets(chain).filter((a) =>
        c.protocol.assets.includes(a.contract),
      );
      const end = c.next_id - BigInt(page * 20);
      const ids = Array.from(
        {
          length: Number(
            end > BigInt(20) ? BigInt(20) : end > BigInt(0) ? end : BigInt(0),
          ),
        },
        (_, i) => end - BigInt(1) - BigInt(i),
      );
      const [b, p] = await Promise.all([
        Promise.all(
          allAssets.map(
            async (a) =>
              [
                a.contract,
                await readContract<bigint>(chain, a.contract, "balance", [
                  val.address(address),
                ]),
              ] as const,
          ),
        ),
        Promise.all(
          ids.map((id) =>
            readContract<ContractProposal>(chain, address, "proposal", [
              val.u64(id),
            ]),
          ),
        ),
      ]);
      if (request !== requestId.current) return;
      setObservedAt(Math.floor(Date.now() / 1000));
      setConfig(c);
      setBalances(Object.fromEntries(b));
      setProposals(p);
      setError("");
    } catch (e) {
      if (request === requestId.current)
        setError(e instanceof Error ? e.message : "CONTRACT_UNAVAILABLE");
    } finally {
      if (request === requestId.current) setLoading(false);
    }
  }, [address, chain, factory, page]);
  useEffect(() => {
    // Initial load synchronizes contract state from the Stellar RPC.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 20000);
    return () => {
      clearInterval(timer);
      // Invalidate outstanding network responses on unmount or a new page.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      requestId.current++;
    };
  }, [load]);
  const work = async (fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      toast.error(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  const prepare = async (
    target: string,
    method: string,
    args: xdr.ScVal[],
    title: string,
    details: [string, string][],
    sync = false,
  ) => {
    if (!signer) throw new Error("SIGN_IN_REQUIRED");
    // A second Testnet wallet may be brand new: give it test XLM for fees.
    await ensureTestFunds(signer, chain);
    const quote = await prepareCall(chain, signer, target, method, args);
    setIntent({ xdr: quote.xdr, fee: quote.fee, title, details, sync });
  };
  const contactAddresses = book.map((c) => c.address).join(",");
  useEffect(() => {
    if (section !== "contacts") return;
    let cancelled = false;
    // The tab and the guide both enter this section. Read the real history.
    void Promise.all(
      contactAddresses
        .split(",")
        .filter(Boolean)
        .map(async (recipient) => {
          try {
            return [
              recipient,
              await readContract<bigint>(chain, address, "payments_to", [
                val.address(recipient),
              ]),
            ] as const;
          } catch {
            return undefined; // Unknown, never a made-up zero.
          }
        }),
    ).then((counts) => {
      if (!cancelled)
        setPaidCounts(
          Object.fromEntries(counts.filter((c) => c !== undefined)),
        );
    });
    return () => {
      cancelled = true;
    };
  }, [section, contactAddresses, chain, address]);
  const copy = (s: string) =>
    void navigator.clipboard
      .writeText(s)
      .then(() => toast.success(t("Copiado", "Copied")))
      .catch(() =>
        toast.error(
          t("Selecciona y copia la dirección.", "Select and copy the address."),
        ),
      );
  const fee = (value: bigint) =>
    config
      ? (value * BigInt(config.protocol.fee_bps) + BigInt(9999)) / BigInt(10000)
      : BigInt(0);
  const live = (p: ContractProposal) =>
    !!config &&
    p.status === 0 &&
    p.epoch === config.epoch &&
    p.expires > BigInt(observedAt);
  const detailsFor = (p: ContractProposal): [string, string][] =>
    p.action[0] === "Pay"
      ? [
          [t("Destinatario", "Recipient"), named(p.action[2])],
          [
            t("Importe", "Amount"),
            `${decimal(p.action[3])} ${assets.find((a) => a.contract === p.action[1])?.code || SHORT(p.action[1])}`,
          ],
          [t("Comisión del servicio", "Service fee"), decimal(p.fee)],
          [t("Contrato del activo", "Asset contract"), p.action[1]],
        ]
      : [
          [
            t("Firmantes nuevos", "New signers"),
            p.action[1].signers.map(label).join("\n"),
          ],
          [
            t("Aprobaciones necesarias", "Required approvals"),
            String(p.action[1].threshold),
          ],
        ];
  const operation = (
    p: ContractProposal,
    method: "approve" | "revoke" | "execute" | "cancel",
    title: string,
  ) =>
    void work(async () => {
      await prepare(
        address,
        method,
        method === "execute"
          ? [val.u64(p.id)]
          : [val.address(signer), val.u64(p.id)],
        title,
        detailsFor(p),
        method === "execute" && p.action[0] === "ChangeRules",
      );
    });
  return (
    <div className="app contract-app">
      <Toaster position="bottom-right" richColors />
      <NetworkBanner chain={chain} es={es} />
      <header className="topbar">
        <Link
          className="brand"
          href="/"
          onClick={(e) => {
            // Inside the app, "/" would reopen the latest vault, not this one.
            if (!onBack) return;
            e.preventDefault();
            onBack();
          }}
        >
          <span className="brand-icon">s</span>sorosafe
          <span className="brand-dot">.</span>
        </Link>
        <div className="header-right">
          <span className="network" data-product-tour="app-network">
            {chain.label}
          </span>
          <button
            className="language"
            onClick={toggleLanguage}
            aria-label={t("Cambiar idioma", "Change language")}
          >
            <Globe2 size={16} />
            {es ? "ES" : "EN"}
          </button>
          <button
            className="secondary"
            data-product-tour="app-identity"
            disabled={busy}
            onClick={() =>
              onAccount
                ? onAccount()
                : void work(async () =>
                    setSigner(await connectWallet(false, chain)),
                  )
            }
          >
            {signer ? person(signer) : t("Conectar", "Connect")}
          </button>
        </div>
      </header>
      <main className="contract-main">
        <div className="contract-topline">
          <button
            className="text-button"
            onClick={() => (onBack ? onBack() : router.push("/"))}
          >
            ← {t("Mis bóvedas", "My vaults")}
          </button>
          <div className="tour-actions">
            <VaultTour
              key={`${chain.id}:${address}:${signer}`}
              es={es}
              account={signer || undefined}
              network={chain.id}
              ready={
                !!config &&
                !loading &&
                !error &&
                !busy &&
                !modal &&
                !intent &&
                !tourBlocked
              }
              threshold={config?.rules.threshold ?? 0}
              signers={config?.rules.signers.length ?? 0}
              currencies={assets.map((a) => a.code)}
              feeBps={config?.protocol.fee_bps ?? 0}
              sharedContacts={!!metadataId}
              onStepChange={navigateTour}
            />
            <button
              className="text-button"
              onClick={() => void load()}
              aria-label={t("Actualizar", "Refresh")}
            >
              <RefreshCw size={16} />
            </button>
          </div>
        </div>
        <div className="contract-heading">
          <div data-product-tour="vault-identity">
            <p className="eyebrow">{t("Bóveda compartida", "Shared vault")}</p>
            <h1>{config?.name || t("Abriendo bóveda…", "Opening vault…")}</h1>
            <button className="contract-address" onClick={() => copy(address)}>
              <code>{address}</code>
              <Copy size={15} />
            </button>
            <a
              className="text-button"
              target="_blank"
              rel="noreferrer"
              href={`${chain.explorer}/contract/${address}`}
            >
              {t("Ver contrato en Stellar", "View contract on Stellar")}
              <ExternalLink size={15} />
            </a>
          </div>
          {config && (
            <div className="contract-rule" data-product-tour="vault-rule">
              <ShieldCheck size={24} />
              <strong>
                {config.rules.threshold} / {config.rules.signers.length}
              </strong>
              <span>
                {t("aprobaciones por operación", "approvals per operation")}
              </span>
            </div>
          )}
        </div>
        {error && (
          <div className="error-banner" role="alert">
            {errorText(new Error(error))}
          </div>
        )}
        {!factory && (
          <p className="footnote">
            {t(
              "La dirección se abrió directamente. Verifica con tu equipo que corresponde a su bóveda.",
              "This address was opened directly. Verify with your team that it is their vault.",
            )}
          </p>
        )}
        <nav
          className="contract-nav"
          aria-label={t("Secciones de la bóveda", "Vault sections")}
        >
          {[
            ["funds", t("Monedas", "Currencies")],
            ["activity", t("Operaciones", "Operations")],
            ["contacts", t("Contactos", "Contacts")],
            ["team", t("Equipo", "Team")],
          ].map(([id, label]) => (
            <button
              key={id}
              className={section === id ? "active" : ""}
              onClick={() => setSection(id)}
            >
              {label}
            </button>
          ))}
        </nav>
        {loading ? (
          <div className="loading">
            <Loader2 className="spin" />
            {t("Consultando Stellar…", "Reading Stellar…")}
          </div>
        ) : (
          config && (
            <>
              {section === "funds" && (
                <section>
                  <div className="section-heading">
                    <div>
                      <h2>{t("Monedas de la bóveda", "Vault currencies")}</h2>
                      <p>
                        {t(
                          "Saldos registrados en Stellar, compartidos por todo el equipo.",
                          "Balances recorded on Stellar and shared by the whole team.",
                        )}
                      </p>
                    </div>
                  </div>
                  <div
                    className="contract-assets"
                    data-product-tour="vault-currencies"
                  >
                    {assets.map((a, assetIndex) => (
                      <article className="contract-asset" key={a.contract}>
                        <AssetMark asset={a} network={chain.id} />
                        <div>
                          <strong>{a.code}</strong>
                          <small>{a.issuerName}</small>
                        </div>
                        <div className="contract-balance">
                          {error
                            ? "—"
                            : decimal(balances[a.contract] ?? BigInt(0))}
                        </div>
                        <div className="contract-actions">
                          <button
                            className="secondary"
                            disabled={busy || !!error || !signer}
                            onClick={() => {
                              setSelected(a.contract);
                              setAmount("");
                              setModal("deposit");
                            }}
                          >
                            <ArrowDownLeft size={16} />
                            {t("Añadir fondos", "Add funds")}
                          </button>
                          <button
                            className="secondary"
                            data-product-tour={
                              assetIndex === 0 ? "vault-send" : undefined
                            }
                            disabled={
                              busy ||
                              !!error ||
                              !member ||
                              (balances[a.contract] ?? BigInt(0)) === BigInt(0)
                            }
                            onClick={() => {
                              setSelected(a.contract);
                              setRecipient("");
                              setAmount("");
                              setModal("pay");
                            }}
                          >
                            <ArrowUpRight size={16} />
                            {t("Enviar", "Send")}
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                  <p className="footnote">
                    {t(
                      "Añadir fondos transfiere la moneda elegida desde tu wallet a esta bóveda. Para depósitos externos, el servicio de origen debe admitir direcciones de contrato de Stellar.",
                      "Add funds transfers the selected currency from your wallet to this vault. For external deposits, the sending service must support Stellar contract addresses.",
                    )}
                  </p>
                </section>
              )}
              {section === "activity" && (
                <section>
                  <div
                    className="section-heading"
                    data-product-tour="vault-operations"
                  >
                    <div>
                      <h2>{t("Operaciones del equipo", "Team operations")}</h2>
                      <p>
                        {t(
                          "Cada aprobación queda registrada en Stellar.",
                          "Every approval is recorded on Stellar.",
                        )}
                      </p>
                    </div>
                  </div>
                  {!proposals.length ? (
                    <div className="empty-large">
                      {t("Todavía no hay operaciones.", "No operations yet.")}
                    </div>
                  ) : (
                    proposals.map((p) => {
                      const a =
                        p.action[0] === "Pay"
                          ? assets.find((a) => a.contract === p.action[1])
                          : undefined;
                      const ready = live(p),
                        approved = p.approvals.includes(signer);
                      return (
                        <article
                          className="contract-proposal"
                          key={String(p.id)}
                        >
                          <div className="contract-proposal-title">
                            <div>
                              <small>
                                #{String(p.id + BigInt(1))} ·{" "}
                                {person(p.proposer)}
                              </small>
                              <h3>
                                {p.action[0] === "Pay"
                                  ? `${decimal(p.action[3])} ${a?.code || SHORT(p.action[1])}`
                                  : t("Cambio de equipo", "Team change")}
                              </h3>
                            </div>
                            <span className="network">
                              {p.status === 1
                                ? t("Completada", "Completed")
                                : p.status === 2
                                  ? t("Cancelada", "Cancelled")
                                  : p.epoch !== config.epoch
                                    ? t("Reglas anteriores", "Previous rules")
                                    : !ready
                                      ? t("Vencida", "Expired")
                                      : `${p.approvals.length} / ${config.rules.threshold} ${t("aprobaciones", "approvals")}`}
                            </span>
                          </div>
                          <dl className="details">
                            {detailsFor(p).map(([label, value]) => (
                              <div className="contract-detail" key={label}>
                                <dt>{label}</dt>
                                <dd>{value}</dd>
                              </div>
                            ))}
                          </dl>
                          <p className="footnote">
                            {t("Aprobado por: ", "Approved by: ")}
                            {p.approvals.length
                              ? p.approvals.map(person).join(", ")
                              : t("sin aprobaciones", "no approvals")}
                          </p>
                          {ready && (
                            <div className="contract-actions">
                              {member && !approved && (
                                <button
                                  className="primary"
                                  disabled={busy || !!error}
                                  onClick={() =>
                                    operation(
                                      p,
                                      "approve",
                                      t(
                                        "Aprobar operación",
                                        "Approve operation",
                                      ),
                                    )
                                  }
                                >
                                  {t("Revisar y aprobar", "Review and approve")}
                                  <Check size={17} />
                                </button>
                              )}
                              {member && approved && (
                                <button
                                  className="secondary"
                                  disabled={busy || !!error}
                                  onClick={() =>
                                    operation(
                                      p,
                                      "revoke",
                                      t(
                                        "Retirar aprobación",
                                        "Revoke approval",
                                      ),
                                    )
                                  }
                                >
                                  {t(
                                    "Retirar mi aprobación",
                                    "Revoke my approval",
                                  )}
                                </button>
                              )}
                              {p.approvals.length >= config.rules.threshold &&
                                signer && (
                                  <button
                                    className="primary"
                                    disabled={busy || !!error}
                                    onClick={() =>
                                      operation(
                                        p,
                                        "execute",
                                        t(
                                          "Ejecutar operación",
                                          "Execute operation",
                                        ),
                                      )
                                    }
                                  >
                                    {t("Ejecutar", "Execute")}
                                    <ArrowUpRight size={17} />
                                  </button>
                                )}
                              {p.proposer === signer && (
                                <button
                                  className="text-button"
                                  disabled={busy || !!error}
                                  onClick={() =>
                                    operation(
                                      p,
                                      "cancel",
                                      t(
                                        "Cancelar operación",
                                        "Cancel operation",
                                      ),
                                    )
                                  }
                                >
                                  {t("Cancelar", "Cancel")}
                                </button>
                              )}
                            </div>
                          )}
                        </article>
                      );
                    })
                  )}
                  {config.next_id > BigInt(20) && (
                    <div className="contract-actions">
                      <button
                        className="secondary"
                        disabled={page === 0}
                        onClick={() => setPage(page - 1)}
                      >
                        {t("Más recientes", "Newer")}
                      </button>
                      <button
                        className="secondary"
                        disabled={config.next_id <= BigInt((page + 1) * 20)}
                        onClick={() => setPage(page + 1)}
                      >
                        {t("Anteriores", "Older")}
                      </button>
                    </div>
                  )}
                </section>
              )}
              {section === "contacts" && (
                <section>
                  <div
                    className="section-heading"
                    data-product-tour="vault-contacts"
                  >
                    <div>
                      <h2>{t("Libreta compartida", "Shared address book")}</h2>
                      <p>
                        {t(
                          "Las mismas direcciones para todo el equipo.",
                          "The same addresses for the whole team.",
                        )}
                      </p>
                    </div>
                    {metadataId && member && (
                      <button
                        className="secondary"
                        onClick={() => {
                          setRecipient("");
                          setContactName("");
                          setModal("contact");
                        }}
                      >
                        {t("Añadir contacto", "Add contact")}
                      </button>
                    )}
                  </div>
                  {book.length ? (
                    book.map((c) => (
                      <article className="contract-contact" key={c.id}>
                        <strong>{c.name}</strong>
                        <code>{c.address}</code>
                        <small>
                          {t("Añadido por ", "Added by ")}
                          {c.creatorName} ·{" "}
                          {paidCounts[c.address] === undefined
                            ? "—"
                            : String(paidCounts[c.address])}{" "}
                          {t("pagos confirmados", "confirmed payments")}
                        </small>
                      </article>
                    ))
                  ) : (
                    <div className="empty-large">
                      {metadataId
                        ? t(
                            "Todavía no hay contactos guardados.",
                            "No saved contacts yet.",
                          )
                        : t(
                            "Puedes operar directamente con las direcciones de tus destinatarios. La libreta compartida está disponible al entrar en SoroSafe.",
                            "You can operate directly with recipient addresses. The shared address book is available when signed into SoroSafe.",
                          )}
                    </div>
                  )}
                </section>
              )}
              {section === "team" && (
                <section>
                  <div
                    className="section-heading"
                    data-product-tour="vault-team"
                  >
                    <div>
                      <h2>
                        {t("Personas y aprobaciones", "People and approvals")}
                      </h2>
                      <p>
                        {t(
                          "Cambiar el equipo requiere las aprobaciones actuales.",
                          "Changing the team requires the current approvals.",
                        )}
                      </p>
                    </div>
                    {member && (
                      <button
                        className="secondary"
                        onClick={() => {
                          setNewSigners(config.rules.signers.join("\n"));
                          setThreshold(config.rules.threshold);
                          setModal("rules");
                        }}
                      >
                        {t(
                          "Añadir personas o cambiar regla",
                          "Add people or change rule",
                        )}
                      </button>
                    )}
                  </div>
                  {config.rules.signers.map((s) => (
                    <div className="review-person" key={s}>
                      <Users size={20} />
                      <span>
                        <strong>{person(s)}</strong>
                        <code>{s}</code>
                      </span>
                    </div>
                  ))}
                  <dl className="details" data-product-tour="vault-fees">
                    <dt>{t("Comisión por pago", "Fee per payment")}</dt>
                    <dd>{config.protocol.fee_bps / 100}%</dd>
                    <dt>{t("Destino de la comisión", "Fee recipient")}</dt>
                    <dd className="full-address">
                      {config.protocol.collector}
                    </dd>
                    <dt>
                      {t("Identificador del protocolo", "Protocol identifier")}
                    </dt>
                    <dd className="full-address">{config.factory}</dd>
                  </dl>
                  <p className="footnote">
                    {t(
                      "La comisión se cobra en la moneda del pago. Las aprobaciones y la ejecución tienen un coste de red en XLM, pagado por quien firma cada transacción.",
                      "The service fee is charged in the payment currency. Approvals and execution have an XLM network fee, paid by the signer of each transaction.",
                    )}
                  </p>
                </section>
              )}
            </>
          )
        )}
      </main>
      <Dialog
        open={!!modal || !!intent}
        onOpenChange={(open) => {
          if (!open && !busy) {
            setIntent(undefined);
            setModal("");
          }
        }}
      >
        <DialogContent className="junto-dialog" showCloseButton={false}>
          <button
            className="contract-close"
            disabled={busy}
            aria-label={t("Cerrar", "Close")}
            onClick={() => {
              setIntent(undefined);
              setModal("");
            }}
          >
            <X />
          </button>
          <DialogTitle className="dialog-title">
            {intent?.title ||
              (modal === "deposit"
                ? t("Añadir fondos", "Add funds")
                : modal === "rules"
                  ? t("Editar equipo", "Edit team")
                  : modal === "contact"
                    ? t("Añadir contacto", "Add contact")
                    : t("Preparar un pago", "Prepare a payment"))}
          </DialogTitle>
          <DialogDescription className="dialog-description">
            {intent
              ? t(
                  "Revisa los datos antes de firmar con tu wallet.",
                  "Review the details before signing with your wallet.",
                )
              : modal === "pay"
                ? config && config.rules.threshold <= 1
                  ? t(
                      "Con tu firma el pago sale de inmediato.",
                      "With your signature the payment goes out right away.",
                    )
                  : t(
                      "El equipo revisará y aprobará este pago.",
                      "Your team will review and approve this payment.",
                    )
                : ""}
          </DialogDescription>
          {intent ? (
            <div className="modal-body">
              <dl className="details">
                {intent.details.map(([label, value]) => (
                  <div className="contract-detail" key={label}>
                    <dt>{label}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
                <dt>{t("Coste máximo de red", "Maximum network fee")}</dt>
                <dd>{intent.fee} XLM</dd>
                <dt>{t("Tu wallet", "Your wallet")}</dt>
                <dd className="full-address">{signer}</dd>
                <dt>{t("Red", "Network")}</dt>
                <dd>{chain.label}</dd>
              </dl>
              <button
                className="primary wide"
                disabled={busy}
                onClick={() =>
                  void work(async () => {
                    const signed = await signXdr(intent.xdr, signer, chain);
                    const original = TransactionBuilder.fromXDR(
                        intent.xdr,
                        chain.passphrase,
                      ),
                      candidate = TransactionBuilder.fromXDR(
                        signed,
                        chain.passphrase,
                      );
                    if (
                      !original
                        .hash()
                        .every(
                          (byte, index) => byte === candidate.hash()[index],
                        )
                    )
                      throw new Error("CHANGED_TRANSACTION");
                    const { txHash: hash } = await submitContract(
                      chain,
                      signed,
                    );
                    const syncTeam = intent.sync;
                    setIntent(undefined);
                    setModal("");
                    await load();
                    if (syncTeam) await onMetadataChange?.();
                    toast.success(
                      t(
                        "Operación confirmada en Stellar.",
                        "Operation confirmed on Stellar.",
                      ),
                      {
                        duration: 10000,
                        action: {
                          label: t("Ver recibo", "View receipt"),
                          onClick: () => openExplorer(hash),
                        },
                      },
                    );
                  })
                }
              >
                {busy ? (
                  <Loader2 className="spin" />
                ) : (
                  t("Firmar y continuar", "Sign and continue")
                )}
              </button>
            </div>
          ) : (
            <form
              className="modal-body"
              onSubmit={(e) => {
                e.preventDefault();
                void work(async () => {
                  if (modal === "contact") {
                    if (!metadataId || !member) throw new Error("NOT_MEMBER");
                    const r = await fetch("/api/junto", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        action: "contact",
                        vault: metadataId,
                        name: contactName,
                        address: recipient,
                      }),
                    });
                    if (!r.ok)
                      throw new Error(
                        ((await r.json()) as { error: string }).error,
                      );
                    await onMetadataChange?.();
                    setModal("");
                    return;
                  }
                  if (!config) throw new Error("CONTRACT_UNAVAILABLE");
                  if (modal === "rules") {
                    const rules = {
                      signers: newSigners.split(/\s+/).filter(Boolean),
                      threshold,
                    };
                    await prepare(
                      address,
                      "propose",
                      [
                        val.address(signer),
                        val.u64(await freshNextId()),
                        actionVal(["ChangeRules", rules]),
                        val.u64(BigInt(Math.floor(Date.now() / 1000) + 86400)),
                      ],
                      config.rules.threshold <= 1
                        ? t("Aplicar cambio de equipo", "Apply team change")
                        : t(
                            "Solicitar cambio de equipo",
                            "Request team change",
                          ),
                      [
                        [
                          t("Firmantes nuevos", "New signers"),
                          rules.signers.join("\n"),
                        ],
                        [
                          t("Aprobaciones necesarias", "Required approvals"),
                          String(threshold),
                        ],
                      ],
                      // With a 1-of-N rule the change applies immediately.
                      config.rules.threshold <= 1,
                    );
                    return;
                  }
                  if (!chosen) throw new Error("ASSET_UNAVAILABLE");
                  const value = units(normalizeAmount(amount));
                  if (value <= BigInt(0)) throw new Error("INVALID_AMOUNT");
                  if (modal === "deposit")
                    await prepare(
                      chosen.contract,
                      "transfer",
                      [
                        val.address(signer),
                        val.address(address),
                        val.i128(value),
                      ],
                      t("Añadir fondos", "Add funds"),
                      [
                        [t("Moneda", "Currency"), chosen.code],
                        [t("Importe", "Amount"), decimal(value)],
                        [t("Bóveda de destino", "Destination vault"), address],
                      ],
                    );
                  else {
                    if (!member) throw new Error("NOT_MEMBER");
                    if (
                      !StrKey.isValidEd25519PublicKey(recipient) &&
                      !StrKey.isValidContract(recipient)
                    )
                      throw new Error("INVALID_ADDRESS");
                    const serviceFee = fee(value);
                    if (
                      value + serviceFee >
                      (balances[chosen.contract] ?? BigInt(0))
                    )
                      throw new Error("INSUFFICIENT_FUNDS");
                    await prepare(
                      address,
                      "propose",
                      [
                        val.address(signer),
                        val.u64(await freshNextId()),
                        actionVal(["Pay", chosen.contract, recipient, value]),
                        val.u64(BigInt(Math.floor(Date.now() / 1000) + 86400)),
                      ],
                      config.rules.threshold <= 1
                        ? t("Enviar pago", "Send payment")
                        : t("Solicitar aprobaciones", "Request approvals"),
                      [
                        [t("Destinatario", "Recipient"), named(recipient)],
                        [
                          t("Importe", "Amount"),
                          `${decimal(value)} ${chosen.code}`,
                        ],
                        [
                          t("Comisión del servicio", "Service fee"),
                          `${decimal(serviceFee)} ${chosen.code}`,
                        ],
                        [
                          t("Total de la bóveda", "Total from vault"),
                          `${decimal(value + serviceFee)} ${chosen.code}`,
                        ],
                        [
                          t("Contrato del activo", "Asset contract"),
                          chosen.contract,
                        ],
                      ],
                    );
                  }
                });
              }}
            >
              {modal === "rules" ? (
                <>
                  <div className="signer-list">
                    {signerList.map((s) => (
                      <div className="signer-row" key={s}>
                        <span>
                          <strong>
                            {label(s)}
                            {s === signer ? t(" (tú)", " (you)") : ""}
                          </strong>
                          <code>{SHORT(s)}</code>
                        </span>
                        {signerList.length > 1 && (
                          <button
                            type="button"
                            className="text-button"
                            onClick={() =>
                              setSignerList(signerList.filter((x) => x !== s))
                            }
                          >
                            {t("Quitar", "Remove")}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  <label>
                    {t("Añadir a una persona", "Add a person")}
                    <span className="add-signer">
                      <input
                        value={draftSigner}
                        placeholder={t(
                          "Su dirección de wallet (G…)",
                          "Their wallet address (G…)",
                        )}
                        onChange={(e) => setDraftSigner(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            addSigner(draftSigner);
                          }
                        }}
                      />
                      <button
                        type="button"
                        className="secondary"
                        disabled={!draftSigner.trim()}
                        onClick={() => addSigner(draftSigner)}
                      >
                        {t("Añadir", "Add")}
                      </button>
                    </span>
                  </label>
                  {book.some(
                    (c) =>
                      StrKey.isValidEd25519PublicKey(c.address) &&
                      !signerList.includes(c.address),
                  ) && (
                    <label>
                      {t(
                        "O elige de tus contactos",
                        "Or pick from your contacts",
                      )}
                      <select
                        value=""
                        onChange={(e) =>
                          e.target.value && addSigner(e.target.value)
                        }
                      >
                        <option value="">
                          {t("Elegir contacto", "Choose contact")}
                        </option>
                        {book
                          .filter(
                            (c) =>
                              StrKey.isValidEd25519PublicKey(c.address) &&
                              !signerList.includes(c.address),
                          )
                          .map((c) => (
                            <option key={c.id} value={c.address}>
                              {c.name}
                            </option>
                          ))}
                      </select>
                    </label>
                  )}
                  <div className="approval-picker">
                    <span>
                      {t(
                        "¿Cuántas personas deben aprobar cada pago?",
                        "How many people must approve each payment?",
                      )}
                    </span>
                    <div role="radiogroup">
                      {signerList.map((_, i) => (
                        <button
                          type="button"
                          role="radio"
                          aria-checked={threshold === i + 1}
                          className={threshold === i + 1 ? "selected" : ""}
                          key={i}
                          onClick={() => setThreshold(i + 1)}
                        >
                          {i + 1}
                        </button>
                      ))}
                    </div>
                    <small>
                      {t(
                        `${threshold} de ${signerList.length} ${signerList.length === 1 ? "persona" : "personas"}`,
                        `${threshold} of ${signerList.length} ${signerList.length === 1 ? "person" : "people"}`,
                      )}
                    </small>
                  </div>
                  <p className="footnote">
                    {t(
                      "Al aprobar este cambio, las operaciones pendientes con las reglas anteriores dejarán de ser válidas.",
                      "Once this change executes, pending operations under the old rules will no longer be valid.",
                    )}
                  </p>
                </>
              ) : (
                <>
                  {modal === "contact" && (
                    <label>
                      {t("Nombre del contacto", "Contact name")}
                      <input
                        required
                        maxLength={80}
                        value={contactName}
                        onChange={(e) => setContactName(e.target.value)}
                      />
                    </label>
                  )}
                  {(modal === "pay" || modal === "contact") && (
                    <>
                      {modal === "pay" && book.length > 0 && (
                        <label>
                          {t("Libreta compartida", "Shared address book")}
                          <select
                            value={
                              book.find((c) => c.address === recipient)?.id ||
                              ""
                            }
                            onChange={(e) =>
                              setRecipient(
                                book.find((c) => c.id === e.target.value)
                                  ?.address || "",
                              )
                            }
                          >
                            <option value="">
                              {t("Elegir contacto", "Choose contact")}
                            </option>
                            {book.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name}
                              </option>
                            ))}
                          </select>
                        </label>
                      )}
                      <label>
                        {t("Dirección de destino", "Recipient address")}
                        <input
                          required
                          value={recipient}
                          onChange={(e) => setRecipient(e.target.value.trim())}
                        />
                      </label>
                      <p className="footnote">
                        {t(
                          "Utiliza una wallet que controles o un destino sin memo. Esta versión no admite pagos a exchanges que requieren memo.",
                          "Use a wallet you control or a destination without a memo. This version cannot pay exchanges that require a memo.",
                        )}
                      </p>
                    </>
                  )}
                  {modal !== "contact" && chosen && (
                    <>
                      <div className="contract-selected">
                        <AssetMark asset={chosen} network={chain.id} />
                        <strong>{chosen.code}</strong>
                        <span>{chosen.issuerName}</span>
                      </div>
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
                      {modal === "pay" && (
                        <p className="footnote">
                          {t("Saldo: ", "Balance: ")}
                          {decimal(balances[chosen.contract] ?? BigInt(0))}{" "}
                          {chosen.code} ·{" "}
                          {t("Comisión del servicio: ", "Service fee: ")}
                          {config ? config.protocol.fee_bps / 100 : 0}%
                        </p>
                      )}
                    </>
                  )}
                </>
              )}
              <button className="primary wide" disabled={busy || !!error}>
                {busy ? (
                  <Loader2 className="spin" />
                ) : modal === "contact" ? (
                  t("Guardar contacto", "Save contact")
                ) : (
                  t("Revisar operación", "Review operation")
                )}
                <ArrowUpRight size={18} />
              </button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
