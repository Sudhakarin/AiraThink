import type { Metadata, Viewport } from "next";
import { Poppins, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "next-themes";

const poppins = Poppins({ subsets: ["latin"], variable: "--font-poppins", weight: ["400", "500", "600", "700"] });
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", weight: ["400", "500", "600"] });
const jbmono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jbmono", weight: ["400", "500"] });

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
  themeColor: "#0A0C12",
};

export const metadata: Metadata = {
  title: "Airalance — Where Privacy Matters!",
  description: "A premium, real-time chat experience. Fast, private, beautifully simple.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Airalance",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${poppins.variable} ${inter.variable} ${jbmono.variable}`} suppressHydrationWarning>
      <body style={{ backgroundColor: "#0A0C12" }}>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
