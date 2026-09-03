import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Profile Roast",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
      >
        {children}
      </body>
    </html>
  );
}
