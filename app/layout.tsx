import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Workflow Studio — Interactive Architecture & Spec Canvas",
  description:
    "Local Node-and-Arrow Workflow Canvas with two-way disk persistence (boards/*/graph.json & content/*.md) and single-file SPECS.md AI compilation.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased bg-slate-950 text-slate-100">{children}</body>
    </html>
  );
}
