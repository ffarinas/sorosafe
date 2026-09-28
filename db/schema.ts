import {
  sqliteTable,
  text,
  integer,
  primaryKey,
  uniqueIndex,
  index,
} from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
export const people = sqliteTable("people", {
  address: text("address").primaryKey(),
  name: text("name").notNull(),
  joined: integer("joined").notNull(),
});
export const challenges = sqliteTable("challenges", {
  id: text("id").primaryKey(),
  address: text("address").notNull(),
  xdr: text("xdr").notNull(),
  expires: integer("expires").notNull(),
});
export const sessions = sqliteTable("sessions", {
  hash: text("hash").primaryKey(),
  address: text("address").notNull(),
  expires: integer("expires").notNull(),
});
export const vaults = sqliteTable("vaults", {
  network: text("network").notNull().default("testnet"),
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  owner: text("owner").notNull(),
  threshold: integer("threshold").notNull(),
  size: integer("size").notNull(),
  status: text("status").notNull().default("draft"),
  address: text("address"),
  setup: text("setup"),
  inviteHash: text("invite_hash"),
  created: integer("created").notNull(),
});
export const members = sqliteTable(
  "members",
  {
    vault: text("vault")
      .notNull()
      .references(() => vaults.id),
    address: text("address")
      .notNull()
      .references(() => people.address),
  },
  (t) => [
    primaryKey({ columns: [t.vault, t.address] }),
    index("members_by_address").on(t.address),
  ],
);
export const contacts = sqliteTable(
  "contacts",
  {
    id: text("id").primaryKey(),
    vault: text("vault")
      .notNull()
      .references(() => vaults.id),
    name: text("name").notNull(),
    address: text("address").notNull(),
    memo: text("memo").notNull().default(""),
    createdBy: text("created_by").notNull(),
    created: integer("created").notNull(),
  },
  (t) => [uniqueIndex("contacts_destination").on(t.vault, t.address, t.memo)],
);
export const payments = sqliteTable(
  "payments",
  {
    kind: text("kind").notNull().default("payment"),
    id: text("id").primaryKey(),
    vault: text("vault")
      .notNull()
      .references(() => vaults.id),
    contact: text("contact").notNull(),
    recipient: text("recipient").notNull(),
    destination: text("destination").notNull(),
    memo: text("memo").notNull(),
    amount: text("amount").notNull(),
    code: text("code").notNull(),
    issuer: text("issuer").notNull(),
    note: text("note").notNull(),
    proposer: text("proposer").notNull(),
    xdr: text("xdr").notNull(),
    hash: text("hash").notNull(),
    expires: integer("expires").notNull(),
    status: text("status").notNull(),
    created: integer("created").notNull(),
  },
  (t) => [
    uniqueIndex("payments_hash").on(t.hash),
    index("payments_by_vault").on(t.vault, t.created),
    uniqueIndex("one_active_payment")
      .on(t.vault)
      .where(sql`${t.status} in ('pending','submitting')`),
  ],
);
export const signatures = sqliteTable(
  "signatures",
  {
    payment: text("payment")
      .notNull()
      .references(() => payments.id),
    address: text("address").notNull(),
    signature: text("signature").notNull(),
    created: integer("created").notNull(),
  },
  (t) => [primaryKey({ columns: [t.payment, t.address] })],
);
