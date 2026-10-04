import { env } from "cloudflare:workers";
import testnetTokens from "@/lib/testnet-tokens.json";
import {
  contractAssets,
  createArgs,
  describeCall,
  submitFeeBump,
  prepareCall,
  readContract,
  submitContract,
  verifiedConfig,
  verifyCode,
  type ContractConfig,
  type FactoryConfig,
} from "@/lib/contracts";
import {
  StrKey,
  Keypair,
  Operation,
  TransactionBuilder,
  Account,
} from "@stellar/stellar-sdk";
import { Buffer } from "node:buffer";
import { all, db, digest, one, run, token } from "@/lib/store";
import {
  chain,
  NETWORK,
  account,
  accountBalances,
  networkRules,
  checkPolicy,
  combine,
  decode,
  paymentXdr,
  receipt,
  setupXdr,
  signedBy,
  submit,
} from "@/lib/stellar";
import type { Contact, Payment, Person, Vault, State } from "@/lib/domain";
import {
  canSpend,
  decimal,
  sameAsset,
  units,
  assetCatalog,
  TRUST_LIMIT,
} from "@/lib/assets";
export const dynamic = "force-dynamic";
const now = () => Math.floor(Date.now() / 1000);
const vaultFields =
  "v.custody,v.network,v.id,v.name,v.owner,v.threshold,v.size,v.status,v.address,v.created";
