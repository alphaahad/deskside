import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import "./globals.css";
import { TopBar } from "@/components/TopBar";

const plexSans = IBM_Plex_Sans({ variable: "--font-plex-sans", subsets: ["latin"], weight: ["400", "500", "600", "700"] });
const plexMono = IBM_Plex_Mono({ variable: "--font-plex-mono", subsets: ["latin"], weight: ["400", "500"] });

export const metadata: Metadata = {
  title: "Nod · your AP employee asks, you decide",
  description: "A control room where a finance lead asks their AI accounts-payable employee why things are on hold, and decides right in the chat. All data is mock data.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${plexSans.variable} ${plexMono.variable} h-full antialiased`}>
      <body className="h-full flex flex-col">
        <TopBar />
        <main className="flex-1 min-h-0">{children}</main>
      </body>
    </html>
  );
}
