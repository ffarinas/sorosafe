import { env } from "cloudflare:workers";
import {
  contractAssets,
  createArgs,
  describeCall,
  prepareCall,
  readContract,
  server,
  submitContract,
  verifiedConfig,
  verifyCode,
  type ContractConfig,
  type FactoryConfig,
} from "@/lib/contracts";
import {
  StrKey,
  Keypair,
  Transaction,
  TransactionBuilder,
} from "@stellar/stellar-sdk";
import { Buffer } from "node:buffer";
import { all, db, digest, one, run, token } from "@/lib/store";
import { chain, NETWORK, signedBy } from "@/lib/stellar";
import type { Contact, Person, Vault, State } from "@/lib/domain";
import { assetCatalog, testnetFaucetContracts } from "@/lib/assets";
export const dynamic = "force-dynamic";
const now = () => Math.floor(Date.now() / 1000);
const vaultFields =
  "v.custody,v.network,v.id,v.name,v.owner,v.threshold,v.size,v.status,v.address,v.created";
type InternalVault = Vault & {
  setup: string | null;
  attempt: number;
  contract?: ContractConfig;
};
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
  // Vaults are Soroban contracts only. Rows left by the retired classic
  // multisig flow can never be opened again.
  if (v && v.custody !== "soroban") fail("UNVERIFIED_CONTRACT");
  if (v?.status === "active" && v.address) {
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
    testnetFaucetContracts(chain.id).includes(call.contract)
  );
}
/**
 * Pays the network fee of a user-signed call with a fee-bump. The sponsor
 * signs only the outer envelope: it cannot change the call or authorize
 * anything in a vault. Never throws; the reason tells the route whether the
 * sponsor may have paid:
 * - REJECTED: never accepted for a ledger (the sponsor paid nothing).
 * - FAILED: included in a ledger and failed (the sponsor paid the fee).
 * - UNCERTAIN: possibly accepted, no final result yet (it may still land).
 */
