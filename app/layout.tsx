import type { Metadata } from "next";
import "@fontsource-variable/inter";
import "@fontsource-variable/lora";
import "./globals.css";

export const metadata: Metadata = {
  title: "Junto · Shared vaults on Stellar",
  description:
    "Share a vault, keep contacts together, and approve payments as a team. Stellar.",
  other: {
    "codex-preview": "development",
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
