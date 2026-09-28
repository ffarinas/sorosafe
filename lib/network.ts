export type NetworkId = "mainnet" | "testnet";
export const NETWORKS = {
  mainnet: {
    id: "mainnet",
    label: "Stellar Mainnet",
    passphrase: "Public Global Stellar Network ; September 2015",
    horizon: "https://horizon.stellar.org",
    explorer: "https://stellar.expert/explorer/public",
  },
  testnet: {
    id: "testnet",
    label: "Stellar Testnet",
    passphrase: "Test SDF Network ; September 2015",
    horizon: "https://horizon-testnet.stellar.org",
    explorer: "https://stellar.expert/explorer/testnet",
  },
} as const;
export type NetworkConfig = (typeof NETWORKS)[NetworkId];
