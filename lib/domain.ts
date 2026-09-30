export type Person = { address: string; name: string; joined: number };
export type Activation = {
  kind?: "soroban";
  factory?: string;
  salt?: string;
  feeBps?: number;
  collector?: string;
  xdr: string;
  address: string;
  funding: string;
  fee: string;
  expires: number;
};
export type Vault = {
  custody: "classic" | "soroban";
  network: "mainnet" | "testnet";
  id: string;
  name: string;
  owner: string;
  // Both are 0 only for a newly created, unconfigured draft.
  threshold: number;
  size: number;
  status: "draft" | "activating" | "active";
  address: string | null;
  created: number;
};
export type Contact = {
  id: string;
  name: string;
  address: string;
  memo: string;
  createdBy: string;
  creatorName: string;
  created: number;
  paidCount: number | null;
};
export type Payment = {
  kind: "payment" | "enable";
  reserve?: string;
  id: string;
  vault: string;
  contact: string;
  recipient: string;
  destination: string;
  memo: string;
  amount: string;
  code: string;
  issuer: string;
  note: string;
  proposer: string;
  proposerName: string;
  xdr: string;
  hash: string;
  expires: number;
  status: "pending" | "submitting" | "paid" | "expired" | "failed";
  created: number;
  approvals: { address: string; name: string }[];
  fee: string;
};
export type Balance = {
  code: string;
  issuer: string;
  balance: string;
  available: string;
  reserve: string;
  liabilities: string;
  pending: string;
  authorized: boolean;
};
export type State = {
  factory?: string;
  network?: import("./network").NetworkConfig;
  catalog?: import("./assets").CatalogAsset[];
  baseReserve?: string;
  user: Person | null;
  vaults: Vault[];
  vault?: Vault;
  people: Person[];
  contacts: Contact[];
  payments: Payment[];
  balances: Balance[];
  paymentFee?: string;
  chainError?: boolean;
  /** The contract at the activating address has rules the team did not agree on. */
  policyMismatch?: boolean;
  invite?: {
    name: string;
    threshold: number;
    size: number;
    count: number;
    status: string;
  };
};
export const SHORT = (v: string) =>
  v.length > 18 ? `${v.slice(0, 7)}…${v.slice(-7)}` : v;
