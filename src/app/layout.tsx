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
import { VantageProvider } from "@ojflabs/vantage/react";
import { IconPreferenceProvider } from "@/components/icon-preference-provider";

const VANTAGE_PROJECT = process.env.NEXT_PUBLIC_VANTAGE_PROJECT ?? "";
const VANTAGE_WRITE_KEY = process.env.NEXT_PUBLIC_VANTAGE_WRITE_KEY ?? "";
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
      signInUrl="/auth/sign-in"
      signUpUrl="/auth/sign-up"
      signInFallbackRedirectUrl="/automations"
      signUpFallbackRedirectUrl="/automations"
      appearance={{
        baseTheme: shadcn,
        cssLayerName: "clerk",
      }}
    >
      <html lang="en" suppressHydrationWarning>
        <body className={`${dmSans.variable} font-sans antialiased`}>
          <ThemeProvider
            attribute="class"
            defaultTheme="dark"
            enableSystem
            disableTransitionOnChange
          >
            <IconPreferenceProvider>
              <Analytics />
              {VANTAGE_PROJECT && VANTAGE_WRITE_KEY ? (
                <VantageProvider
                  project={VANTAGE_PROJECT}
                  writeKey={VANTAGE_WRITE_KEY}
                  endpoint="https://vantage.ojflabs.com/api/events"
                />
              ) : null}
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
