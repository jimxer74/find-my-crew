import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import { defaultLocale } from '@/i18n/config';
import { logger } from '@shared/logging';
import "./globals.css";
import { AuthProvider } from "./contexts/AuthContext";
import { FilterProvider } from "./contexts/FilterContext";
import { NotificationProvider } from "./contexts/NotificationContext";
import { ConsentSetupProvider } from "./contexts/ConsentSetupContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import { AssistantProvider } from "./contexts/AssistantContext";
import { CookieConsentBanner } from "./components/CookieConsentBanner";
import { Header } from "./components/Header";
import { ThemeScript } from "./components/ThemeScript";
import { AssistantSidebar } from "./components/ai/AssistantSidebar";
import { UserRolesProvider } from "./contexts/UserRoleContext";
import { EmailVerificationBanner } from "./components/EmailVerificationBanner";
import { MainContent } from "./components/MainContent";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SailSmart - Connect Boat Owners with Crew Members",
  description: "Connect boat owners and skippers with potential crew members. Find your perfect crew or discover amazing sailing opportunities.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  let messages;
  
  try {
    messages = await getMessages();
  } catch (error) {
    logger.error('[RootLayout] Failed to load messages for locale:', { locale, error: error instanceof Error ? error.message : String(error) });
    // Last resort: empty object to prevent context error
    messages = {};
  }

  // Ensure messages is always an object (never null/undefined)
  if (!messages || typeof messages !== 'object') {
    logger.warn('[RootLayout] Messages is invalid, using empty object');
    messages = {};
  }

  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <NextIntlClientProvider messages={messages}>
          <ThemeProvider>
            <AuthProvider>
              <UserRolesProvider>
              <ConsentSetupProvider>
                <FilterProvider>
                  <NotificationProvider>
                    <AssistantProvider>
                      <Header />
                      <MainContent>
                        <EmailVerificationBanner />
                        {children}
                      </MainContent>
                      <AssistantSidebar />
                    </AssistantProvider>
                  </NotificationProvider>
                </FilterProvider>
                <CookieConsentBanner />
              </ConsentSetupProvider>
              </UserRolesProvider>
            </AuthProvider>
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
