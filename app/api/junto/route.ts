import {
  Account,
  Operation,
  StrKey,
  TransactionBuilder,
} from "@stellar/stellar-sdk";
import { Buffer } from "node:buffer";
import { all, db, digest, one, run, token } from "@/lib/store";
import {
  account,
  checkPolicy,
  combine,
  decode,
  NETWORK,
  paymentXdr,
  receipt,
  setupXdr,
  signedBy,
  submit,
} from "@/lib/stellar";
import type { Contact, Payment, Person, Vault, State } from "@/lib/domain";
export const dynamic = "force-dynamic";
const now = () => Math.floor(Date.now() / 1000);
const vaultFields =
  "v.id,v.name,v.owner,v.threshold,v.size,v.status,v.address,v.created";
type InternalVault = Vault & { setup: string | null };
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
  const raw = req.headers
    .get("cookie")
    ?.split(";")
    .map((x) => x.trim())
    .find((x) => x.startsWith("junto_session="))
    ?.split("=")[1];
  if (!raw) return null;
  return one<Person>(
    "SELECT p.* FROM people p JOIN sessions s ON p.address=s.address WHERE s.hash=? AND s.expires>?",
    await digest(raw),
    now(),
  );
}
async function membership(id: string, address: string) {
  const v = await one<InternalVault>(
    "SELECT v.* FROM vaults v JOIN members m ON v.id=m.vault WHERE v.id=? AND m.address=?",
    id,
    address,
  );
  if (!v) fail("NOT_MEMBER");
  return v;
}
async function team(vault: string) {
  return all<Person>(
    "SELECT p.* FROM people p JOIN members m ON p.address=m.address WHERE m.vault=? ORDER BY p.joined,p.address",
    vault,
  );
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
  const msg = e instanceof Error ? e.message : "UNKNOWN";
  const known = [
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
  ];
  const code = known.includes(msg) ? msg : "UNAVAILABLE";
  if (code === "UNAVAILABLE")
    console.error("junto_api_error", msg.slice(0, 180));
  return json(
    { error: code },
    ["SIGN_IN_REQUIRED", "EXPIRED_LOGIN"].includes(code)
      ? 401
      : ["NOT_MEMBER", "NOT_OWNER", "INVALID_ORIGIN"].includes(code)
        ? 403
        : 400,
  );
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
        "SELECT v.name,v.threshold,v.size,v.status,(SELECT count(*) FROM members m WHERE m.vault=v.id) as count FROM vaults v WHERE invite_hash=?",
        await digest(url.searchParams.get("invite") || ""),
      );
      if (!inv) fail("INVITE_CLOSED");
      return json({ invite: inv });
    }
    const state: State = {
      user: me,
      vaults: [],
      people: [],
      contacts: [],
      payments: [],
      balances: [],
    };
    if (!me) return json(state);
    state.vaults = await all<Vault>(
      `SELECT ${vaultFields} FROM vaults v JOIN members m ON v.id=m.vault WHERE m.address=? ORDER BY v.created DESC`,
      me.address,
    );
    const id = url.searchParams.get("vault") || state.vaults[0]?.id;
    if (!id) return json(state);
    const v = await membership(id, me.address);
    const people = await team(id);
    state.people = people;
    if (v.status === "activating" && v.address) {
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
      id: v.id,
      name: v.name,
      owner: v.owner,
      threshold: v.threshold,
      size: v.size,
      status: v.status,
      address: v.address,
      created: v.created,
    };
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
    for (const p of state.payments)
      p.approvals = signatures
        .filter((s) => s.payment === p.id)
        .map((s) => ({ address: s.address, name: s.name }));
    if (v.status === "active" && v.address) {
      try {
        const a = await account(v.address);
        state.balances = a.balances
          .filter((b) => b.asset_type === "native" || b.asset_code)
          .map((b) => ({
            code: b.asset_code || "XLM",
            issuer: b.asset_issuer || "",
            balance: b.balance,
          }));
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
    if (action === "challenge") {
      const address = addr(str(b, "address", 56));
      const count = await one<{ n: number }>(
        "SELECT count(*) as n FROM challenges WHERE address=? AND expires>?",
        address,
        now(),
      );
      if ((count?.n || 0) > 5) fail("RATE_LIMITED");
      const id = token(),
        expires = now() + 300;
      const xdr = new TransactionBuilder(new Account(address, "-1"), {
        fee: "100",
        networkPassphrase: NETWORK,
        timebounds: { minTime: now() - 1, maxTime: expires },
      })
        .addOperation(
          Operation.manageData({
            name: `Junto login ${new URL(req.url).hostname}`.slice(0, 64),
            value: Buffer.from(id, "hex"),
          }),
        )
        .build()
        .toXDR();
      await run(
        "INSERT INTO challenges(id,address,xdr,expires) VALUES(?,?,?,?)",
        id,
        address,
        xdr,
        expires,
      );
      return json({ id, xdr });
    }
    if (action === "login") {
      const id = str(b, "id", 64),
        name = str(b, "name", 60),
        signed = str(b, "signed", 40000);
      const c = await one<{ address: string; xdr: string; expires: number }>(
        "SELECT * FROM challenges WHERE id=?",
        id,
      );
      if (!c || c.expires < now()) fail("EXPIRED_LOGIN");
      signedBy(c.xdr, signed, c.address);
      const used = await run(
        "DELETE FROM challenges WHERE id=? AND expires>?",
        id,
        now(),
      );
      if (!used.meta.changes) fail("EXPIRED_LOGIN");
      const session = token();
      await db().batch([
        db()
          .prepare(
            "INSERT INTO people(address,name,joined) VALUES(?,?,?) ON CONFLICT(address) DO UPDATE SET name=excluded.name",
          )
          .bind(c.address, name, now()),
        db()
          .prepare("INSERT INTO sessions(hash,address,expires) VALUES(?,?,?)")
          .bind(await digest(session), c.address, now() + 86400),
      ]);
      return json({ ok: true }, 200, {
        "Set-Cookie": `junto_session=${session}; Path=/; HttpOnly; SameSite=Strict; Max-Age=86400${req.url.startsWith("https:") ? "; Secure" : ""}`,
      });
    }
    const me = await user(req);
    if (!me) fail("SIGN_IN_REQUIRED");
    if (action === "logout") {
      const cookie = req.headers
        .get("cookie")
        ?.match(/junto_session=([^;]+)/)?.[1];
      if (cookie)
        await run("DELETE FROM sessions WHERE hash=?", await digest(cookie));
      return json({ ok: true }, 200, {
        "Set-Cookie":
          "junto_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0",
      });
    }
    if (action === "create") {
      const name = str(b, "name", 80),
        threshold = integer(b, "threshold", 2, 20),
        size = integer(b, "size", 2, 20);
      if (threshold > size) fail("INVALID_RULE");
      const owned = await one<{ n: number }>(
        "SELECT count(*) as n FROM vaults WHERE owner=?",
        me.address,
      );
      if ((owned?.n || 0) >= 30) fail("RATE_LIMITED");
      const id = crypto.randomUUID(),
        invite = token();
      await db().batch([
        db()
          .prepare(
            "INSERT INTO vaults(id,name,owner,threshold,size,invite_hash,created) VALUES(?,?,?,?,?,?,?)",
          )
          .bind(
            id,
            name,
            me.address,
            threshold,
            size,
            await digest(invite),
            now(),
          ),
        db()
          .prepare("INSERT INTO members(vault,address) VALUES(?,?)")
          .bind(id, me.address),
      ]);
      return json({ id, invite });
    }
    if (action === "join") {
      const invite = await digest(str(b, "invite", 64));
      const v = await one<Vault>(
        "SELECT * FROM vaults WHERE invite_hash=?",
        invite,
      );
      if (!v || v.status !== "draft") fail("INVITE_CLOSED");
      await run(
        "INSERT OR IGNORE INTO members(vault,address) SELECT id,? FROM vaults WHERE id=? AND status='draft' AND (SELECT count(*) FROM members WHERE vault=?)<size",
        me.address,
        v.id,
        v.id,
      );
      await membership(v.id, me.address);
      return json({ id: v.id });
    }
    const id = str(b, "vault", 60),
      v = await membership(id, me.address);
    if (action === "invite") {
      if (v.owner !== me.address) fail("NOT_OWNER");
      if (v.status !== "draft") fail("INVITE_CLOSED");
      const invite = token();
      await run(
        "UPDATE vaults SET invite_hash=? WHERE id=?",
        await digest(invite),
        id,
      );
      return json({ invite });
    }
    if (action === "prepareActivation") {
      if (v.owner !== me.address) fail("NOT_OWNER");
      if (v.status !== "draft") fail("ALREADY_ACTIVE");
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
      const result = await run(
        "UPDATE vaults SET address=?,setup=?,status='activating',invite_hash=NULL WHERE id=? AND status='draft'",
        address,
        xdr,
        id,
      );
      if (!result.meta.changes) fail("ALREADY_ACTIVE");
      return json({ xdr });
    }
    if (action === "activate") {
      if (v.owner !== me.address) fail("NOT_OWNER");
      if (v.status !== "activating" || !v.setup || !v.address)
        fail("INVALID_TRANSACTION");
      const signed = str(b, "signed", 40000);
      signedBy(v.setup, signed, v.address);
      const setup = decode(v.setup);
      const found = await receipt(Buffer.from(setup.hash()).toString("hex"));
      if (!found) await submit(signed);
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
        xdr = paymentXdr(a, c.address, amount, code, issuer, c.memo, expires);
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
