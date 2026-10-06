import type { Metadata } from "next";
import "@fontsource-variable/inter";
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
        url: "/brand/sorosafe-og.png",
        width: 1200,
        height: 630,
        alt: "SoroSafe: shared control, simple by design",
      },
    ],
  },
  twitter: { card: "summary_large_image", images: ["/brand/sorosafe-og.png"] },
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico", sizes: "48x48" },
      {
        url: "/brand/sorosafe-icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
    ],
    shortcut: "/favicon.ico",
    apple: "/apple-touch-icon.png",
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
