"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Check,
  Copy,
  BookUser,
  ExternalLink,
  Globe2,
  Inbox,
  Loader2,
  RefreshCw,
  ShieldCheck,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import "./vault-ux.css";
import { toast, Toaster } from "sonner";
import { StrKey, TransactionBuilder, type xdr } from "@stellar/stellar-sdk";
import { AssetMark } from "./vault-assets";
import { NetworkBanner } from "./network-banner";
import testnetTokens from "@/lib/testnet-tokens.json";
import { VaultTour } from "./product-tour/tour-guide";
import { BrandWordmark } from "./brand-wordmark";
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
  trustlineXdr,
  val,
  actionVal,
  type ContractConfig,
  type ContractProposal,
} from "@/lib/contracts";
import {
  connectWallet,
  ensureTestFunds,
  signXdr,
  temporaryWalletStatus,
} from "@/lib/client-wallet";
import { decimal as exact, normalizeAmount, units } from "@/lib/assets";
// Readable amounts: 90.475 rather than 90.4750000. Parsing stays exact.
const decimal = (value: bigint) => exact(value).replace(/\.?0+$/, "");
import { errorWith } from "@/lib/messages";
import { SHORT, type Contact, type Person } from "@/lib/domain";
import type { NetworkConfig } from "@/lib/network";
type Intent = {
  xdr: string;
  fee: string;
  title: string;
  details: [string, string][];
  /** Shown collapsed under "Technical details". */
  technical?: [string, string][];
  sync?: boolean;
  /** What to say once Stellar confirms it. */
  outcome?: Outcome;
};
type Outcome =
  | { kind: "propose" | "approve" | "execute"; id: bigint }
  | { kind: "revoke" | "cancel" }
  | { kind: "deposit"; amount: string; code: string };
