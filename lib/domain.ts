export type Person = { address: string; name: string; joined: number };
export type Vault = {
  id: string;
  name: string;
  owner: string;
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
  paidCount: number;
};
export type Payment = {
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
};
export type Balance = { code: string; issuer: string; balance: string };
export type State = {
  user: Person | null;
  vaults: Vault[];
  vault?: Vault;
  people: Person[];
  contacts: Contact[];
  payments: Payment[];
  balances: Balance[];
  chainError?: boolean;
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
