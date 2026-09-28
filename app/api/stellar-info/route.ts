import { authConfig, authError } from "@/lib/auth";
import { NETWORK } from "@/lib/stellar";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  try {
    const { origin, key } = authConfig(req);
    return new Response(
      `VERSION="2.0.0"\nNETWORK_PASSPHRASE="${NETWORK}"\nSIGNING_KEY="${key.publicKey()}"\nWEB_AUTH_ENDPOINT="${origin}/api/auth"\n`,
      {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (e) {
    return authError(e);
  }
}