// Middle-truncated, for addresses that are not the main thing on screen.
const shortAddress = (s: string) =>
  s.length > 12 ? `${s.slice(0, 4)}…${s.slice(-3)}` : s;
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
    let saved: string | null = null;
    try {
      saved = localStorage.getItem("junto-language");
    } catch {
      /* Storage can be blocked; the browser language decides. */
    }
    // No saved choice: follow the browser (Spanish or English). Decided after
    // hydration so the server and the first client render agree.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLocalEs(
      saved ? saved === "es" : /^es\b/i.test(navigator.language || ""),
    );
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
  // Testnet faucets: SoroSafe's test USDT0 and Circle's Testnet USDC.
  const faucetFor = (asset?: { code: string; issuer: string }) => {
    if (chain.id !== "testnet" || !asset) return undefined;
    const entry =
      asset.code === "USDT0"
        ? testnetTokens.USDT0
        : asset.code === "USDC"
          ? testnetTokens.USDC
          : undefined;
    return entry && entry.issuer === asset.issuer ? entry : undefined;
  };
  // What the connected wallet holds, shown when adding funds.
  const [walletBalance, setWalletBalance] = useState<string | null>();
  const [walletTick, setWalletTick] = useState(0);
  // Whether the Testnet faucet for the deposit currency can pay a claim.
  const [faucetReady, setFaucetReady] = useState<boolean>();
  // A temporary Testnet wallet whose tab was closed can no longer sign.
  const [lostWallet, setLostWallet] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLostWallet(!!signer && temporaryWalletStatus(signer) === "lost");
  }, [signer]);
  const depositAsset = modal === "deposit" ? selected : "";
  useEffect(() => {
    const asset = contractAssets(chain).find(
      (a) => a.contract === depositAsset,
    );
    if (!asset || !signer) return;
    let current = true;
    fetch(`${chain.horizon}/accounts/${signer}`)
      .then(
        (r) =>
          (r.ok ? r.json() : null) as Promise<{
            balances?: {
              asset_type: string;
              asset_code?: string;
              asset_issuer?: string;
              balance: string;
            }[];
          } | null>,
      )
      .then((account) => {
        const line = account?.balances?.find((b) =>
          asset.issuer
            ? b.asset_code === asset.code && b.asset_issuer === asset.issuer
            : b.asset_type === "native",
        );
        if (current)
          setWalletBalance(line ? line.balance.replace(/\.?0+$/, "") : null);
      })
      .catch(() => current && setWalletBalance(undefined));
    return () => {
      current = false;
      setWalletBalance(undefined);
    };
  }, [chain, depositAsset, signer, walletTick]);
  useEffect(() => {
    const asset = contractAssets(chain).find(
      (a) => a.contract === depositAsset,
    );
    const faucet = faucetFor(asset);
    if (!asset || !faucet) return;
    let current = true;
    readContract<bigint>(chain, asset.contract, "balance", [
      val.address(faucet.faucet),
    ])
      .then(
        (stock) =>
          current &&
          setFaucetReady(stock >= BigInt(faucet.perClaim) * BigInt(10_000_000)),
      )
      .catch(() => current && setFaucetReady(undefined));
    return () => {
      current = false;
      setFaucetReady(undefined);
    };
    // faucetFor only depends on the network.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chain, depositAsset, walletTick]);
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
    // Going from just you to a team: suggest a majority (2 of 2, 2 of 3…).
    if (signerList.length <= 1 && list.length > 1)
      setThreshold(Math.floor(list.length / 2) + 1);
    else
      setThreshold((n) => Math.min(Math.max(n, 1), Math.max(list.length, 1)));
  };
  // Where a colleague signs in to find their address.
  const [appHost, setAppHost] = useState("testnet.sorosafe.app");
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAppHost(window.location.host);
  }, []);
  const invitation = () =>
    t(
      `Hola: quiero añadirte a nuestra bóveda «${config?.name || "SoroSafe"}» en SoroSafe para aprobar pagos juntos. Abre ${window.location.origin}, entra con tu wallet, abre el menú de tu cuenta → Copiar dirección y envíamela.`,
      `Hi! I'd like to add you to our SoroSafe vault "${config?.name || "SoroSafe"}" so we can approve payments together. Open ${window.location.origin}, sign in with your wallet, open your account menu → Copy address, and send it to me.`,
    );
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
  // Paying a contact starts with the first currency the vault holds.
  const fundedAssets = assets.filter(
    (a) => (balances[a.contract] ?? BigInt(0)) > BigInt(0),
  );
  const funded = fundedAssets[0];
  const member = !!config?.rules.signers.includes(signer);
  const errorText = (e: unknown) =>
    errorWith(e, es) ||
    t(
      "No pudimos completarlo. Actualiza y vuelve a intentarlo.",
      "We couldn't complete this. Refresh and try again.",
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
                // Accrued service fees stay in the vault until claimed and
                // can't be spent, so show only what payments can use.
                (await readContract<bigint>(chain, a.contract, "balance", [
                  val.address(address),
                ])) -
                  (await readContract<bigint>(chain, address, "fees_owed", [
                    val.address(a.contract),
                  ])),
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
    extra: Pick<Intent, "technical" | "outcome"> = {},
  ) => {
    if (!signer) throw new Error("SIGN_IN_REQUIRED");
    // A second Testnet wallet may be brand new: give it test XLM for fees.
    await ensureTestFunds(signer, chain);
    const quote = await prepareCall(chain, signer, target, method, args);
    setIntent({
      xdr: quote.xdr,
      fee: quote.fee,
      title,
      details,
      sync,
      ...extra,
    });
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
  // The contract runs the action in the approval that completes the rule,
  // as long as the vault can cover the payment.
  const completes = (p: ContractProposal) =>
    !!config &&
    p.approvals.length + 1 >= config.rules.threshold &&
    (p.action[0] !== "Pay" ||
      (balances[p.action[1]] ?? BigInt(0)) >= p.action[3] + p.fee);
  const waiting = proposals.filter(
    (p) => live(p) && member && !p.approvals.includes(signer),
  );
  const detailsFor = (p: ContractProposal): [string, string][] =>
    p.action[0] === "Pay"
      ? [
          [t("Destinatario", "Recipient"), named(p.action[2])],
          [
            t("Importe", "Amount"),
            `${decimal(p.action[3])} ${assets.find((a) => a.contract === p.action[1])?.code || SHORT(p.action[1])}`,
          ],
          [t("Comisión de servicio", "Service fee"), decimal(p.fee)],
        ]
      : [
          [
            t("Personas que aprueban", "People who approve"),
            p.action[1].signers.map(label).join("\n"),
          ],
          [
            t("Regla de aprobación", "Approval rule"),
            t(
              `${p.action[1].threshold} de ${p.action[1].signers.length} aprobaciones`,
              `${p.action[1].threshold} of ${p.action[1].signers.length} approvals`,
            ),
          ],
        ];
  const technicalFor = (p: ContractProposal): [string, string][] =>
    p.action[0] === "Pay"
      ? [
          [t("Contrato de la moneda", "Currency contract"), p.action[1]],
          [t("Destinatario", "Recipient"), p.action[2]],
        ]
      : [];
  // Who still has to approve a pending request, by name.
  const waitingFor = (p: ContractProposal) =>
    (config?.rules.signers ?? [])
      .filter((s) => !p.approvals.includes(s))
      .map(person)
      .join(", ");
  const expiresIn = (p: ContractProposal) => {
    // Measured from the last refresh (every 20 s), not the render clock.
    const seconds = Number(p.expires) - observedAt;
    if (seconds <= 0) return "";
    const hours = Math.floor(seconds / 3600);
    return hours >= 1
      ? t(`Caduca en ${hours} h`, `Expires in ${hours} h`)
      : t(
          `Caduca en ${Math.max(1, Math.floor(seconds / 60))} min`,
          `Expires in ${Math.max(1, Math.floor(seconds / 60))} min`,
        );
  };
  const amountText = (p: ContractProposal) =>
    p.action[0] === "Pay"
      ? `${decimal(p.action[3])} ${assets.find((a) => a.contract === p.action[1])?.code || SHORT(p.action[1])}`
      : "";
  // One sentence that says what just happened and what comes next.
  // `pending` means the request still waits for other people.
  const outcomeText = async (
    outcome?: Outcome,
  ): Promise<{ text: string; pending?: boolean }> => {
    if (!outcome)
      return { text: t("Confirmado en Stellar.", "Confirmed on Stellar.") };
    if (outcome.kind === "deposit")
      return {
        text: t(
          `Añadiste ${outcome.amount} ${outcome.code} a la bóveda.`,
          `Added ${outcome.amount} ${outcome.code} to the vault.`,
        ),
      };
    if (outcome.kind === "revoke")
      return {
        text: t("Retiraste tu aprobación.", "Your approval was withdrawn."),
        pending: true,
      };
    if (!("id" in outcome))
      return { text: t("Solicitud cancelada.", "Request cancelled.") };
    const p = await readContract<ContractProposal>(chain, address, "proposal", [
      val.u64(outcome.id),
    ]);
    if (p.status === 1)
      return {
        text:
          p.action[0] === "Pay"
            ? t(
                `Pago enviado: ${amountText(p)} a ${label(p.action[2])}.`,
                `Paid ${amountText(p)} to ${label(p.action[2])}.`,
              )
            : t(
                `Equipo actualizado: ${p.action[1].threshold} de ${p.action[1].signers.length} aprobaciones.`,
                `Team updated: ${p.action[1].threshold} of ${p.action[1].signers.length} approvals.`,
              ),
      };
    const needed = config?.rules.threshold ?? 0;
    const missing = needed - p.approvals.length;
    if (outcome.kind === "propose")
      return {
        pending: true,
        text:
          p.action[0] === "Pay"
            ? t(
                `Pago solicitado: ${p.approvals.length} de ${needed} aprobaciones. Esperando a ${waitingFor(p)}.`,
                `Payment requested: ${p.approvals.length} of ${needed} approvals. Waiting for ${waitingFor(p)}.`,
              )
            : t(
                `Cambio de equipo solicitado: ${p.approvals.length} de ${needed} aprobaciones. Esperando a ${waitingFor(p)}.`,
                `Team change requested: ${p.approvals.length} of ${needed} approvals. Waiting for ${waitingFor(p)}.`,
              ),
      };
    return {
      pending: true,
      text:
        missing <= 0
          ? t(
              "Tu aprobación quedó registrada. Ya están todas: añade fondos y completa el pago.",
              "Your approval is recorded. All approvals are in: add funds and complete the payment.",
            )
          : t(
              `Tu aprobación quedó registrada. ${missing === 1 ? "Falta 1 más" : `Faltan ${missing} más`}.`,
              `Your approval is recorded. ${missing} more needed.`,
            ),
    };
  };
  // Signed in through the app, SoroSafe pays the network fee (fee-bump)
  // when it can. Sponsorship never blocks anything: unless the sponsor
  // answers 200 { sponsored: true, hash }, for any reason (offline, signed
  // out, OFF, NOT_ELIGIBLE, LIMIT, FAILED…), the same signed transaction is
  // submitted normally and the wallet pays a few cents. Only an error from
  // that final submission reaches the person. After a sponsor FAILED or
  // UNCERTAIN, it may fail with a sequence error: shown as a normal error.
  const send = async (signed: string) => {
    if (metadataId) {
      try {
        const r = await fetch("/api/junto", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "sponsor", signed }),
        });
        if (r.ok) {
          const d = (await r.json()) as { sponsored?: boolean; hash?: string };
          if (d.sponsored === true && d.hash)
            return { hash: d.hash, sponsored: true };
        }
      } catch {
        /* Fall back to a normal submission below. */
      }
    }
    const { txHash } = await submitContract(chain, signed);
    return { hash: txHash, sponsored: false };
  };
  const claimTestTokens = (asset: {
    code: string;
    issuer: string;
    contract: string;
  }) =>
    void work(async () => {
      const faucet = faucetFor(asset);
      if (!faucet || !signer) return;
      await ensureTestFunds(signer, chain);
      const wait = await readContract<bigint>(chain, faucet.faucet, "wait", [
        val.address(signer),
      ]);
      if (wait > BigInt(0)) throw new Error("FAUCET_WAIT");
      const stock = await readContract<bigint>(
        chain,
        asset.contract,
        "balance",
        [val.address(faucet.faucet)],
      );
      if (stock < BigInt(faucet.perClaim) * BigInt(10_000_000))
        throw new Error(
          asset.code === "USDC" ? "FAUCET_EMPTY_USDC" : "FAUCET_EMPTY",
          { cause: { code: asset.code } },
        );
      // A wallet needs a trustline before it can hold a classic asset.
      const account = await fetch(`${chain.horizon}/accounts/${signer}`).then(
        (r) =>
          r.json() as Promise<{
            balances?: { asset_code?: string; asset_issuer?: string }[];
          }>,
      );
      if (
        !account.balances?.some(
          (b) => b.asset_code === asset.code && b.asset_issuer === asset.issuer,
        )
      ) {
        const trust = await trustlineXdr(
          chain,
          signer,
          asset.code,
          asset.issuer,
        );
        await submitContract(chain, await signXdr(trust, signer, chain));
      }
      const quote = await prepareCall(chain, signer, faucet.faucet, "claim", [
        val.address(signer),
      ]);
      await send(await signXdr(quote.xdr, signer, chain));
      setWalletTick((n) => n + 1);
      toast.success(
        t(
          `Recibiste ${faucet.perClaim} ${asset.code} de prueba en tu wallet.`,
          `You received ${faucet.perClaim} test ${asset.code} in your wallet.`,
        ),
      );
    });
  // A G… recipient must exist and, for anything but XLM, hold the currency
  // (a trustline). Network trouble never blocks: Stellar checks it anyway.
  const checkRecipient = async (
    to: string,
    asset: { code: string; issuer: string },
  ) => {
    if (!StrKey.isValidEd25519PublicKey(to)) return;
    let account:
      | { balances?: { asset_code?: string; asset_issuer?: string }[] }
      | undefined;
    try {
      const r = await fetch(`${chain.horizon}/accounts/${to}`);
      if (r.status === 404)
        throw new Error("ACCOUNT_MISSING", { cause: { code: asset.code } });
      if (!r.ok) return;
      account = await r.json();
    } catch (e) {
      if (e instanceof Error && e.message === "ACCOUNT_MISSING") throw e;
      return;
    }
    if (
      asset.issuer &&
      Array.isArray(account?.balances) &&
      !account.balances.some(
        (b) => b.asset_code === asset.code && b.asset_issuer === asset.issuer,
      )
    )
      throw new Error("TRUSTLINE_REQUIRED", { cause: { code: asset.code } });
  };
  const recipientContact = book.find((c) => c.address === recipient);
  // What the typed amount means, and the most this vault can send (the
  // service fee comes on top, rounded up like the contract does).
  const typedValue = (() => {
    try {
      return units(normalizeAmount(amount));
    } catch {
      return BigInt(0);
    }
  })();
  const chosenBalance = chosen
    ? (balances[chosen.contract] ?? BigInt(0))
    : BigInt(0);
  const maxPay = (() => {
    if (!config) return BigInt(0);
    let max =
      (chosenBalance * BigInt(10000)) / BigInt(10000 + config.protocol.fee_bps);
    while (max > BigInt(0) && max + fee(max) > chosenBalance) max -= BigInt(1);
    return max;
  })();
  const overBalance =
    !!chosen &&
    typedValue > BigInt(0) &&
    typedValue + fee(typedValue) > chosenBalance;
  const openPay = (contract: string, to = "") => {
    setSelected(contract);
    setRecipient(to);
    setAmount("");
    setModal("pay");
  };
  const openDeposit = (contract: string) => {
    setSelected(contract);
    setAmount("");
    setModal("deposit");
  };
  const openRules = () => {
    if (!config) return;
    setNewSigners(config.rules.signers.join("\n"));
    setThreshold(config.rules.threshold);
    setDraftSigner("");
    setModal("rules");
  };
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
        (method === "execute" || (method === "approve" && completes(p))) &&
          p.action[0] === "ChangeRules",
        {
          technical: technicalFor(p),
          outcome:
            method === "revoke" || method === "cancel"
              ? { kind: method }
              : { kind: method, id: p.id },
        },
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
          <BrandWordmark mark />
        </Link>
        <div className="header-right">
          <span
            className="network"
            data-product-tour={
              chain.id === "mainnet" ? "app-network" : undefined
            }
          >
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
            <div className="vault-address-line">
              <button
                className="contract-address"
                onClick={() => copy(address)}
                title={address}
                aria-label={t(
                  "Copiar la dirección de la bóveda",
                  "Copy the vault address",
                )}
              >
                <code>{shortAddress(address)}</code>
                <Copy size={15} />
              </button>
              <a
                className="text-button"
                target="_blank"
                rel="noreferrer"
                href={`${chain.explorer}/contract/${address}`}
              >
                {t("Ver en Stellar", "View on Stellar")}
                <ExternalLink size={15} />
              </a>
            </div>
          </div>
          {config && (
            <div className="vault-heading-side">
              <div className="contract-rule" data-product-tour="vault-rule">
                <ShieldCheck size={24} />
                <strong>
                  {t(
                    `${config.rules.threshold} de ${config.rules.signers.length}`,
                    `${config.rules.threshold} of ${config.rules.signers.length}`,
                  )}
                </strong>
                <span>
                  {t(
                    "aprobaciones necesarias por pago",
                    "approvals needed per payment",
                  )}
                </span>
              </div>
              <div className="vault-heading-actions">
                <button
                  className="primary"
                  data-product-tour="vault-send"
                  disabled={busy || !!error || !member || !funded}
                  title={
                    !member
                      ? undefined
                      : funded
                        ? undefined
                        : t(
                            "Añade fondos a la bóveda para pagar",
                            "Add funds to the vault to pay",
                          )
                  }
                  onClick={() => funded && openPay(funded.contract)}
                >
                  <ArrowUpRight size={17} />
                  {t("Enviar", "Send")}
                </button>
                <button
                  className="secondary"
                  disabled={busy || !!error || !signer || !assets.length}
                  onClick={() => assets[0] && openDeposit(assets[0].contract)}
                >
                  <ArrowDownLeft size={17} />
                  {t("Añadir fondos", "Add funds")}
                </button>
              </div>
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
            ["funds", t("Fondos", "Funds")],
            ["activity", t("Solicitudes", "Requests")],
            ["contacts", t("Contactos", "Contacts")],
            ["team", t("Equipo", "Team")],
          ].map(([id, label]) => (
            <button
              key={id}
              className={section === id ? "active" : ""}
              onClick={() => setSection(id)}
            >
              {label}
              {id === "activity" && waiting.length > 0 && (
                <span
                  className="nav-badge"
                  aria-label={t(
                    `${waiting.length} esperan tu aprobación`,
                    `${waiting.length} waiting for your approval`,
                  )}
                >
                  {waiting.length}
                </span>
              )}
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
              {lostWallet && (
                <p className="error-banner" role="alert">
                  {errorText(new Error("TEST_WALLET_GONE"))}
                </p>
              )}
              {waiting.length > 0 && section !== "activity" && (
                <button
                  className="waiting-banner"
                  onClick={() => setSection("activity")}
                >
                  <strong>
                    {waiting.length === 1
                      ? t(
                          "1 solicitud espera tu aprobación",
                          "1 request is waiting for your approval",
                        )
                      : t(
                          `${waiting.length} solicitudes esperan tu aprobación`,
                          `${waiting.length} requests are waiting for your approval`,
                        )}
                  </strong>
                  <span>{t("Revisar", "Review")} →</span>
                </button>
              )}
              {section === "funds" && (
                <section>
                  {member && config.rules.signers.length === 1 && (
                    <div className="solo-card">
                      <Users size={22} />
                      <div>
                        <strong>
                          {t(
                            "Solo tú puedes mover estos fondos.",
                            "Only you can move these funds.",
                          )}
                        </strong>
                        <p>
                          {t(
                            "Añade a tus colegas y exige 2 aprobaciones para cada pago.",
                            "Add colleagues and require 2 approvals for each payment.",
                          )}
                        </p>
                      </div>
                      <button className="secondary" onClick={openRules}>
                        <UserPlus size={16} />
                        {t("Añadir personas", "Add people")}
                      </button>
                    </div>
                  )}
                  <div className="section-heading">
                    <div>
                      <h2>{t("Fondos de la bóveda", "Vault funds")}</h2>
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
                    {assets.map((a) => (
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
                        <div className="contract-actions row-actions">
                          <button
                            className="text-button"
                            disabled={busy || !!error || !signer}
                            onClick={() => openDeposit(a.contract)}
                          >
                            <ArrowDownLeft size={15} />
                            {t("Añadir fondos", "Add funds")}
                          </button>
                          <button
                            className="text-button"
                            disabled={
                              busy ||
                              !!error ||
                              !member ||
                              (balances[a.contract] ?? BigInt(0)) === BigInt(0)
                            }
                            onClick={() => openPay(a.contract)}
                          >
                            <ArrowUpRight size={15} />
                            {t("Enviar", "Send")}
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                  <p className="footnote">
                    {t(
                      "Para recibir de un cliente o un exchange, pide que lo envíen a tu propia wallet y después usa Añadir fondos.",
                      "To receive from a client or exchange, have it sent to your own wallet, then use Add funds.",
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
                      <h2>{t("Solicitudes del equipo", "Team requests")}</h2>
                      <p>
                        {t(
                          "Cada aprobación queda registrada en Stellar.",
                          "Every approval is recorded on Stellar.",
                        )}
                      </p>
                    </div>
                  </div>
                  {!proposals.length ? (
                    <div className="empty-large empty-state">
                      <Inbox size={28} />
                      <p>
                        {t(
                          "Todavía no hay solicitudes de pago.",
                          "No payment requests yet.",
                        )}
                      </p>
                      {member && (
                        <button
                          className="primary"
                          disabled={busy || !!error || !funded}
                          onClick={() => funded && openPay(funded.contract)}
                        >
                          <ArrowUpRight size={16} />
                          {t("Enviar un pago", "Send a payment")}
                        </button>
                      )}
                    </div>
                  ) : (
                    proposals.map((p) => {
                      const ready = live(p),
                        approved = p.approvals.includes(signer);
                      const pay = p.action[0] === "Pay";
                      // Every approval is in, but the vault lacked funds then.
                      const stuck =
                        p.approvals.length >= config.rules.threshold;
                      return (
                        <article
                          className="contract-proposal"
                          key={String(p.id)}
                        >
                          <div className="contract-proposal-title">
                            <div>
                              <small>
                                #{String(p.id + BigInt(1))} ·{" "}
                                {t("Pedido por ", "Requested by ")}
                                {person(p.proposer)}
                              </small>
                              <h3>
                                {pay
                                  ? amountText(p)
                                  : t("Cambio de equipo", "Team change")}
                              </h3>
                            </div>
                            <span className="network">
                              {p.status === 1
                                ? pay
                                  ? t("Pagado", "Paid")
                                  : t("Aplicado", "Applied")
                                : p.status === 2
                                  ? t("Cancelada", "Cancelled")
                                  : p.epoch !== config.epoch
                                    ? t(
                                        "Ya no es válida: el equipo cambió",
                                        "No longer valid: the team changed",
                                      )
                                    : !ready
                                      ? t("Caducada", "Expired")
                                      : t(
                                          `${p.approvals.length} de ${config.rules.threshold} aprobaciones`,
                                          `${p.approvals.length} of ${config.rules.threshold} approvals`,
                                        )}
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
                              : t("nadie todavía", "no one yet")}
                          </p>
                          {ready && !stuck && (
                            <p className="footnote waiting-line">
                              <strong>
                                {t("Esperando a: ", "Waiting for: ")}
                              </strong>
                              {waitingFor(p)}
                              {expiresIn(p) ? ` · ${expiresIn(p)}` : ""}
                            </p>
                          )}
                          {ready && stuck && (
                            <p className="footnote waiting-line">
                              {pay
                                ? t(
                                    "Ya están todas las aprobaciones, pero la bóveda no tenía saldo suficiente. Añade fondos y completa el pago.",
                                    "All approvals are in, but the vault didn't have enough balance. Add funds and complete the payment.",
                                  )
                                : t(
                                    "Ya están todas las aprobaciones. Completa el cambio para aplicarlo.",
                                    "All approvals are in. Complete the change to apply it.",
                                  )}
                              {expiresIn(p) ? ` · ${expiresIn(p)}` : ""}
                            </p>
                          )}
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
                                      completes(p)
                                        ? pay
                                          ? t(
                                              "Aprobar y pagar",
                                              "Approve and pay",
                                            )
                                          : t(
                                              "Aprobar y aplicar el cambio",
                                              "Approve and apply the change",
                                            )
                                        : pay
                                          ? t("Aprobar pago", "Approve payment")
                                          : t(
                                              "Aprobar cambio de equipo",
                                              "Approve team change",
                                            ),
                                    )
                                  }
                                >
                                  {completes(p)
                                    ? pay
                                      ? t("Aprobar y pagar", "Approve and pay")
                                      : t(
                                          "Aprobar y aplicar",
                                          "Approve and apply",
                                        )
                                    : t(
                                        "Revisar y aprobar",
                                        "Review and approve",
                                      )}
                                  <Check size={17} />
                                </button>
                              )}
                              {stuck && signer && (
                                <button
                                  className="primary"
                                  disabled={busy || !!error}
                                  onClick={() =>
                                    operation(
                                      p,
                                      "execute",
                                      pay
                                        ? t(
                                            "Completar pago",
                                            "Complete payment",
                                          )
                                        : t(
                                            "Completar cambio",
                                            "Complete change",
                                          ),
                                    )
                                  }
                                >
                                  {pay
                                    ? t("Completar pago", "Complete payment")
                                    : t("Completar cambio", "Complete change")}
                                  <ArrowUpRight size={17} />
                                </button>
                              )}
                              {member && approved && (
                                <button
                                  className="text-button"
                                  disabled={busy || !!error}
                                  onClick={() =>
                                    operation(
                                      p,
                                      "revoke",
                                      t(
                                        "Retirar mi aprobación",
                                        "Withdraw my approval",
                                      ),
                                    )
                                  }
                                >
                                  {t(
                                    "Retirar mi aprobación",
                                    "Withdraw my approval",
                                  )}
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
                                      t("Cancelar solicitud", "Cancel request"),
                                    )
                                  }
                                >
                                  {t("Cancelar solicitud", "Cancel request")}
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
                          {paidCounts[c.address] === BigInt(1)
                            ? t("pago confirmado", "confirmed payment")
                            : t("pagos confirmados", "confirmed payments")}
                        </small>
                        {member && (
                          <button
                            className="secondary contact-pay"
                            disabled={busy || !!error || !funded}
                            title={
                              funded
                                ? undefined
                                : t(
                                    "Añade fondos a la bóveda para pagar",
                                    "Add funds to the vault to pay",
                                  )
                            }
                            onClick={() =>
                              funded && openPay(funded.contract, c.address)
                            }
                          >
                            <ArrowUpRight size={16} />
                            {t("Pagar", "Pay")}
                          </button>
                        )}
                      </article>
                    ))
                  ) : (
                    <div className="empty-large empty-state">
                      <BookUser size={28} />
                      <p>
                        {metadataId
                          ? t(
                              "Guarda a quién pagas a menudo para que todo el equipo use la misma dirección.",
                              "Save who you pay often so the whole team uses the same address.",
                            )
                          : t(
                              "Puedes pagar directamente a una dirección de wallet. Para usar los contactos compartidos, entra en SoroSafe.",
                              "You can pay a wallet address directly. To use shared contacts, sign in to SoroSafe.",
                            )}
                      </p>
                      {metadataId && member && (
                        <button
                          className="primary"
                          onClick={() => {
                            setRecipient("");
                            setContactName("");
                            setModal("contact");
                          }}
                        >
                          <UserPlus size={16} />
                          {t("Añadir contacto", "Add contact")}
                        </button>
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
                          "Cambiar el equipo necesita las mismas aprobaciones.",
                          "Changing the team needs the same approvals.",
                        )}
                      </p>
                    </div>
                    {member && (
                      <button className="secondary" onClick={openRules}>
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
                        <strong>
                          {person(s)}
                          {s === signer ? t(" (tú)", " (you)") : ""}
                        </strong>
                        <button
                          className="address-chip"
                          title={s}
                          onClick={() => copy(s)}
                        >
                          {shortAddress(s)}
                          <Copy size={12} />
                        </button>
                      </span>
                    </div>
                  ))}
                  <dl className="details" data-product-tour="vault-fees">
                    <dt>{t("Comisión de servicio", "Service fee")}</dt>
                    <dd>
                      {t(
                        `${config.protocol.fee_bps / 100} % por pago, en la moneda del pago`,
                        `${config.protocol.fee_bps / 100}% per payment, in the payment currency`,
                      )}
                    </dd>
                    <dt>{t("Coste de red", "Network fee")}</dt>
                    <dd>
                      {metadataId
                        ? t(
                            "Lo cubre SoroSafe cuando puede",
                            "Covered by SoroSafe when possible",
                          )
                        : t(
                            "Unos céntimos, desde tu wallet",
                            "A few cents, from your wallet",
                          )}
                    </dd>
                  </dl>
                  <p className="footnote">
                    {t(
                      "SoroSafe cubre el coste de red cuando puede; si no, tu wallet paga unos céntimos.",
                      "SoroSafe covers network fees when it can; otherwise your wallet pays a few cents.",
                    )}
                  </p>
                  <details className="tech-details">
                    <summary>
                      {t("Detalles técnicos", "Technical details")}
                    </summary>
                    <dl className="details">
                      <dt>{t("Dirección de la bóveda", "Vault address")}</dt>
                      <dd className="full-address">{address}</dd>
                      <dt>{t("Destino de la comisión", "Fee recipient")}</dt>
                      <dd className="full-address">
                        {config.protocol.collector}
                      </dd>
                      <dt>
                        {t(
                          "Identificador del protocolo",
                          "Protocol identifier",
                        )}
                      </dt>
                      <dd className="full-address">{config.factory}</dd>
                    </dl>
                  </details>
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
                  ? t("Personas y aprobaciones", "People and approvals")
                  : modal === "contact"
                    ? t("Añadir contacto", "Add contact")
                    : t("Enviar un pago", "Send a payment"))}
          </DialogTitle>
          <DialogDescription className="dialog-description">
            {intent
              ? t(
                  "Revisa los datos y confírmalo en tu wallet.",
                  "Review the details, then confirm in your wallet.",
                )
              : modal === "pay"
                ? config && config.rules.threshold <= 1
                  ? t(
                      "Con tu firma el pago sale de inmediato.",
                      "With your signature the payment goes out right away.",
                    )
                  : t(
                      "Tu solicitud cuenta como tu aprobación. El pago sale cuando llegue la última aprobación necesaria.",
                      "Your request counts as your approval. The payment goes out with the last approval needed.",
                    )
                : modal === "rules" && config && config.rules.threshold > 1
                  ? t(
                      "El cambio se aplica cuando lo aprueben las personas necesarias.",
                      "The change applies once the people needed approve it.",
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
                <dt>{t("Coste de red", "Network fee")}</dt>
                <dd>
                  {metadataId
                    ? t(
                        "Lo cubre SoroSafe cuando puede; si no, unos céntimos desde tu wallet",
                        "Covered by SoroSafe when possible; otherwise a few cents from your wallet",
                      )
                    : t(
                        "Unos céntimos, desde tu wallet",
                        "A few cents, from your wallet",
                      )}
                </dd>
                <dt>{t("Tu wallet", "Your wallet")}</dt>
                <dd title={signer}>{shortAddress(signer)}</dd>
                <dt>{t("Red", "Network")}</dt>
                <dd>{chain.label}</dd>
              </dl>
              <details className="tech-details">
                <summary>{t("Detalles técnicos", "Technical details")}</summary>
                <dl className="details">
                  {(intent.technical ?? []).map(([label, value]) => (
                    <div className="contract-detail" key={label}>
                      <dt>{label}</dt>
                      <dd className="full-address">{value}</dd>
                    </div>
                  ))}
                  <dt>{t("Dirección de la bóveda", "Vault address")}</dt>
                  <dd className="full-address">{address}</dd>
                  <dt>{t("Tu wallet", "Your wallet")}</dt>
                  <dd className="full-address">{signer}</dd>
                  <dt>{t("Coste máximo de red", "Maximum network fee")}</dt>
                  <dd>{intent.fee} XLM</dd>
                </dl>
              </details>
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
                    const { hash, sponsored } = await send(signed);
                    const syncTeam = intent.sync,
                      outcome = intent.outcome;
                    setIntent(undefined);
                    setModal("");
                    await load();
                    if (syncTeam) await onMetadataChange?.();
                    const message = await outcomeText(outcome).catch(() => ({
                      text: t(
                        "Confirmado en Stellar.",
                        "Confirmed on Stellar.",
                      ),
                      pending: false,
                    }));
                    // A request still waiting for others lives in Requests.
                    if (message.pending) setSection("activity");
                    toast.success(message.text, {
                      description: sponsored
                        ? t(
                            "SoroSafe cubrió el coste de red.",
                            "SoroSafe covered the network fee.",
                          )
                        : undefined,
                      duration: 10000,
                      action: {
                        label: t("Ver recibo", "View receipt"),
                        onClick: () => openExplorer(hash),
                      },
                    });
                  })
                }
              >
                {busy ? (
                  <Loader2 className="spin" />
                ) : (
                  t("Confirmar en mi wallet", "Confirm in my wallet")
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
                    const id = await freshNextId();
                    await prepare(
                      address,
                      "propose",
                      [
                        val.address(signer),
                        val.u64(id),
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
                          t("Personas que aprueban", "People who approve"),
                          rules.signers.map(label).join("\n"),
                        ],
                        [
                          t("Regla de aprobación", "Approval rule"),
                          t(
                            `${threshold} de ${rules.signers.length} aprobaciones`,
                            `${threshold} of ${rules.signers.length} approvals`,
                          ),
                        ],
                      ],
                      // With a 1-of-N rule the change applies immediately.
                      config.rules.threshold <= 1,
                      { outcome: { kind: "propose", id } },
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
                        [
                          t("Bóveda de destino", "Destination vault"),
                          config.name || shortAddress(address),
                        ],
                      ],
                      false,
                      {
                        technical: [
                          [
                            t("Contrato de la moneda", "Currency contract"),
                            chosen.contract,
                          ],
                        ],
                        outcome: {
                          kind: "deposit",
                          amount: decimal(value),
                          code: chosen.code,
                        },
                      },
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
                    // Stop early if Stellar would refuse the payment anyway.
                    await checkRecipient(recipient, chosen);
                    const id = await freshNextId();
                    await prepare(
                      address,
                      "propose",
                      [
                        val.address(signer),
                        val.u64(id),
                        actionVal(["Pay", chosen.contract, recipient, value]),
                        val.u64(BigInt(Math.floor(Date.now() / 1000) + 86400)),
                      ],
                      config.rules.threshold <= 1
                        ? t("Enviar pago", "Send payment")
                        : t("Solicitar el pago", "Request the payment"),
                      [
                        [t("Destinatario", "Recipient"), named(recipient)],
                        [
                          t("Importe", "Amount"),
                          `${decimal(value)} ${chosen.code}`,
                        ],
                        [
                          t("Comisión de servicio", "Service fee"),
                          `${decimal(serviceFee)} ${chosen.code}`,
                        ],
                        [
                          t("Total de la bóveda", "Total from vault"),
                          `${decimal(value + serviceFee)} ${chosen.code}`,
                        ],
                        ...(config.rules.threshold > 1
                          ? [
                              [
                                t("Aprobaciones", "Approvals"),
                                t(
                                  `La tuya cuenta: 1 de ${config.rules.threshold}`,
                                  `Yours counts: 1 of ${config.rules.threshold}`,
                                ),
                              ] as [string, string],
                            ]
                          : []),
                      ],
                      false,
                      {
                        technical: [
                          [
                            t("Contrato de la moneda", "Currency contract"),
                            chosen.contract,
                          ],
                          [t("Destinatario", "Recipient"), recipient],
                        ],
                        outcome: { kind: "propose", id },
                      },
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
                        {signerList.length > 1 && s !== signer && (
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
                  <div className="help-box">
                    <p>
                      {t(
                        `Pide a tu colega que abra ${appHost}, entre, abra el menú de su cuenta → Copiar dirección y te la envíe.`,
                        `Ask your colleague to open ${appHost}, sign in, open their account menu → Copy address, and send it to you.`,
                      )}
                    </p>
                    <button
                      type="button"
                      className="text-button"
                      onClick={() =>
                        void navigator.clipboard
                          .writeText(invitation())
                          .then(() =>
                            toast.success(
                              t(
                                "Mensaje copiado. Pégalo en un correo o chat.",
                                "Message copied. Paste it into an email or chat.",
                              ),
                            ),
                          )
                          .catch(() =>
                            toast.error(
                              t(
                                "No se pudo copiar. Inténtalo otra vez.",
                                "Couldn't copy. Try again.",
                              ),
                            ),
                          )
                      }
                    >
                      <Copy size={14} />
                      {t(
                        "Copiar mensaje de invitación",
                        "Copy invitation message",
                      )}
                    </button>
                  </div>
                  <label>
                    {t("Añadir a una persona", "Add a person")}
                    <span className="add-signer">
                      <input
                        value={draftSigner}
                        placeholder={t(
                          "Su dirección de wallet (empieza por G)",
                          "Their wallet address (starts with G)",
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
                        `${threshold} de ${signerList.length} aprobaciones`,
                        `${threshold} of ${signerList.length} approvals`,
                      )}
                    </small>
                  </div>
                  {signerList.length > 1 && threshold === signerList.length && (
                    <p className="inline-warning" role="status">
                      {t(
                        "Si alguien pierde el acceso a su wallet, nadie podrá mover los fondos.",
                        "If anyone loses access to their wallet, no one can move the funds.",
                      )}
                    </p>
                  )}
                  <p className="footnote">
                    {t(
                      "Cuando se aplique este cambio, las solicitudes pendientes dejarán de ser válidas.",
                      "Once this change applies, pending requests will no longer be valid.",
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
                      {modal === "pay" && recipientContact ? (
                        <div className="recipient-chip">
                          <span>
                            <strong>{recipientContact.name}</strong>
                            {" · "}
                            <code title={recipient}>
                              {shortAddress(recipient)}
                            </code>
                          </span>
                          <button
                            type="button"
                            className="text-button"
                            onClick={() => setRecipient("")}
                          >
                            {t("Cambiar", "Change")}
                          </button>
                        </div>
                      ) : (
                        <>
                          {modal === "pay" && book.length > 0 && (
                            <label>
                              {t("Contactos", "Contacts")}
                              <select
                                value=""
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
                            {t(
                              "Dirección de wallet (empieza por G)",
                              "Wallet address (starts with G)",
                            )}
                            <input
                              required
                              value={recipient}
                              onChange={(e) =>
                                setRecipient(e.target.value.trim())
                              }
                            />
                          </label>
                          {recipient && (
                            <p className="footnote">
                              {t(
                                "Paga a una wallet personal. Todavía no se admiten cuentas de exchange que piden memo.",
                                "Pay to a personal wallet. Exchange accounts that need a memo aren't supported yet.",
                              )}
                            </p>
                          )}
                        </>
                      )}
                    </>
                  )}
                  {modal !== "contact" && chosen && (
                    <>
                      {modal === "pay" && fundedAssets.length > 1 ? (
                        <div
                          className="currency-picker"
                          role="radiogroup"
                          aria-label={t("Moneda", "Currency")}
                        >
                          {fundedAssets.map((a) => (
                            <button
                              type="button"
                              role="radio"
                              aria-checked={a.contract === chosen.contract}
                              className={
                                a.contract === chosen.contract ? "selected" : ""
                              }
                              key={a.contract}
                              onClick={() => setSelected(a.contract)}
                            >
                              <AssetMark asset={a} network={chain.id} />
                              <strong>{a.code}</strong>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div className="contract-selected">
                          <AssetMark asset={chosen} network={chain.id} />
                          <strong>{chosen.code}</strong>
                          <span>{chosen.issuerName}</span>
                        </div>
                      )}
                      <label>
                        {t("Importe", "Amount")}
                        <span className="amount-row">
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
                          {modal === "pay" && maxPay > BigInt(0) && (
                            <button
                              type="button"
                              className="text-button"
                              onClick={() => setAmount(decimal(maxPay))}
                            >
                              {t("Máx.", "Max")}
                            </button>
                          )}
                        </span>
                      </label>
                      {modal === "pay" && overBalance && (
                        <p className="inline-warning" role="alert">
                          {t(
                            `El importe más la comisión de servicio (${decimal(fee(typedValue))} ${chosen.code}) supera el saldo de la bóveda. Puedes enviar hasta ${decimal(maxPay)} ${chosen.code}.`,
                            `Amount plus the service fee (${decimal(fee(typedValue))} ${chosen.code}) is more than the vault holds. You can send up to ${decimal(maxPay)} ${chosen.code}.`,
                          )}
                        </p>
                      )}
                      {modal === "deposit" && walletBalance !== undefined && (
                        <p className="footnote">
                          {walletBalance === null
                            ? t(
                                `Tu wallet no tiene ${chosen.code} todavía.`,
                                `Your wallet doesn’t hold ${chosen.code} yet.`,
                              )
                            : t(
                                `En tu wallet: ${walletBalance} ${chosen.code}`,
                                `In your wallet: ${walletBalance} ${chosen.code}`,
                              )}
                        </p>
                      )}
                      {modal === "deposit" &&
                        faucetFor(chosen) &&
                        faucetReady === false &&
                        chosen.code === "USDC" && (
                          <a
                            className="text-button"
                            href="https://faucet.circle.com"
                            target="_blank"
                            rel="noreferrer"
                          >
                            {t(
                              "Consigue USDC de Testnet en el faucet de Circle (red Stellar)",
                              "Get Testnet USDC from Circle's faucet (Stellar network)",
                            )}
                            <ExternalLink size={14} />
                          </a>
                        )}
                      {modal === "deposit" &&
                        faucetFor(chosen) &&
                        faucetReady !== false && (
                          <button
                            type="button"
                            className="secondary faucet-button"
                            disabled={busy}
                            onClick={() => claimTestTokens(chosen)}
                          >
                            {t(
                              `Conseguir ${faucetFor(chosen)?.perClaim} ${chosen.code} de prueba`,
                              `Get ${faucetFor(chosen)?.perClaim} test ${chosen.code}`,
                            )}
                          </button>
                        )}
                      {modal === "pay" && (
                        <p className="footnote">
                          {t("Saldo: ", "Balance: ")}
                          {decimal(balances[chosen.contract] ?? BigInt(0))}{" "}
                          {chosen.code} ·{" "}
                          {t("Comisión de servicio: ", "Service fee: ")}
                          {config ? config.protocol.fee_bps / 100 : 0}%
                        </p>
                      )}
                    </>
                  )}
                </>
              )}
              <button
                className="primary wide"
                disabled={busy || !!error || (modal === "pay" && overBalance)}
              >
                {busy ? (
                  <Loader2 className="spin" />
                ) : modal === "contact" ? (
                  t("Guardar contacto", "Save contact")
                ) : modal === "rules" ? (
                  t("Revisar cambio", "Review change")
                ) : modal === "deposit" ? (
                  t("Revisar", "Review")
                ) : (
                  t("Revisar pago", "Review payment")
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
