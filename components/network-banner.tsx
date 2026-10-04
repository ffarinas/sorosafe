import type { NetworkConfig } from "@/lib/network";

/** Always visible on Testnet so nobody mistakes test funds for real money. */
export function NetworkBanner({
  chain,
  es,
}: {
  chain: NetworkConfig;
  es: boolean;
}) {
  if (chain.id !== "testnet") return null;
  return (
    <div className="network-banner" role="note" data-product-tour="app-network">
      <strong>Testnet</strong>
      <span>
        {es
          ? "Fondos de prueba sin valor real · Mainnet muy pronto"
          : "Test funds with no real value · Mainnet coming soon"}
      </span>
    </div>
  );
}
