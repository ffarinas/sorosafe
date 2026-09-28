import { env } from "cloudflare:workers";
export function db() {
  if (!env.DB) throw new Error("STORAGE_UNAVAILABLE");
  return env.DB;
}
export async function one<T>(sql: string, ...args: (string | number | null)[]) {
  return db()
    .prepare(sql)
    .bind(...args)
    .first<T>();
}
export async function all<T>(sql: string, ...args: (string | number | null)[]) {
  return (
    await db()
      .prepare(sql)
      .bind(...args)
      .all<T>()
  ).results;
}
export async function run(sql: string, ...args: (string | number | null)[]) {
  return db()
    .prepare(sql)
    .bind(...args)
    .run();
}
export async function digest(value: string) {
  const bytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(bytes), (x) =>
    x.toString(16).padStart(2, "0"),
  ).join("");
}
export function token() {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), (x) =>
    x.toString(16).padStart(2, "0"),
  ).join("");
}
