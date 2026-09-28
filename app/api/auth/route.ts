import { StrKey } from "@stellar/stellar-sdk";
import { authenticate, authConfig, authError, challenge } from "@/lib/auth";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  try {
    const url = new URL(req.url),
      { domain } = authConfig(req);
    const address = url.searchParams.get("account") || "";
    if (!StrKey.isValidEd25519PublicKey(address))
      throw new Error("INVALID_ADDRESS");
    if (
      (url.searchParams.has("home_domain") &&
        url.searchParams.get("home_domain") !== domain) ||
      url.searchParams.has("memo") ||
      url.searchParams.has("client_domain")
    )
      throw new Error("INVALID_INPUT");
    return await challenge(req, address);
  } catch (e) {
    return authError(e);
  }
}
export async function POST(req: Request) {
  try {
    const { origin } = authConfig(req);
    const caller = req.headers.get("origin");
    if (caller && caller !== origin) throw new Error("INVALID_ORIGIN");
    if (Number(req.headers.get("content-length") || 0) > 60000)
      throw new Error("INVALID_INPUT");
    const raw = await req.text();
    if (raw.length > 60000) throw new Error("INVALID_INPUT");
    const b = req.headers
      .get("content-type")
      ?.startsWith("application/x-www-form-urlencoded")
      ? Object.fromEntries(new URLSearchParams(raw))
      : JSON.parse(raw);
    if (
      typeof b.transaction !== "string" ||
      !b.transaction ||
      b.transaction.length > 40000 ||
      (b.name !== undefined &&
        (typeof b.name !== "string" || !b.name.trim() || b.name.length > 60))
    )
      throw new Error("INVALID_INPUT");
    return await authenticate(req, b.transaction, b.name?.trim());
  } catch (e) {
    return authError(e);
  }
}
