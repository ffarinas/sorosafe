import type { Balance, Payment } from "./domain";

export type AssetIdentity = { code: string; issuer: string };
export const assetKey = (asset: AssetIdentity) =>
  `${asset.code}|${asset.issuer}`;
export const sameAsset = (a: AssetIdentity, b: AssetIdentity) =>
  a.code === b.code && a.issuer === b.issuer;
export const findAsset = (balances: Balance[], key: string) =>
  balances.find((asset) => assetKey(asset) === key);

// Stellar amounts have seven decimal places. Keep all spend checks exact.
const scale = BigInt(10000000);
export function units(amount: string) {
  if (!/^\d+(\.\d{1,7})?$/.test(amount)) throw new Error("INVALID_AMOUNT");
  const [whole, fraction = ""] = amount.split(".");
  return BigInt(whole) * scale + BigInt(fraction.padEnd(7, "0"));
}
export function decimal(amount: bigint) {
  const value = amount < BigInt(0) ? BigInt(0) : amount;
  return `${value / scale}.${(value % scale).toString().padStart(7, "0")}`;
}
export function canSpend(asset: Balance | undefined, amount: string) {
  if (!asset?.authorized) return false;
  try {
    return units(amount) > BigInt(0) && units(amount) <= units(asset.available);
  } catch {
    return false;
  }
}
export function pendingAmount(asset: AssetIdentity, payments: Payment[]) {
  return payments
    .filter(
      (p) =>
        ["pending", "submitting"].includes(p.status) && sameAsset(p, asset),
    )
    .reduce((sum, p) => sum + units(p.amount), BigInt(0));
}

// Product catalog, not account balances. Never match a token by ticker alone.
export const mainnetCatalog = [
  {
    code: "USDC",
    issuer: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
    issuerName: "Circle",
    source: "https://developers.circle.com/stablecoins/usdc-contract-addresses",
  },
  {
    code: "USDT0",
    issuer: "GATISXX6BZ6NC7IKQBY37CJD4SOZL3CYZJWXEDG6JVIY4WBS6KXJHN6Q",
    issuerName: "USDT0",
    source: "https://developers.stellar.org/launch/usdt0",
  },
] as const;
