import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Quantium Labs",
  description: "Financial Analytics & Market Intelligence Platform",
  icons: {
    icon: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}