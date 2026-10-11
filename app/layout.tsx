import type { Metadata } from "next";
import "@fontsource-variable/inter";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://testnet.sorosafe.app"),
  title: "SoroSafe | Multisig for your team. Built on Stellar.",
  description:
    "A multisig vault for teams on Stellar. Share contacts and payment requests, review every payment, and approve together under rules enforced by a Soroban contract.",
  openGraph: {
    title: "SoroSafe | Multisig. For your team.",
    description:
      "Shared contacts, clear payment requests and team approvals. A multisig vault on Stellar with rules enforced by a Soroban contract.",
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
