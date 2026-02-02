import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
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

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Find My Crew - Connect Boat Owners with Crew Members",
  description: "Connect boat owners and skippers with potential crew members. Find your perfect crew or discover amazing sailing opportunities.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const messages = await getMessages();

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
                      <div className="min-h-screen pt-16">
                        {children}
                      </div>
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