async function sponsorFeeBump(
  signed: string,
  sponsor: Keypair,
): Promise<{ hash: string } | { reason: "REJECTED" | "FAILED" | "UNCERTAIN" }> {
  let bump, s;
  try {
    const inner = TransactionBuilder.fromXDR(signed, chain.passphrase);
    if (!(inner instanceof Transaction)) return { reason: "REJECTED" };
    bump = TransactionBuilder.buildFeeBumpTransaction(
      sponsor,
      (BigInt(inner.fee) + BigInt(100)).toString(),
      inner,
      chain.passphrase,
    );
    bump.sign(sponsor);
    s = await server(chain);
  } catch {
    return { reason: "REJECTED" };
  }
  let sent;
  try {
    sent = await s.sendTransaction(bump);
  } catch {
    // The RPC may have received it before the connection failed.
    return { reason: "UNCERTAIN" };
  }
  // ERROR, TRY_AGAIN_LATER and DUPLICATE: this envelope was not accepted.
  if (sent.status !== "PENDING") return { reason: "REJECTED" };
  for (let n = 0; n < 15; n++) {
    const result = await s.getTransaction(sent.hash).catch(() => null);
    if (result?.status === "SUCCESS") return { hash: sent.hash };
    if (result?.status === "FAILED") return { reason: "FAILED" };
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
  return { reason: "UNCERTAIN" };
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
    "INVALID_TRANSACTION",
    "CHANGED_TRANSACTION",
    "INVALID_SIGNATURE",
    "NETWORK_UNAVAILABLE",
    "NOT_MEMBER",
    "SIGN_IN_REQUIRED",
    "EXPIRED_LOGIN",
    "POLICY_CHANGED",
    "NETWORK_MISMATCH",
    "SUBMISSION_UNCERTAIN",
    "INVITE_CLOSED",
    "NOT_OWNER",
    "TEAM_INCOMPLETE",
    "CONTACT_EXISTS",
    "INVALID_ORIGIN",
    "STORAGE_UNAVAILABLE",
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
            `SELECT v.id FROM vaults v JOIN members m ON v.id=m.vault WHERE m.address=? AND v.network=? AND v.custody='soroban' ORDER BY v.created DESC`,
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
      `SELECT ${vaultFields} FROM vaults v JOIN members m ON v.id=m.vault WHERE m.address=? AND v.network=? AND v.custody='soroban' ORDER BY v.created DESC`,
      me.address,
      chain.id,
    );
    if (!v) return json(state);
    const people = await team(id);
    state.people = people;
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
    if (v.address && v.status !== "draft") {
      try {
        const c =
          v.contract ??
          (await verifiedConfig(chain, v.address, env.JUNTO_FACTORY));
        // A contract deployed outside the agreed draft never activates it.
        if (v.status !== "active" && !matchesTeam(c.rules, v.threshold, people))
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
      // Gas sponsorship is a perk, never a dependency. Every outcome other than
      // { sponsored: true } answers 200 with a reason, and the client then
      // submits the same signed transaction paying the fee itself. That is
      // always safe: the inner transaction has one sequence number, so at most
      // one of the two submissions can ever execute.
      const no = (reason: string) => json({ sponsored: false, reason });
      if (!env.SPONSOR_SECRET) return no("OFF");
      const signed = typeof b.signed === "string" ? b.signed : "";
      if (!signed || signed.length > 40000) return no("NOT_ELIGIBLE");
      let call: ReturnType<typeof describeCall>;
      try {
        call = describeCall(signed, chain);
      } catch {
        return no("NOT_ELIGIBLE");
      }
      if (call.source !== me.address || call.fee > SPONSOR_MAX_FEE)
        return no("NOT_ELIGIBLE");
      if (!(await sponsorable(call))) return no("NOT_ELIGIBLE");
      let key: Keypair;
      try {
        key = Keypair.fromSecret(env.SPONSOR_SECRET);
      } catch {
        return no("OFF");
      }
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
        sponsor?.balances?.find((x) => x.asset_type === "native")?.balance ?? 0,
      );
      if (xlm < SPONSOR_MIN_BALANCE) return no("EMPTY");
      const day = Math.floor(now() / 86400);
      // Reserve one of today's sponsored transactions before submitting, so
      // parallel requests cannot exceed the limit.
      const counted = await run(
        "INSERT INTO sponsorships(address,day,count) VALUES(?,?,1) ON CONFLICT(address,day) DO UPDATE SET count=sponsorships.count+1 WHERE sponsorships.count<?",
        me.address,
        day,
        SPONSOR_DAILY_LIMIT,
      ).catch(() => null);
      if (!counted) return no("UNAVAILABLE");
      if (!counted.meta.changes) return no("LIMIT");
      const outcome = await sponsorFeeBump(signed, key);
      if ("hash" in outcome)
        return json({ sponsored: true, hash: outcome.hash });
      // Nothing reached the ledger, so the sponsor paid nothing: give the
      // reservation back. A fee-bump that failed on the ledger or may still
      // land was paid for (or may be) and keeps counting.
      if (outcome.reason === "REJECTED")
        await run(
          "UPDATE sponsorships SET count=count-1 WHERE address=? AND day=? AND count>0",
          me.address,
          day,
        ).catch(() => null);
      return no(outcome.reason);
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
      // Any team of 1 to 20 signers; any threshold from 1 up to the team size.
      const size = integer(b, "size", 1, 20),
        threshold = integer(b, "threshold", 1, size);
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
      // A team of one has nobody to invite (1-of-1 activates directly).
      if (v.size < 2) fail("CONFIGURATION_REQUIRED");
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
    if (action === "prepareVault") {
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
    if (action === "discardActivation") {
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
    if (action === "activate") {
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
    if (action === "contact") {
      const name = str(b, "name", 80),
        address = addr(str(b, "address", 56)),
        memo = str(b, "memo", 80, true);
      // Contract payments carry no memo.
      if (memo) fail("CONTRACT_MEMO_UNSUPPORTED");
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
    fail("INVALID_INPUT");
  } catch (e) {
    return error(e);
  }
}