type InternalVault = Vault & {
  setup: string | null;
  attempt: number;
  contract?: ContractConfig;
};
function activationDetails(encoded: string) {
  const tx = decode(encoded);
  const first = tx.operations[0];
  if (first.type !== "createAccount") fail("INVALID_TRANSACTION");
  return {
    xdr: encoded,
    address: first.destination,
    funding: first.startingBalance,
    fee: decimal(BigInt(tx.fee)),
    expires: Number(tx.timeBounds?.maxTime),
  };
}
function fail(code: string): never {
  throw new Error(code);
}
function str(
  b: Record<string, unknown>,
  key: string,
  max = 1000,
  optional = false,
) {
  const value = b[key];
  if (optional && (value === undefined || value === "")) return "";
  if (typeof value !== "string" || !value.trim() || value.length > max)
    fail("INVALID_INPUT");
  return value.trim();
}
function addr(value: string) {
  if (!StrKey.isValidEd25519PublicKey(value)) fail("INVALID_ADDRESS");
  return value;
}
function integer(
  b: Record<string, unknown>,
  key: string,
  min: number,
  max: number,
) {
  const n = b[key];
  if (typeof n !== "number" || !Number.isInteger(n) || n < min || n > max)
    fail("INVALID_RULE");
  return n;
}
function json(
  value: unknown,
  status = 200,
  headers: Record<string, string> = {},
) {
  return Response.json(value, {
    status,
    headers: { "Cache-Control": "no-store", ...headers },
  });
}
async function user(req: Request) {
  const raw =
    req.headers
      .get("authorization")
      ?.match(/^Bearer ([A-Za-z0-9_.-]+)$/)?.[1] ||
    req.headers
      .get("cookie")
      ?.split(";")
      .map((x) => x.trim())
      .find((x) => x.startsWith("junto_session="))
      ?.split("=")[1];
  if (!raw) return null;
  return one<Person>(
    "SELECT p.* FROM people p JOIN sessions s ON p.address=s.address WHERE s.hash=? AND s.expires>?",
    await digest(`${NETWORK}:${raw}`),
    now(),
  );
}
async function membership(id: string, address: string) {
  const v = await one<InternalVault>("SELECT * FROM vaults WHERE id=?", id);
  if (v && v.network !== chain.id) fail("NETWORK_MISMATCH");
  if (v?.custody === "soroban" && v.status === "active" && v.address) {
    const recorded = await one(
      "SELECT 1 FROM members WHERE vault=? AND address=?",
      id,
      address,
    );
    const c = await verifiedConfig(chain, v.address, env.JUNTO_FACTORY);
    const onChain = c.rules.signers.includes(address);
    // Recorded membership permits reconciliation after self-removal, never
    // access. RPC, code verification and database failures all fail closed.
    if (!onChain && !recorded) fail("NOT_MEMBER");
    await reconcileTeam(v, c);
    if (!onChain) fail("NOT_MEMBER");
  } else if (
    !(await one(
      "SELECT 1 FROM members WHERE vault=? AND address=?",
      id,
      address,
    ))
  )
    fail("NOT_MEMBER");
  if (!v) fail("NOT_MEMBER");
  if (v.network !== chain.id) fail("NETWORK_MISMATCH");
  return v;
}
async function reconcileTeam(v: InternalVault, c: ContractConfig) {
  const signers = c.rules.signers;
  const existing = await all<{ address: string }>(
    "SELECT address FROM members WHERE vault=?",
    v.id,
  );
  const have = new Set(existing.map((row) => row.address));
  const want = new Set(signers);
  const same =
    have.size === want.size &&
    signers.every((signer) => have.has(signer)) &&
    v.size === signers.length &&
    v.threshold === c.rules.threshold;
  if (same) {
    v.contract = c;
    return;
  }
  const issued = now();
  const statements = [];
  for (const signer of signers) {
    if (have.has(signer)) continue;
    statements.push(
      db()
        .prepare(
          "INSERT INTO people(address,name,joined) VALUES(?,?,?) ON CONFLICT(address) DO NOTHING",
        )
        .bind(signer, `${signer.slice(0, 4)}…${signer.slice(-4)}`, issued),
    );
    statements.push(
      db()
        .prepare("INSERT OR IGNORE INTO members(vault,address) VALUES(?,?)")
        .bind(v.id, signer),
    );
  }
  for (const signer of have) {
    if (want.has(signer)) continue;
    statements.push(
      db()
        .prepare("DELETE FROM members WHERE vault=? AND address=?")
        .bind(v.id, signer),
    );
  }
  statements.push(
    db()
      .prepare(
        "UPDATE vaults SET size=?, threshold=? WHERE id=? AND status='active'",
      )
      .bind(signers.length, c.rules.threshold, v.id),
  );
  await db().batch(statements);
  v.size = signers.length;
  v.threshold = c.rules.threshold;
  v.contract = c;
}
// Gas sponsorship: SoroSafe pays network fees for everyday vault operations,
// within limits that keep it affordable. Creating a vault is never sponsored.
const SPONSOR_MAX_FEE = BigInt(10_000_000); // 1 XLM per transaction
const SPONSOR_MIN_BALANCE = 20; // XLM kept so the sponsor account stays usable
const SPONSOR_DAILY_LIMIT = 20; // sponsored transactions per account per day
const VAULT_METHODS = ["propose", "approve", "revoke", "cancel", "execute"];
async function isVault(address: unknown) {
  if (typeof address !== "string" || !StrKey.isValidContract(address))
    return false;
  try {
    await verifiedConfig(chain, address, env.JUNTO_FACTORY);
    return true;
  } catch {
    return false;
  }
}
async function sponsorable(call: ReturnType<typeof describeCall>) {
  // Proposals, approvals and the rest of a vault's everyday operations.
  if (VAULT_METHODS.includes(call.method)) return isVault(call.contract);
  // Adding funds: a catalog token moved from the signer into a vault.
  if (
    call.method === "transfer" &&
    contractAssets(chain).some((a) => a.contract === call.contract)
  )
    return call.args[0] === call.source && isVault(call.args[1]);
  // Testnet faucets.
  return (
    chain.id === "testnet" &&
    call.method === "claim" &&
    [testnetTokens.USDT0.faucet, testnetTokens.USDC.faucet].includes(
      call.contract,
    )
  );
}
// The on-chain rules must be exactly the team and threshold agreed in the draft.
function matchesTeam(
  rules: { signers: string[]; threshold: number },
  threshold: number,
  people: Person[],
) {
  return (
    rules.threshold === threshold &&
    rules.signers.length === people.length &&
    people.every((p) => rules.signers.includes(p.address))
  );
}
async function team(vault: string) {
  return all<Person>(
    "SELECT p.* FROM people p JOIN members m ON p.address=m.address WHERE m.vault=? ORDER BY p.joined,p.address",
    vault,
  );
}
function teamSnapshot(id: string, people: Person[]) {
  // Compare the exact membership set inside the activation write. A count
  // alone misses a removed member being replaced while RPC preparation runs.
  return {
    sql: ` AND (SELECT count(*) FROM members WHERE vault=?)=? AND NOT EXISTS (SELECT 1 FROM members WHERE vault=? AND address NOT IN (${people.map(() => "?").join(",")}))`,
    args: [id, people.length, id, ...people.map((p) => p.address)],
  };
}
async function ensurePolicy(v: Vault) {
  if (!v.address || v.status !== "active") fail("VAULT_NOT_ACTIVE");
  const [a, m] = await Promise.all([account(v.address), team(v.id)]);
  if (
    !checkPolicy(
      a,
      m.map((x) => x.address),
      v.threshold,
    )
  )
    fail("POLICY_CHANGED");
  return a;
}
async function settle(p: Payment) {
  const r = await receipt(p.hash);
  if (r) {
    await run(
      "UPDATE payments SET status=? WHERE id=?",
      r.successful ? "paid" : "failed",
      p.id,
    );
    return r.successful ? "paid" : "failed";
  }
  if (p.expires < now()) {
    await run("UPDATE payments SET status='expired' WHERE id=?", p.id);
    return "expired";
  }
  return p.status;
}
async function broadcast(p: Payment, v: Vault) {
  const existing = await settle(p);
  if (existing === "paid") return;
  if (existing === "failed" || existing === "expired") fail("PAYMENT_EXPIRED");
  await ensurePolicy(v);
  const sigs = await all<{ address: string; signature: string }>(
    "SELECT address,signature FROM signatures WHERE payment=? ORDER BY created,address",
    p.id,
  );
  if (sigs.length < v.threshold) return;
  const claimed = await run(
    "UPDATE payments SET status='submitting' WHERE id=? AND status='pending'",
    p.id,
  );
  if (!claimed.meta.changes && p.status !== "submitting") return;
  try {
    await submit(
      combine(
        p.xdr,
        sigs.map((s) => s.signature),
        v.threshold,
      ),
    );
    const r = await receipt(p.hash);
    if (r)
      await run(
        "UPDATE payments SET status=? WHERE id=?",
        r.successful ? "paid" : "failed",
        p.id,
      );
  } catch (e) {
    const found = await receipt(p.hash).catch(() => null);
    if (found) {
      await run(
        "UPDATE payments SET status=? WHERE id=?",
        found.successful ? "paid" : "failed",
        p.id,
      );
      return;
    }
    const msg = e instanceof Error ? e.message : "SUBMISSION_UNCERTAIN";
    if (
      ["STALE_PAYMENT", "INSUFFICIENT_FUNDS", "TRUSTLINE_REQUIRED"].includes(
        msg,
      )
    )
      await run("UPDATE payments SET status='failed' WHERE id=?", p.id);
    throw e;
  }
}
function error(e: unknown) {
  const code = errorCode(e);
  return json(
    { error: code },
    ["SIGN_IN_REQUIRED", "EXPIRED_LOGIN"].includes(code)
      ? 401
      : ["NOT_MEMBER", "NOT_OWNER", "INVALID_ORIGIN"].includes(code)
        ? 403
        : 400,
  );
}
function errorCode(e: unknown) {
  const msg = e instanceof Error ? e.message : "UNKNOWN";
  const known = [
    "CANNOT_REMOVE",
    "CONTRACT_NOT_CONFIGURED",
    "CONTRACT_REJECTED",
    "CONTRACT_UNAVAILABLE",
    "CONTRACT_MEMO_UNSUPPORTED",
    "UNVERIFIED_CONTRACT",
    "CONTRACT_FEE_LIMIT",
    "INVALID_INPUT",
    "INVALID_RULE",
    "INVALID_ADDRESS",
    "INVALID_AMOUNT",
    "INVALID_TRANSACTION",
    "CHANGED_TRANSACTION",
    "INVALID_SIGNATURE",
    "ACCOUNT_MISSING",
    "NETWORK_UNAVAILABLE",
    "NOT_MEMBER",
    "SIGN_IN_REQUIRED",
    "EXPIRED_LOGIN",
    "VAULT_NOT_ACTIVE",
    "POLICY_CHANGED",
    "PAYMENT_EXPIRED",
    "STALE_PAYMENT",
    "INSUFFICIENT_FUNDS",
    "ASSET_UNAVAILABLE",
    "NETWORK_MISMATCH",
    "ASSET_ENABLED",
    "ACTIVATION_EXPIRED",
    "TRUSTLINE_REQUIRED",
    "SUBMISSION_UNCERTAIN",
    "INVITE_CLOSED",
    "NOT_OWNER",
    "TEAM_INCOMPLETE",
    "PAYMENT_PENDING",
    "CONTACT_EXISTS",
    "MEMO_TOO_LONG",
    "INVALID_ORIGIN",
    "STORAGE_UNAVAILABLE",
    "INSUFFICIENT_SIGNATURES",
    "ALREADY_ACTIVE",
    "RATE_LIMITED",
    "CONFIGURATION_REQUIRED",
    "CONFIGURATION_CHANGED",
  ];
  const code = known.includes(msg) ? msg : "UNAVAILABLE";
  if (code === "UNAVAILABLE")
    console.error("junto_api_error", msg.slice(0, 180));
  return code;
}
export async function GET(req: Request) {
  try {
    const url = new URL(req.url),
      me = await user(req);
    if (url.searchParams.has("invite")) {
      const inv = await one<{
        name: string;
        threshold: number;
        size: number;
        status: string;
        count: number;
      }>(
        "SELECT v.name,v.threshold,v.size,v.status,(SELECT count(*) FROM members m WHERE m.vault=v.id) as count FROM vaults v WHERE invite_hash=? AND network=?",
        await digest(url.searchParams.get("invite") || ""),
        chain.id,
      );
      if (!inv) fail("INVITE_CLOSED");
      return json({ invite: inv });
    }
    const state: State = {
      network: chain,
      factory: env.JUNTO_FACTORY,
      catalog: assetCatalog(chain.id),
      user: me,
      vaults: [],
      people: [],
      contacts: [],
      payments: [],
      balances: [],
    };
    if (!me) return json(state);
    const requested = url.searchParams.get("vault") || "";
    const candidates = requested
      ? [requested]
      : (
          await all<{ id: string }>(
            `SELECT v.id FROM vaults v JOIN members m ON v.id=m.vault WHERE m.address=? AND v.network=? ORDER BY v.created DESC`,
            me.address,
            chain.id,
          )
        ).map((row) => row.id);
    // One vault that cannot be verified (RPC down, old factory, removed
    // member) must not take the whole app down: open the next one instead
    // and report what failed.
    let v: InternalVault | undefined;
    let id = "";
    for (const candidate of candidates) {
      try {
        v = await membership(candidate, me.address);
        id = candidate;
        break;
      } catch (e) {
        const code = errorCode(e);
        // Vaults from an earlier SoroSafe version can never be opened again;
        // skip them quietly unless the person asked for that vault.
        if (requested || code !== "UNVERIFIED_CONTRACT")
          state.vaultError ??= code;
      }
    }
    state.vaults = await all<Vault>(
      `SELECT ${vaultFields} FROM vaults v JOIN members m ON v.id=m.vault WHERE m.address=? AND v.network=? ORDER BY v.created DESC`,
      me.address,
      chain.id,
    );
    if (!v) return json(state);
    const people = await team(id);
    state.people = people;
    if (v.custody !== "soroban" && v.status === "activating" && v.address) {
      try {
        const a = await account(v.address);
        if (
          checkPolicy(
            a,
            people.map((p) => p.address),
            v.threshold,
          )
        ) {
          await run(
            "UPDATE vaults SET status='active',setup=NULL,invite_hash=NULL WHERE id=?",
            v.id,
          );
          v.status = "active";
        }
      } catch {
        /* A pending activation stays pending until the ledger confirms it. */
      }
    }
    state.vault = {
      custody: v.custody,
      network: v.network,
      id: v.id,
      name: v.name,
      owner: v.owner,
      threshold: v.threshold,
      size: v.size,
      status: v.status,
      address: v.address,
      created: v.created,
    };
    if (v.custody === "soroban") {
      if (v.address && v.status !== "draft") {
        try {
          const c =
            v.contract ??
            (await verifiedConfig(chain, v.address, env.JUNTO_FACTORY));
          // A contract deployed outside the agreed draft never activates it.
          if (
            v.status !== "active" &&
            !matchesTeam(c.rules, v.threshold, people)
          )
            throw new Error("POLICY_CHANGED");
          state.vault.status = "active";
          state.vault.size = c.rules.signers.length;
          state.vault.threshold = c.rules.threshold;
          state.people = c.rules.signers.map(
            (address) =>
              people.find((p) => p.address === address) || {
                address,
                name: address,
                joined: 0,
              },
          );
          if (v.status !== "active")
            await run(
              "UPDATE vaults SET status='active',setup=NULL,invite_hash=NULL WHERE id=?",
              id,
            );
        } catch (e) {
          // Keep the app usable: the team sees the vault list and the creator
          // can discard this activation instead of every load failing.
          if (e instanceof Error && e.message === "POLICY_CHANGED")
            state.policyMismatch = true;
          else if (v.status === "active") state.chainError = true;
        }
      }
      state.contacts = await all<Contact>(
        "SELECT c.id,c.name,c.address,c.memo,c.created_by as createdBy,p.name as creatorName,c.created,NULL as paidCount FROM contacts c JOIN people p ON c.created_by=p.address WHERE c.vault=? ORDER BY c.name",
        id,
      );
      return json(state);
    }
    const pending = await all<Payment>(
      "SELECT * FROM payments WHERE vault=? AND status in ('pending','submitting')",
      id,
    );
    await Promise.all(
      pending.map((p) =>
        settle(p).catch(() => {
          state.chainError = true;
        }),
      ),
    );
    [state.contacts, state.payments] = await Promise.all([
      all<Contact>(
        "SELECT c.id,c.name,c.address,c.memo,c.created_by as createdBy,p.name as creatorName,c.created,(SELECT count(*) FROM payments t WHERE t.vault=c.vault AND t.destination=c.address AND t.memo=c.memo AND t.status='paid') as paidCount FROM contacts c JOIN people p ON c.created_by=p.address WHERE c.vault=? ORDER BY c.name",
        id,
      ),
      all<Payment>(
        "SELECT t.*,p.name as proposerName FROM payments t JOIN people p ON p.address=t.proposer WHERE t.vault=? ORDER BY t.created DESC LIMIT 100",
        id,
      ),
    ]);
    const signatures = await all<{
      payment: string;
      address: string;
      name: string;
    }>(
      "SELECT s.payment,s.address,p.name FROM signatures s JOIN people p ON p.address=s.address JOIN payments t ON t.id=s.payment WHERE t.vault=?",
      id,
    );
    for (const p of state.payments) {
      p.fee = decimal(BigInt(decode(p.xdr).fee));
      p.approvals = signatures
        .filter((s) => s.payment === p.id)
        .map((s) => ({ address: s.address, name: s.name }));
    }
    if (v.status === "active" && v.address) {
      try {
        const [a, rules] = await Promise.all([
          account(v.address),
          networkRules(),
        ]);
        state.paymentFee = decimal(rules.fee);
        state.baseReserve = decimal(rules.reserve);
        for (const p of state.payments)
          if (p.kind === "enable") p.reserve = decimal(rules.reserve);
        state.balances = accountBalances(a, rules, state.payments);
        if (
          !checkPolicy(
            a,
            people.map((x) => x.address),
            v.threshold,
          )
        )
          state.chainError = true;
      } catch {
        state.chainError = true;
      }
    }
    return json(state);
  } catch (e) {
    return error(e);
  }
}
export async function POST(req: Request) {
  try {
    const origin = new URL(req.url).origin;
    if (req.headers.get("origin") !== origin) fail("INVALID_ORIGIN");
    if (Number(req.headers.get("content-length") || 0) > 60000)
      fail("INVALID_INPUT");
    const body = await req.text();
    if (body.length > 60000) fail("INVALID_INPUT");
    const b = JSON.parse(body) as Record<string, unknown>;
    const action = str(b, "action", 40);
    const me = await user(req);
    if (!me) fail("SIGN_IN_REQUIRED");
    if (action === "logout") {
      const cookie =
        req.headers
          .get("authorization")
          ?.match(/^Bearer ([A-Za-z0-9_.-]+)$/)?.[1] ||
        req.headers.get("cookie")?.match(/junto_session=([^;]+)/)?.[1];
      if (cookie)
        await run(
          "DELETE FROM sessions WHERE hash=?",
          await digest(`${NETWORK}:${cookie}`),
        );
      return json({ ok: true }, 200, {
        "Set-Cookie":
          "junto_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0",
      });
    }
    if (action === "sponsor") {
      // Gas sponsorship is a perk, never a dependency: every "no" here makes
      // the client submit the same signed transaction and pay the fee itself.
      const no = (reason: string) => json({ sponsored: false, reason });
      if (!env.SPONSOR_SECRET) return no("OFF");
      const signed = str(b, "signed", 40000);
      let call: ReturnType<typeof describeCall>;
      try {
        call = describeCall(signed, chain);
      } catch {
        return no("NOT_ELIGIBLE");
      }
      if (call.source !== me.address || call.fee > SPONSOR_MAX_FEE)
        return no("NOT_ELIGIBLE");
      if (!(await sponsorable(call))) return no("NOT_ELIGIBLE");
      const key = Keypair.fromSecret(env.SPONSOR_SECRET);
      const sponsor = await fetch(
        `${chain.horizon}/accounts/${key.publicKey()}`,
      )
        .then((r) =>
          r.ok
            ? (r.json() as Promise<{
                balances: { asset_type: string; balance: string }[];
              }>)
            : null,
        )
        .catch(() => null);
      const xlm = Number(
        sponsor?.balances.find((x) => x.asset_type === "native")?.balance ?? 0,
      );
      if (xlm < SPONSOR_MIN_BALANCE) return no("EMPTY");
      const counted = await run(
        "INSERT INTO sponsorships(address,day,count) VALUES(?,?,1) ON CONFLICT(address,day) DO UPDATE SET count=sponsorships.count+1 WHERE sponsorships.count<?",
        me.address,
        Math.floor(now() / 86400),
        SPONSOR_DAILY_LIMIT,
      );
      if (!counted.meta.changes) return no("LIMIT");
      const result = await submitFeeBump(chain, signed, key);
      return json({ sponsored: true, hash: result.txHash });
    }
    if (action === "profile") {
      await run(
        "UPDATE people SET name=? WHERE address=?",
        str(b, "name", 60),
        me.address,
      );
      return json({ ok: true });
    }
    if (action === "create") {
      const name = str(b, "name", 80);
      const owned = await one<{ n: number }>(
        "SELECT count(*) as n FROM vaults WHERE owner=?",
        me.address,
      );
      if ((owned?.n || 0) >= 30) fail("RATE_LIMITED");
      const id = crypto.randomUUID();
      await db().batch([
        db()
          .prepare(
            // The creator starts alone (1 of 1) and adds signers on-chain later.
            "INSERT INTO vaults(id,name,owner,threshold,size,created,network,custody) VALUES(?,?,?,1,1,?,?,'soroban')",
          )
          .bind(id, name, me.address, now(), chain.id),
        db()
          .prepare("INSERT INTO members(vault,address) VALUES(?,?)")
          .bind(id, me.address),
      ]);
      return json({ id });
    }
    if (action === "join") {
      const invite = await digest(str(b, "invite", 64));
      const v = await one<Vault>(
        "SELECT * FROM vaults WHERE invite_hash=?",
        invite,
      );
      if (!v || v.status !== "draft" || v.network !== chain.id)
        fail("INVITE_CLOSED");
      await run(
        "INSERT OR IGNORE INTO members(vault,address) SELECT id,? FROM vaults WHERE id=? AND status='draft' AND invite_hash=? AND (SELECT count(*) FROM members WHERE vault=?)<size",
        me.address,
        v.id,
        invite,
        v.id,
      );
      await membership(v.id, me.address);
      return json({ id: v.id });
    }
    if (action === "removeMember") {
      const id = str(b, "vault", 60);
      const v = await membership(id, me.address);
      if (v.owner !== me.address) fail("NOT_OWNER");
      if (v.status !== "draft") fail("ALREADY_ACTIVE");
      const address = addr(str(b, "address", 56));
      if (address === v.owner) fail("CANNOT_REMOVE");
      if (
        !(await one(
          "SELECT 1 FROM members WHERE vault=? AND address=?",
          id,
          address,
        ))
      )
        fail("NOT_MEMBER");
      const [removed] = await db().batch([
        db()
          .prepare(
            "DELETE FROM members WHERE vault=? AND address=? AND address!=? AND EXISTS (SELECT 1 FROM vaults WHERE id=? AND status='draft')",
          )
          .bind(id, address, v.owner, id),
        db()
          .prepare(
            "UPDATE vaults SET invite_hash=NULL WHERE id=? AND status='draft'",
          )
          .bind(id),
      ]);
      if (!removed.meta.changes) fail("CONFIGURATION_CHANGED");
      return json({ ok: true });
    }
    const id = str(b, "vault", 60),
      v = await membership(id, me.address);
    if (action === "configure") {
      if (v.owner !== me.address) fail("NOT_OWNER");
      if (v.status !== "draft") fail("ALREADY_ACTIVE");
      const size = integer(b, "size", 2, 20),
        threshold = integer(b, "threshold", 2, 20);
      if (threshold > size) fail("INVALID_RULE");
      // Check membership in the same statement: a concurrent join must not
      // leave more signers than the chosen team size.
      const saved = await run(
        "UPDATE vaults SET size=?,threshold=?,invite_hash=NULL WHERE id=? AND status='draft' AND (SELECT count(*) FROM members WHERE vault=?)<=?",
        size,
        threshold,
        id,
        id,
        size,
      );
      if (!saved.meta.changes) fail("CONFIGURATION_CHANGED");
      return json({ ok: true });
    }
    if (action === "invite") {
      if (v.owner !== me.address) fail("NOT_OWNER");
      if (v.status !== "draft") fail("INVITE_CLOSED");
      if (v.size < 2 || v.threshold < 2) fail("CONFIGURATION_REQUIRED");
      const invite = token();
      const saved = await run(
        "UPDATE vaults SET invite_hash=? WHERE id=? AND status='draft' AND size=? AND threshold=?",
        await digest(invite),
        id,
        v.size,
        v.threshold,
      );
      if (!saved.meta.changes) fail("CONFIGURATION_CHANGED");
      return json({ invite });
    }
    if (v.custody === "soroban" && action === "prepareVault") {
      if (v.owner !== me.address) fail("NOT_OWNER");
      if (v.status === "active") fail("ALREADY_ACTIVE");
      if (!env.JUNTO_FACTORY || !StrKey.isValidContract(env.JUNTO_FACTORY))
        fail("CONTRACT_NOT_CONFIGURED");
      const people = await team(id);
      if (people.length !== v.size) fail("TEAM_INCOMPLETE");
      await verifyCode(chain, env.JUNTO_FACTORY, "factory");
      const protocol = await readContract<FactoryConfig>(
        chain,
        env.JUNTO_FACTORY,
        "config",
      );
      // Stable salt per draft. Retrying cannot create a second vault. A
      // discarded activation moves to the next salt; its address is taken.
      const salt = Buffer.from(
        await digest(
          v.attempt ? `${chain.id}:${id}:${v.attempt}` : `${chain.id}:${id}`,
        ),
        "hex",
      );
      const args = createArgs(me.address, salt, v.name, {
        signers: people.map((p) => p.address),
        threshold: v.threshold,
      });
      const quote = await prepareCall(
        chain,
        me.address,
        env.JUNTO_FACTORY,
        "create",
        args,
      );
      if (
        typeof quote.result !== "string" ||
        !StrKey.isValidContract(quote.result)
      )
        fail("INVALID_TRANSACTION");
      const snapshot = teamSnapshot(id, people);
      const saved = await run(
        "UPDATE vaults SET address=?,setup=?,status='activating',invite_hash=NULL WHERE id=? AND status=? AND size=? AND threshold=?" +
          snapshot.sql,
        quote.result,
        quote.xdr,
        id,
        v.status,
        v.size,
        v.threshold,
        ...snapshot.args,
      );
      if (!saved.meta.changes) fail("CONFIGURATION_CHANGED");
      return json({
        ...quote,
        address: quote.result,
        funding: "0",
        kind: "soroban",
        factory: env.JUNTO_FACTORY,
        salt: salt.toString("hex"),
        feeBps: protocol.protocol.fee_bps,
        collector: protocol.protocol.collector,
      });
    }
    if (v.custody === "soroban" && action === "discardActivation") {
      if (v.owner !== me.address) fail("NOT_OWNER");
      if (v.status !== "activating" || !v.address) fail("INVALID_TRANSACTION");
      // Only a contract confirmed on Stellar with other rules can be dropped.
      // A pending deployment with the agreed team must be allowed to finish.
      const c = await verifiedConfig(chain, v.address, env.JUNTO_FACTORY);
      if (matchesTeam(c.rules, v.threshold, await team(id)))
        fail("ALREADY_ACTIVE");
      const reset = await run(
        "UPDATE vaults SET status='draft',address=NULL,setup=NULL,attempt=attempt+1 WHERE id=? AND status='activating' AND address=?",
        id,
        v.address,
      );
      if (!reset.meta.changes) fail("CONFIGURATION_CHANGED");
      return json({ ok: true });
    }
    if (v.custody === "soroban" && action === "activate") {
      if (v.owner !== me.address) fail("NOT_OWNER");
      if (!v.setup || !v.address || v.status !== "activating")
        fail("INVALID_TRANSACTION");
      const signed = str(b, "signed", 40000);
      signedBy(v.setup, signed, me.address);
      await submitContract(chain, signed);
      const c = await verifiedConfig(chain, v.address, env.JUNTO_FACTORY);
      const people = await team(id);
      if (!matchesTeam(c.rules, v.threshold, people)) fail("POLICY_CHANGED");
      await run(
        "UPDATE vaults SET status='active',setup=NULL,invite_hash=NULL WHERE id=?",
        id,
      );
      return json({ ok: true });
    }
    if (v.custody === "soroban" && !["contact"].includes(action))
      fail("INVALID_INPUT");
    if (action === "prepareVault") {
      if (v.owner !== me.address) fail("NOT_OWNER");
      if (v.status === "active") fail("ALREADY_ACTIVE");
      if (v.size < 2 || v.threshold < 2) fail("CONFIGURATION_REQUIRED");
      const people = await team(id);
      if (people.length !== v.size) fail("TEAM_INCOMPLETE");
      const rules = await networkRules();
      if (v.setup) {
        const details = activationDetails(v.setup);
        const previous = await receipt(
          Buffer.from(decode(v.setup).hash()).toString("hex"),
        );
        if (previous?.successful) fail("ALREADY_ACTIVE");
        if (!previous && details.expires > now()) return json(details);
        // Failed transactions consumed their sequence. Otherwise wait for the
        // ledger to pass the old timeout before creating a different account.
        if (
          !previous &&
          (!Number.isFinite(rules.closedAt) ||
            rules.closedAt <= details.expires)
        )
          fail("ACTIVATION_EXPIRED");
      }
      const source = await account(me.address);
      const key = Keypair.random();
      const count = assetCatalog(chain.id).length;
      const funding = decimal(
        BigInt(2 + people.length + count) * rules.reserve +
          BigInt(count + 1) * rules.fee,
      );
      const operationCount = people.length + 2;
      const required = units(funding) + BigInt(operationCount) * rules.fee;
      const balance = accountBalances(source, rules).find((b) => !b.issuer);
      if (
        !balance ||
        units(balance.balance) -
          units(balance.reserve) -
          units(balance.liabilities) <
          required
      )
        fail("INSUFFICIENT_FUNDS");
      let builder = new TransactionBuilder(
        new Account(source.id, source.sequence),
        { fee: rules.fee.toString(), networkPassphrase: NETWORK },
      ).addOperation(
        Operation.createAccount({
          destination: key.publicKey(),
          startingBalance: funding,
        }),
      );
      for (const member of people)
        builder = builder.addOperation(
          Operation.setOptions({
            source: key.publicKey(),
            signer: { ed25519PublicKey: member.address, weight: 1 },
          }),
        );
      const tx = builder
        .addOperation(
          Operation.setOptions({
            source: key.publicKey(),
            masterWeight: 0,
            lowThreshold: v.threshold,
            medThreshold: v.threshold,
            highThreshold: v.threshold,
          }),
        )
        .setTimeout(600)
        .build();
      // Only the bootstrap signature is retained. The master key is disabled
      // in the same atomic transaction; the owner's wallet must also sign.
      tx.sign(key);
      const encoded = tx.toXDR();
      const snapshot = teamSnapshot(id, people);
      const saved = await run(
        "UPDATE vaults SET address=?,setup=?,status='activating',invite_hash=NULL WHERE id=? AND status=? AND COALESCE(setup,'')=? AND size=? AND threshold=?" +
          snapshot.sql,
        key.publicKey(),
        encoded,
        id,
        v.status,
        v.setup || "",
        v.size,
        v.threshold,
        ...snapshot.args,
      );
      if (!saved.meta.changes) fail("CONFIGURATION_CHANGED");
      return json(activationDetails(encoded));
    }
    if (action === "prepareActivation") {
      if (chain.id !== "testnet") fail("INVALID_INPUT");
      if (v.owner !== me.address) fail("NOT_OWNER");
      if (v.status !== "draft") fail("ALREADY_ACTIVE");
      if (v.size < 2 || v.threshold < 2) fail("CONFIGURATION_REQUIRED");
      const people = await team(id);
      if (people.length !== v.size) fail("TEAM_INCOMPLETE");
      const address = addr(str(b, "address", 56));
      if (people.some((p) => p.address === address)) fail("INVALID_ADDRESS");
      const a = await account(address);
      if (
        a.signers.length !== 1 ||
        a.signers[0].key !== address ||
        a.signers[0].weight !== 1
      )
        fail("INVALID_TRANSACTION");
      const xdr = setupXdr(
        a,
        people.map((p) => p.address),
        v.threshold,
      );
      const snapshot = teamSnapshot(id, people);
      const result = await run(
        "UPDATE vaults SET address=?,setup=?,status='activating',invite_hash=NULL WHERE id=? AND status='draft' AND size=? AND threshold=?" +
          snapshot.sql,
        address,
        xdr,
        id,
        v.size,
        v.threshold,
        ...snapshot.args,
      );
      if (!result.meta.changes) fail("CONFIGURATION_CHANGED");
      return json({ xdr });
    }
    if (action === "activate") {
      if (v.owner !== me.address) fail("NOT_OWNER");
      if (v.status !== "activating" || !v.setup || !v.address)
        fail("INVALID_TRANSACTION");
      const signed = str(b, "signed", 40000);
      const setup = decode(v.setup);
      let encoded = signed;
      if (setup.operations[0].type === "createAccount") {
        if (setup.source !== v.owner) fail("INVALID_TRANSACTION");
        const ownerSignature = signedBy(v.setup, signed, v.owner);
        signedBy(v.setup, v.setup, v.address);
        encoded = combine(v.setup, [ownerSignature], 1);
      } else {
        if (chain.id !== "testnet") fail("INVALID_TRANSACTION");
        signedBy(v.setup, signed, v.address);
      }
      const found = await receipt(Buffer.from(setup.hash()).toString("hex"));
      if (!found) await submit(encoded);
      const a = await account(v.address),
        people = await team(id);
      if (
        !checkPolicy(
          a,
          people.map((p) => p.address),
          v.threshold,
        )
      )
        fail("POLICY_CHANGED");
      await run("UPDATE vaults SET status='active',setup=NULL WHERE id=?", id);
      return json({ ok: true });
    }
    if (action === "contact") {
      const name = str(b, "name", 80),
        address = addr(str(b, "address", 56)),
        memo = str(b, "memo", 80, true);
      if (Buffer.byteLength(memo) > 28) fail("MEMO_TOO_LONG");
      if (v.custody === "soroban" && memo) fail("CONTRACT_MEMO_UNSUPPORTED");
      if (
        await one(
          "SELECT id FROM contacts WHERE vault=? AND address=? AND memo=?",
          id,
          address,
          memo,
        )
      )
        fail("CONTACT_EXISTS");
      const count = await one<{ n: number }>(
        "SELECT count(*) as n FROM contacts WHERE vault=?",
        id,
      );
      if ((count?.n || 0) >= 500) fail("RATE_LIMITED");
      await run(
        "INSERT INTO contacts(id,vault,name,address,memo,created_by,created) VALUES(?,?,?,?,?,?,?)",
        crypto.randomUUID(),
        id,
        name,
        address,
        memo,
        me.address,
        now(),
      );
      return json({ ok: true });
    }
    if (action === "enableAsset") {
      const a = await ensurePolicy(v);
      const existing = await one<Payment>(
        "SELECT * FROM payments WHERE vault=? AND status in ('pending','submitting')",
        id,
      );
      if (
        existing &&
        ["pending", "submitting"].includes(await settle(existing))
      )
        fail("PAYMENT_PENDING");
      const asset = assetCatalog(chain.id).find(
        (asset) => asset.code === b.code && asset.issuer === b.issuer,
      );
      if (!asset) fail("ASSET_UNAVAILABLE");
      if (
        a.balances.some(
          (balance) =>
            balance.asset_code === asset.code &&
            balance.asset_issuer === asset.issuer,
        )
      )
        fail("ASSET_ENABLED");
      const rules = await networkRules();
      const native = accountBalances(a, rules).find(
        (balance) => !balance.issuer,
      );
      if (!native || units(native.available) < rules.reserve)
        fail("INSUFFICIENT_FUNDS");
      const { Asset } = await import("@stellar/stellar-sdk");
      const expires = now() + 86400;
      const tx = new TransactionBuilder(new Account(a.id, a.sequence), {
        fee: rules.fee.toString(),
        networkPassphrase: NETWORK,
        timebounds: { minTime: 0, maxTime: expires },
      })
        .addOperation(
          Operation.changeTrust({
            asset: new Asset(asset.code, asset.issuer),
            limit: TRUST_LIMIT,
          }),
        )
        .build();
      const paymentId = crypto.randomUUID();
      await run(
        "INSERT INTO payments(id,vault,contact,recipient,destination,memo,amount,code,issuer,note,proposer,xdr,hash,expires,status,created,kind) VALUES(?,?,?,?,?,?,'0',?,?,?,?,?,?,?,'pending',?,'enable')",
        paymentId,
        id,
        "",
        asset.code,
        a.id,
        "",
        asset.code,
        asset.issuer,
        "",
        me.address,
        tx.toXDR(),
        Buffer.from(tx.hash()).toString("hex"),
        expires,
        now(),
      );
      return json({ id: paymentId });
    }
    if (action === "payment") {
      const a = await ensurePolicy(v);
      const current = await one<Payment>(
        "SELECT * FROM payments WHERE vault=? AND status in ('pending','submitting')",
        id,
      );
      if (current) {
        const status = await settle(current);
        if (status === "pending" || status === "submitting")
          fail("PAYMENT_PENDING");
      }
      const c = await one<Contact>(
        "SELECT * FROM contacts WHERE id=? AND vault=?",
        str(b, "contact", 60),
        id,
      );
      if (!c) fail("INVALID_INPUT");
      const amount = str(b, "amount", 25),
        code = str(b, "code", 12),
        issuer = str(b, "issuer", 56, true),
        note = str(b, "note", 160);
      if (!issuer && code !== "XLM") fail("INVALID_INPUT");
      if (issuer) addr(issuer);
      const rules = await networkRules();
      const balances = accountBalances(a, rules);
      const chosen = balances.find((balance) =>
        sameAsset(balance, { code, issuer }),
      );
      if (!chosen) fail("ASSET_UNAVAILABLE");
      if (!canSpend(chosen, amount)) fail("INSUFFICIENT_FUNDS");
      const native = balances.find((balance) => !balance.issuer);
      if (
        !native ||
        units(native.balance) <
          units(native.reserve) + units(native.liabilities) + rules.fee
      )
        fail("INSUFFICIENT_FUNDS");
      if (
        !a.balances.some((x) =>
          issuer
            ? x.asset_code === code && x.asset_issuer === issuer
            : x.asset_type === "native",
        )
      )
        fail("INVALID_INPUT");
      const dest = await account(c.address);
      if (
        issuer &&
        !dest.balances.some(
          (x) =>
            x.asset_code === code &&
            x.asset_issuer === issuer &&
            x.is_authorized !== false,
        )
      )
        fail("TRUSTLINE_REQUIRED");
      const expires = now() + 86400,
        xdr = paymentXdr(
          a,
          c.address,
          amount,
          code,
          issuer,
          c.memo,
          expires,
          rules.fee.toString(),
        );
      const hash = Buffer.from(decode(xdr).hash()).toString("hex");
      await run(
        "INSERT INTO payments(id,vault,contact,recipient,destination,memo,amount,code,issuer,note,proposer,xdr,hash,expires,status,created) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,'pending',?)",
        crypto.randomUUID(),
        id,
        c.id,
        c.name,
        c.address,
        c.memo,
        amount,
        code,
        issuer,
        note,
        me.address,
        xdr,
        hash,
        expires,
        now(),
      );
      return json({ ok: true });
    }
    if (action === "approve" || action === "retry") {
      const p = await one<Payment>(
        "SELECT * FROM payments WHERE id=? AND vault=?",
        str(b, "payment", 60),
        id,
      );
      if (!p) fail("INVALID_INPUT");
      if (p.status === "paid") return json({ ok: true });
      if (p.expires < now()) fail("PAYMENT_EXPIRED");
      if (!["pending", "submitting"].includes(p.status))
        fail("INVALID_TRANSACTION");
      await ensurePolicy(v);
      if (action === "approve") {
        const sig = signedBy(p.xdr, str(b, "signed", 40000), me.address);
        await run(
          "INSERT OR IGNORE INTO signatures(payment,address,signature,created) VALUES(?,?,?,?)",
          p.id,
          me.address,
          sig,
          now(),
        );
      }
      await broadcast(p, v);
      return json({ ok: true });
    }
    fail("INVALID_INPUT");
  } catch (e) {
    return error(e);
  }
}
