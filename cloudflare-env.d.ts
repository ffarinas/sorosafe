declare namespace Cloudflare {
  interface Env {
    JUNTO_NETWORK?: "mainnet" | "testnet";
    DB?: D1Database;
    BUCKET?: R2Bucket;
    STELLAR_AUTH_SIGNING_SEED?: string;
    STELLAR_AUTH_ORIGIN?: string;
  }
}
