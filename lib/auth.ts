import { env } from "cloudflare:workers";
import { Buffer } from "node:buffer";
import { Keypair, WebAuth } from "@stellar/stellar-sdk";
import { account, NETWORK } from "./stellar";
import { db, digest, one, run, token } from "./store";

const now = () => Math.floor(Date.now() / 1000);
export function authConfig(req: Request) {
  if (!env.STELLAR_AUTH_SIGNING_SEED || !env.STELLAR_AUTH_ORIGIN)
    throw new Error("AUTH_UNAVAILABLE");
  const origin = new URL(env.STELLAR_AUTH_ORIGIN).origin;
  if (new URL(req.url).origin !== origin) throw new Error("INVALID_ORIGIN");
  return {
    origin,
    domain: new URL(origin).host,
    key: Keypair.fromSecret(env.STELLAR_AUTH_SIGNING_SEED),
  };
}
export function authResponse(value: unknown, status = 200, headers = {}) {
  return Response.json(value, {
    status,
    headers: { "Cache-Control": "no-store", ...headers },
  });
}
export function authError(e: unknown) {
  const message = e instanceof Error ? e.message : "INVALID_LOGIN";
  const known = [
    "AUTH_UNAVAILABLE",
    "INVALID_ORIGIN",
    "INVALID_INPUT",
    "INVALID_ADDRESS",
    "RATE_LIMITED",
    "EXPIRED_LOGIN",
    "NETWORK_UNAVAILABLE",
  ];
  const error = known.includes(message) ? message : "INVALID_LOGIN";
  return authResponse(
    { error },
    error === "AUTH_UNAVAILABLE"
      ? 503
      : error === "INVALID_ORIGIN"
        ? 403
        : error === "RATE_LIMITED"
          ? 429
          : 400,
  );
}
export async function challenge(req: Request, address: string) {
  const { key, domain } = authConfig(req);
  await run("DELETE FROM challenges WHERE expires<=?", now());
  const count = await one<{ n: number }>(
    "SELECT count(*) as n FROM challenges WHERE address=? AND expires>?",
    address,
    now(),
  );
  if ((count?.n || 0) >= 6) throw new Error("RATE_LIMITED");
  const transaction = WebAuth.buildChallengeTx(
    key,
    address,
    domain,
    300,
    NETWORK,
    domain,
  );
  const { tx } = WebAuth.readChallengeTx(
    transaction,
    key.publicKey(),
    NETWORK,
    domain,
    domain,
  );
  await run(
    "INSERT INTO challenges(id,address,xdr,expires) VALUES(?,?,?,?)",
    Buffer.from(tx.hash()).toString("hex"),
    address,
    transaction,
    Number(tx.timeBounds!.maxTime),
  );
  return authResponse({ transaction, network_passphrase: NETWORK });
}
export async function authenticate(
  req: Request,
  transaction: string,
  name?: string,
) {
  const { key, domain, origin } = authConfig(req);
  const { tx, clientAccountID: address } = WebAuth.readChallengeTx(
    transaction,
    key.publicKey(),
    NETWORK,
    domain,
    domain,
  );
  const id = Buffer.from(tx.hash()).toString("hex");
  const pending = await one<{ address: string; expires: number }>(
    "SELECT address,expires FROM challenges WHERE id=?",
    id,
  );
  if (!pending || pending.expires <= now() || pending.address !== address)
    throw new Error("EXPIRED_LOGIN");
  // Each Junto member is an individual signing key. Delegated account signers
  // cannot log in as another key, which would not authorize vault payments.
  WebAuth.verifyChallengeTxSigners(
    transaction,
    key.publicKey(),
    NETWORK,
    [address],
    domain,
    domain,
  );
  try {
    const a = await account(address);
    WebAuth.verifyChallengeTxThreshold(
      transaction,
      key.publicKey(),
      NETWORK,
      Math.max(1, a.thresholds.med_threshold),
      a.signers,
      domain,
      domain,
    );
  } catch (e) {
    if (!(e instanceof Error) || e.message !== "ACCOUNT_MISSING") throw e;
  }
  const issued = now(),
    expires = issued + 86400;
  const header = Buffer.from(
    JSON.stringify({ alg: "EdDSA", typ: "JWT", kid: key.publicKey() }),
  ).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({
      iss: origin,
      sub: address,
      iat: issued,
      exp: expires,
      jti: token(),
    }),
  ).toString("base64url");
  const message = `${header}.${payload}`;
  const session = `${message}.${Buffer.from(key.sign(Buffer.from(message))).toString("base64url")}`;
  const used = await run(
    "DELETE FROM challenges WHERE id=? AND expires>?",
    id,
    issued,
  );
  if (!used.meta.changes) throw new Error("EXPIRED_LOGIN");
  await db().batch([
    db()
      .prepare(
        "INSERT INTO people(address,name,joined) VALUES(?,?,?) ON CONFLICT(address) DO UPDATE SET name=CASE WHEN ? IS NOT NULL THEN excluded.name ELSE people.name END",
      )
      .bind(address, name || "Team member", issued, name || null),
    db()
      .prepare("INSERT INTO sessions(hash,address,expires) VALUES(?,?,?)")
      .bind(await digest(`${NETWORK}:${session}`), address, expires),
  ]);
  // Browser sessions remain HttpOnly. Native SEP-10 clients can use the JWT as
  // a Bearer token; the database hash provides expiry and immediate revocation.
  return authResponse(
    { token: session },
    200,
    req.headers.get("origin") === origin
      ? {
          "Set-Cookie": `junto_session=${session}; Path=/; HttpOnly; SameSite=Strict; Max-Age=86400${origin.startsWith("https:") ? "; Secure" : ""}`,
        }
      : {},
  );
}
