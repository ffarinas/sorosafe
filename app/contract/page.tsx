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
  useEffect(() => {
    const q = new URLSearchParams(location.search),
      address = q.get("address") || "",
      network = q.get("network") || "mainnet";
    if (
      StrKey.isValidContract(address) &&
      (network === "mainnet" || network === "testnet")
    ) {
      // URL is the canonical on-chain vault identity; no Junto session or DB lookup.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setParams({ address, network });
    }
  }, []);
  if (!params)
    return (
      <main className="contract-main">
        <Link href="/" className="brand">
          junto.
        </Link>
        <h1>Abrir bóveda / Open vault</h1>
        <form method="get">
          <label>
            Dirección / Address
            <input name="address" required pattern="C[A-Z2-7]{55}" />
          </label>
          <label>
            Red / Network
            <select name="network">
              <option value="mainnet">Stellar Mainnet</option>
              <option value="testnet">Stellar Testnet</option>
            </select>
          </label>
          <button className="primary">Abrir / Open</button>
        </form>
      </main>
    );
  return (
    <ContractVault address={params.address} chain={NETWORKS[params.network]} />
  );
}
