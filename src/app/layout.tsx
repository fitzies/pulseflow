import type { Metadata } from "next";
import { DM_Sans } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { shadcn } from "@clerk/themes";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import HomeNavWrapper from "@/components/home-nav-wrapper";
import HomeNav from "@/components/home-nav";
import { Analytics } from "@vercel/analytics/next";
import { IconPreferenceProvider } from "@/components/icon-preference-provider";
// Code rabbit

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Pulseflow",
  description: "Pulsechain automation manager",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider
      appearance={{
        baseTheme: shadcn,
        cssLayerName: "clerk",
      }}
    >
      <html lang="en" suppressHydrationWarning>
        <body
          className={`${dmSans.variable} font-sans antialiased`}
        >
          <ThemeProvider
            attribute="class"
            defaultTheme="dark"
            enableSystem
            disableTransitionOnChange
          >
            <IconPreferenceProvider>
              <Analytics />
              <HomeNavWrapper>
                <HomeNav />
              </HomeNavWrapper>
              <Toaster />
              {children}
            </IconPreferenceProvider>
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
