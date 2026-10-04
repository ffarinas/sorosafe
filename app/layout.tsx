import type { Metadata } from "next";
import "@fontsource-variable/inter";
import "@fontsource-variable/lora";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://testnet.sorosafe.app"),
  title: "SoroSafe | Multisig for your team. Built on Stellar.",
  description:
    "A multisig smart contract wallet on Stellar. Choose your signers and approval rule, share contacts, and manage your team's money together.",
  openGraph: {
    title: "SoroSafe | Multisig. For your team.",
    description:
      "One vault, shared control. Multisig smart contracts built on Stellar, with your team's signers and approval rules.",
    type: "website",
    images: [
      {
        url: "/brand/shared-control.webp",
        width: 1448,
        height: 1086,
        alt: "SoroSafe: multisig vaults on Stellar",
      },
    ],
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className="antialiased">{children}</body>
    </html>
  );
}
