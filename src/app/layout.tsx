import type { Metadata } from "next";
import { JetBrains_Mono, Jost, Source_Serif_4 } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { TooltipProvider } from "@/components/ui/tooltip";

const sourceSerif = Source_Serif_4({
  variable: "--font-source-serif",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  display: "swap",
});

// Jost — open-source Futura-alike, used as the cockpit overhead-panel
// typeface. See cockpit-ui §2d.
const jost = Jost({
  variable: "--font-jost",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Crosscheck — Decision-based A320 abnormal training",
  description:
    "Crosscheck is interactive, real-time training for airline pilots. Run abnormal procedures end-to-end, get scored on correctness, sequence, and decision quality, and receive an AI debrief.",
  metadataBase: new URL("https://crosscheck.vercel.app"),
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${sourceSerif.variable} ${jetbrainsMono.variable} ${jost.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Providers>
          <TooltipProvider>{children}</TooltipProvider>
        </Providers>
      </body>
    </html>
  );
}
