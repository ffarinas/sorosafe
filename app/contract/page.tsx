"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ContractVault } from "@/components/contract-vault";
import { NETWORKS, type NetworkId } from "@/lib/network";
import { StrKey } from "@stellar/stellar-sdk";
export default function IndependentVault() {
  const [params, setParams] = useState<{
    address: string;
    network: NetworkId;
  }>();
  const [es, setEs] = useState(true);
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setEs(localStorage.getItem("junto-language") !== "en");
    } catch {
      /* Spanish stays the default. */
    }
    const q = new URLSearchParams(location.search),
      address = q.get("address") || "",
      network = q.get("network") || "mainnet";
    if (
      StrKey.isValidContract(address) &&
      (network === "mainnet" || network === "testnet")
    ) {
      // URL is the canonical on-chain vault identity; no SoroSafe session or DB lookup.
      setParams({ address, network });
    }
  }, []);
  if (!params)
    return (
      <main className="contract-main">
        <Link href="/" className="brand">
          sorosafe.
        </Link>
        <h1>{es ? "Abrir una bóveda" : "Open a vault"}</h1>
        <p className="muted">
          {es
            ? "Para abrir una bóveda directamente desde Stellar, sin iniciar sesión. Pega la dirección del contrato de la bóveda: empieza por C y aparece bajo su nombre. No es la dirección de tu wallet."
            : "Open a vault straight from Stellar, without signing in. Paste the vault's contract address: it starts with C and appears under the vault's name. It is not your wallet address."}
        </p>
        <form method="get">
          <label>
            {es ? "Dirección de la bóveda (C…)" : "Vault address (C…)"}
            <input
              name="address"
              required
              pattern="C[A-Z2-7]{55}"
              placeholder="C…"
            />
          </label>
          <label>
            {es ? "Red" : "Network"}
            <select name="network">
              <option value="testnet">Stellar Testnet</option>
              <option value="mainnet">Stellar Mainnet</option>
            </select>
          </label>
          <button className="primary">{es ? "Abrir" : "Open"}</button>
          <Link
            href="/"
            className="text-button"
            style={{ display: "block", marginTop: 20 }}
          >
            {es
              ? "¿Buscas tus bóvedas? Entra en SoroSafe"
              : "Looking for your vaults? Sign in to SoroSafe"}
          </Link>
        </form>
      </main>
    );
  return (
    <ContractVault address={params.address} chain={NETWORKS[params.network]} />
  );
}
