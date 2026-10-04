declare namespace Cloudflare {
  interface Env {
    JUNTO_NETWORK?: "mainnet" | "testnet";
    JUNTO_FACTORY?: string;
    DB?: D1Database;
    BUCKET?: R2Bucket;
    STELLAR_AUTH_SIGNING_SEED?: string;
    STELLAR_AUTH_ORIGIN?: string;
    /** Hot account that pays network fees by fee-bump. Holds only XLM. */
    SPONSOR_SECRET?: string;
  }
}
