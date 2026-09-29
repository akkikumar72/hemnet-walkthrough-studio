import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Walkthrough Studio | A better feel for home",
  description:
    "See how the rooms connect before the viewing. Explore the Noaks väg 3B walkthrough, watch the film, or start with your own Hemnet listing.",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
