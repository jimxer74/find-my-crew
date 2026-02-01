---
id: TASK-011
title: Internationalization
status: In Progress
assignee: []
created_date: '2026-01-23 17:14'
updated_date: '2026-02-01 12:20'
labels:
  - i18n
  - infrastructure
  - ux
  - global
dependencies: []
references:
  - app/layout.tsx
  - app/page.tsx
  - app/lib/dateFormat.ts
  - middleware.ts
  - next.config.ts
  - app/auth/login/page.tsx
  - app/components/Header.tsx
priority: medium
ordinal: 6000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement internationalization (i18n) to support multiple languages in the application. This enables users from different regions to use the app in their preferred language.

## Problem Statement
Currently, all UI text is hardcoded in English:
- 150+ UI strings across pages and components
- Date formatting locked to en-US locale
- No language preference storage
- Email notifications only in English
- No locale detection or routing

## Solution Overview
Implement a comprehensive i18n system using `next-intl` that supports:
- Multiple languages (starting with English, Finnish)
- Locale-aware routing (`/en/`, `/fi/`)
- User language preference persistence
- Automatic browser language detection
- Localized date/time/number formatting
- Translated email notifications

## Target Languages (Phase 1)
1. **English (en)** - Default, current content
2. **Finnish (fi)** - Strong sailing culture in Baltics and this would be possible area to pilot

## Content Categories
- **UI Strings** - Buttons, labels, navigation, forms, errors
- **System Messages** - Notifications, emails, validation
- **Metadata** - Page titles, descriptions, SEO
- **Dynamic Content** - User-generated content remains in original language
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 App supports locale-based routing (/en/, /fi/)
- [ ] #2 All UI strings are externalized to translation files (no hardcoded text)
- [x] #3 Users can select their preferred language from a language switcher
- [x] #4 Language preference persists in localStorage and user profile (when logged in)
- [x] #5 New visitors see app in their browser's preferred language (Accept-Language detection)
- [x] #6 Dates and times display in locale-appropriate format
- [ ] #7 Numbers and measurements display with locale-appropriate formatting
- [ ] #8 Email notifications are sent in the user's preferred language
- [ ] #9 Page metadata (titles, descriptions) are translated for SEO
- [x] #10 Fallback to English when translation is missing
- [x] #11 Language switcher is accessible from header/navigation on all pages
- [ ] #12 All buttons are localized
- [ ] #13 All badges are loczlized
- [x] #14 AI assistant is localized
- [ ] #15 All the rest of pages are using localized values
- [x] #16 Language selection is moved from header to navigation menu as first item.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Implementation Plan

### Phase 1: Setup & Infrastructure

**1.1 Install Dependencies**

```bash
npm install next-intl
```

**1.2 Create Message Files Structure**

```
messages/
├── en.json      # English (source/default)
├── es.json      # Spanish
├── fr.json      # French
└── de.json      # German
```

**Message File Structure (`messages/en.json`):**
```json
{
  "common": {
    "loading": "Loading...",
    "error": "An error occurred",
    "save": "Save",
    "cancel": "Cancel",
    "delete": "Delete",
    "edit": "Edit",
    "back": "Back",
    "next": "Next",
    "submit": "Submit",
    "close": "Close"
  },
  "auth": {
    "login": {
      "title": "Log in to your account",
      "email": "Email address",
      "password": "Password",
      "submit": "Log in",
      "submitting": "Logging in...",
      "forgotPassword": "Forgot password?",
      "noAccount": "Don't have an account?",
      "signUp": "Sign up",
      "orContinueWith": "Or continue with",
      "errors": {
        "invalidCredentials": "Invalid email or password",
        "emailRequired": "Email is required",
        "passwordRequired": "Password is required"
      }
    },
    "signup": {
      "title": "Create your account",
      "fullName": "Full Name",
      "email": "Email address",
      "password": "Password",
      "submit": "Sign up",
      "submitting": "Creating account...",
      "hasAccount": "Already have an account?",
      "login": "Log in"
    }
  },
  "navigation": {
    "home": "Home",
    "browseJourneys": "Browse Journeys",
    "myProfile": "My Profile",
    "myBoats": "My Boats",
    "myJourneys": "My Journeys",
    "myCrew": "My Crew",
    "myRegistrations": "My Registrations",
    "settings": "Settings",
    "signOut": "Sign out",
    "filters": "Filters"
  },
  "home": {
    "hero": {
      "title": "Connect Boat Owners with Crew Members",
      "subtitle": "Find your next sailing adventure or the perfect crew for your journey",
      "browseJourneys": "Browse Journeys",
      "signUp": "Sign up",
      "login": "Log in"
    },
    "forOwners": {
      "title": "For Boat Owners & Skippers",
      "description": "Find experienced crew members for your sailing adventures"
    },
    "forCrew": {
      "title": "For Crew Members",
      "description": "Discover sailing opportunities worldwide"
    }
  },
  "journeys": {
    "browse": {
      "title": "Browse Journeys",
      "noResults": "No journeys found",
      "filters": {
        "location": "Location",
        "dateRange": "Date Range",
        "riskLevel": "Risk Level",
        "experienceLevel": "Experience Level"
      }
    },
    "card": {
      "crewNeeded": "{count, plural, =0 {No crew needed} =1 {1 crew needed} other {# crew needed}}",
      "viewDetails": "View Details",
      "register": "Register"
    }
  },
  "boats": {
    "specifications": {
      "length": "Length",
      "beam": "Beam",
      "draft": "Draft",
      "displacement": "Displacement",
      "sailArea": "Sail Area",
      "capacity": "Capacity"
    },
    "units": {
      "meters": "m",
      "feet": "ft",
      "kilograms": "kg",
      "pounds": "lbs",
      "squareMeters": "m²",
      "squareFeet": "ft²",
      "knots": "kn"
    }
  },
  "notifications": {
    "title": "Notifications",
    "markAllRead": "Mark all as read",
    "noNotifications": "No notifications",
    "timeAgo": {
      "justNow": "Just now",
      "minutesAgo": "{count}m ago",
      "hoursAgo": "{count}h ago",
      "daysAgo": "{count}d ago"
    }
  },
  "footer": {
    "copyright": "© {year} SailSmart. All rights reserved.",
    "privacyPolicy": "Privacy Policy",
    "termsOfService": "Terms of Service",
    "privacySettings": "Privacy Settings"
  },
  "errors": {
    "notFound": "Page not found",
    "serverError": "Something went wrong",
    "unauthorized": "You must be logged in to access this page",
    "forbidden": "You don't have permission to access this page"
  }
}
```

---

### Phase 2: Next.js Configuration

**2.1 Create i18n Configuration**

**File:** `i18n.ts`
```typescript
import { getRequestConfig } from 'next-intl/server';
import { notFound } from 'next/navigation';

export const locales = ['en', 'es', 'fr', 'de'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'en';

export default getRequestConfig(async ({ locale }) => {
  if (!locales.includes(locale as Locale)) notFound();

  return {
    messages: (await import(`./messages/${locale}.json`)).default,
    timeZone: 'UTC',
    now: new Date(),
  };
});
```

**2.2 Create Middleware for Locale Detection**

**File:** `middleware.ts` (update existing)
```typescript
import createMiddleware from 'next-intl/middleware';
import { locales, defaultLocale } from './i18n';

export default createMiddleware({
  locales,
  defaultLocale,
  localePrefix: 'as-needed', // Only add prefix for non-default locales
  localeDetection: true,     // Detect from Accept-Language header
});

export const config = {
  matcher: [
    // Match all pathnames except static files and API routes
    '/((?!api|_next|_vercel|.*\\..*).*)',
  ],
};
```

**2.3 Update next.config.ts**
```typescript
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  // ... existing config
};

export default withNextIntl(nextConfig);
```

---

### Phase 3: App Router Structure

**Restructure routes with locale segment:**

```
app/
├── [locale]/
│   ├── layout.tsx           # Locale-aware layout
│   ├── page.tsx             # Homepage
│   ├── auth/
│   │   ├── login/page.tsx
│   │   └── signup/page.tsx
│   ├── crew/
│   │   ├── dashboard/page.tsx
│   │   ├── browse/page.tsx
│   │   └── registrations/page.tsx
│   ├── owner/
│   │   ├── boats/page.tsx
│   │   ├── journeys/page.tsx
│   │   └── registrations/page.tsx
│   ├── settings/
│   │   └── privacy/page.tsx
│   └── feedback/
│       └── page.tsx
├── api/                     # API routes (no locale)
│   └── ...
└── globals.css
```

**3.1 Update Root Layout**

**File:** `app/[locale]/layout.tsx`
```typescript
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { locales } from '@/i18n';

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params: { locale } }) {
  const t = await getTranslations({ locale, namespace: 'metadata' });
  return {
    title: t('title'),
    description: t('description'),
  };
}

export default async function LocaleLayout({
  children,
  params: { locale },
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  if (!locales.includes(locale as any)) notFound();

  const messages = await getMessages();

  return (
    <html lang={locale}>
      <body>
        <NextIntlClientProvider messages={messages}>
          {/* Existing providers */}
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
```

---

### Phase 4: Component Migration

**4.1 Create Translation Hook Usage Pattern**

**Before (hardcoded):**
```tsx
export function LoginForm() {
  return (
    <form>
      <h1>Log in to your account</h1>
      <label>Email address</label>
      <input placeholder="Enter your email" />
      <button>Log in</button>
    </form>
  );
}
```

**After (translated):**
```tsx
import { useTranslations } from 'next-intl';

export function LoginForm() {
  const t = useTranslations('auth.login');
  
  return (
    <form>
      <h1>{t('title')}</h1>
      <label>{t('email')}</label>
      <input placeholder={t('emailPlaceholder')} />
      <button>{t('submit')}</button>
    </form>
  );
}
```

**4.2 Server Components Pattern**

```tsx
import { getTranslations } from 'next-intl/server';

export default async function HomePage() {
  const t = await getTranslations('home');
  
  return (
    <main>
      <h1>{t('hero.title')}</h1>
      <p>{t('hero.subtitle')}</p>
    </main>
  );
}
```

**4.3 Pluralization and Interpolation**

```tsx
// Message: "crewNeeded": "{count, plural, =0 {No crew needed} =1 {1 crew needed} other {# crew needed}}"
const t = useTranslations('journeys.card');
<span>{t('crewNeeded', { count: leg.crew_needed })}</span>
```

---

### Phase 5: Date/Time/Number Formatting

**5.1 Update Date Formatting Utility**

**File:** `app/lib/dateFormat.ts`
```typescript
import { useFormatter } from 'next-intl';

export function useDateFormatter() {
  const format = useFormatter();
  
  return {
    formatDate: (date: Date | string) => {
      const dateObj = typeof date === 'string' ? new Date(date) : date;
      return format.dateTime(dateObj, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    },
    
    formatDateShort: (date: Date | string) => {
      const dateObj = typeof date === 'string' ? new Date(date) : date;
      return format.dateTime(dateObj, {
        month: 'short',
        day: 'numeric',
      });
    },
    
    formatRelativeTime: (date: Date | string) => {
      const dateObj = typeof date === 'string' ? new Date(date) : date;
      return format.relativeTime(dateObj);
    },
  };
}
```

**5.2 Number Formatting**

```typescript
import { useFormatter } from 'next-intl';

export function useNumberFormatter() {
  const format = useFormatter();
  
  return {
    formatNumber: (num: number) => format.number(num),
    
    formatDistance: (meters: number, unit: 'metric' | 'imperial' = 'metric') => {
      if (unit === 'imperial') {
        const feet = meters * 3.28084;
        return format.number(feet, { maximumFractionDigits: 1 }) + ' ft';
      }
      return format.number(meters, { maximumFractionDigits: 1 }) + ' m';
    },
    
    formatWeight: (kg: number, unit: 'metric' | 'imperial' = 'metric') => {
      if (unit === 'imperial') {
        const lbs = kg * 2.20462;
        return format.number(lbs, { maximumFractionDigits: 0 }) + ' lbs';
      }
      return format.number(kg, { maximumFractionDigits: 0 }) + ' kg';
    },
  };
}
```

---

### Phase 6: Language Switcher Component

**File:** `app/components/LanguageSwitcher.tsx`
```typescript
'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useRouter, usePathname } from 'next/navigation';
import { locales, type Locale } from '@/i18n';

const languageNames: Record<Locale, string> = {
  en: 'English',
  es: 'Español',
  fr: 'Français',
  de: 'Deutsch',
};

const languageFlags: Record<Locale, string> = {
  en: '🇬🇧',
  es: '🇪🇸',
  fr: '🇫🇷',
  de: '🇩🇪',
};

export function LanguageSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  const handleChange = (newLocale: Locale) => {
    // Remove current locale from pathname
    const pathWithoutLocale = pathname.replace(`/${locale}`, '') || '/';
    router.push(`/${newLocale}${pathWithoutLocale}`);
    
    // Persist preference
    localStorage.setItem('preferred-locale', newLocale);
    
    // If logged in, save to profile
    // saveLocalePreference(newLocale);
  };

  return (
    <div className="relative">
      <select
        value={locale}
        onChange={(e) => handleChange(e.target.value as Locale)}
        className="appearance-none bg-transparent border border-border rounded-md px-3 py-2 pr-8"
      >
        {locales.map((loc) => (
          <option key={loc} value={loc}>
            {languageFlags[loc]} {languageNames[loc]}
          </option>
        ))}
      </select>
    </div>
  );
}
```

---

### Phase 7: User Preference Storage

**7.1 Database Migration**

**File:** `migrations/015_add_language_preference.sql`
```sql
-- Add language preference to profiles
ALTER TABLE public.profiles
ADD COLUMN language VARCHAR(5) DEFAULT 'en'
CHECK (language IN ('en', 'es', 'fr', 'de'));

-- Add index for queries
CREATE INDEX idx_profiles_language ON public.profiles(language);

-- Comment
COMMENT ON COLUMN public.profiles.language IS 
'User preferred language code (ISO 639-1)';
```

**7.2 Update Profile API**

Add language to profile fetch/update operations.

**7.3 Sync Logic**
- On login: fetch language from profile → apply to app
- On language change (logged in): update profile + localStorage
- On language change (logged out): update localStorage only
- On first visit: detect from Accept-Language header

---

### Phase 8: Email Localization

**File:** `app/lib/notifications/email.ts`

```typescript
import { getTranslations } from 'next-intl/server';

export async function sendRegistrationApprovedEmail(
  userEmail: string,
  userLocale: string,
  data: { journeyName: string; legName: string; ownerName: string }
) {
  const t = await getTranslations({ locale: userLocale, namespace: 'emails.registrationApproved' });
  
  const subject = t('subject', { journeyName: data.journeyName });
  const body = t('body', {
    journeyName: data.journeyName,
    legName: data.legName,
    ownerName: data.ownerName,
  });
  
  await sendEmail({ to: userEmail, subject, body });
}
```

**Email Message Keys:**
```json
{
  "emails": {
    "registrationApproved": {
      "subject": "You're approved for {journeyName}!",
      "body": "Great news! {ownerName} has approved your registration for {legName} on the journey {journeyName}."
    },
    "registrationDenied": {
      "subject": "Update on your registration for {journeyName}",
      "body": "We're sorry, but your registration for {legName} was not approved."
    }
  }
}
```

---

### Phase 9: SEO & Metadata

**9.1 Localized Metadata**

```typescript
// app/[locale]/page.tsx
export async function generateMetadata({ params: { locale } }) {
  const t = await getTranslations({ locale, namespace: 'metadata.home' });
  
  return {
    title: t('title'),
    description: t('description'),
    alternates: {
      canonical: `https://sailsm.art/${locale}`,
      languages: {
        'en': 'https://sailsm.art/en',
        'es': 'https://sailsm.art/es',
        'fr': 'https://sailsm.art/fr',
        'de': 'https://sailsm.art/de',
      },
    },
    openGraph: {
      title: t('ogTitle'),
      description: t('ogDescription'),
      locale: locale,
      alternateLocale: locales.filter(l => l !== locale),
    },
  };
}
```

**9.2 Hreflang Tags**

Automatically handled by Next.js with alternates configuration.

---

## File Structure (Final)

```
/
├── i18n.ts                    # i18n configuration
├── messages/
│   ├── en.json               # English translations
│   ├── es.json               # Spanish translations
│   ├── fr.json               # French translations
│   └── de.json               # German translations
├── app/
│   ├── [locale]/
│   │   ├── layout.tsx        # Locale-aware root layout
│   │   ├── page.tsx          # Homepage
│   │   ├── auth/
│   │   ├── crew/
│   │   ├── owner/
│   │   └── ...
│   ├── api/                  # API routes (no locale)
│   └── globals.css
├── components/
│   ├── LanguageSwitcher.tsx
│   └── ...
├── lib/
│   └── dateFormat.ts         # Locale-aware formatting
├── middleware.ts             # Locale detection/routing
└── next.config.ts            # Updated with next-intl plugin

migrations/
└── 015_add_language_preference.sql
```

---

## Migration Strategy

### Step 1: Infrastructure (No visible changes)
- Install next-intl
- Create i18n config
- Set up middleware
- Create English message file

### Step 2: Route Migration
- Move all pages into `[locale]` directory
- Update layout with NextIntlClientProvider
- Test English-only still works

### Step 3: String Extraction (Page by page)
- Start with highest-traffic pages (homepage, login)
- Extract strings to message files
- Replace hardcoded text with `t()` calls
- QA each page before moving on

### Step 4: Add Languages
- Copy en.json to es.json, fr.json, de.json
- Use translation service or team for translations
- Add language switcher to header

### Step 5: User Preferences
- Add database column
- Implement preference sync
- Update email system

---

## Estimated Effort

| Phase | Effort |
|-------|--------|
| Setup & Infrastructure | 3 hours |
| Next.js Configuration | 2 hours |
| Route Restructuring | 4 hours |
| Component Migration (150+ strings) | 12 hours |
| Date/Time/Number Formatting | 3 hours |
| Language Switcher | 2 hours |
| User Preference Storage | 2 hours |
| Email Localization | 4 hours |
| SEO & Metadata | 2 hours |
| Translation (4 languages) | 8 hours |
| Testing & QA | 6 hours |
| **Total** | **~48 hours** |
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Technical Decisions

### Why next-intl over react-i18next?
- Built specifically for Next.js App Router
- Better Server Components support
- Simpler configuration
- Built-in formatting (dates, numbers, relative time)
- Active maintenance and community

### Why locale prefix "as-needed"?
- Default locale (en) doesn't need `/en/` prefix
- Better SEO for primary market
- Cleaner URLs for majority of users
- Other locales get explicit prefix

### Why store language in database?
- Persists across devices
- Enables localized emails
- Analytics on language distribution
- Consistent experience when logged in

### Why not translate user-generated content?
- Complexity of storing multiple versions
- Users write in their native language intentionally
- Machine translation quality concerns
- Cost of human translation at scale
- Can be added as future enhancement

## Translation Workflow

### For Development Team
1. Add English strings to `messages/en.json`
2. Mark new keys for translation
3. Create translation request

### For Translators
1. Receive updated en.json with new keys
2. Translate to target language
3. Submit translated JSON file
4. QA review in staging environment

### Tools Recommendation
- **Crowdin** or **Lokalise** for translation management
- **i18n Ally** VS Code extension for developer experience
- **next-intl** CLI for extracting/validating messages

## ICU Message Format

next-intl uses ICU message format for:
- Pluralization: `{count, plural, =0 {none} =1 {one} other {#}}`
- Select: `{gender, select, male {He} female {She} other {They}}`
- Interpolation: `Hello {name}!`

## Fallback Strategy

1. Try exact locale (es-MX)
2. Fall back to language (es)
3. Fall back to default (en)
4. Show key name as last resort (development only)

## Future Enhancements

1. **RTL Support** - Arabic, Hebrew
2. **Regional Variants** - es-ES vs es-MX
3. **Content Translation** - User-generated content
4. **Translation Memory** - Reuse common phrases
5. **A/B Testing** - Test translation quality
6. **Automated Translation** - ML for real-time translation

## Phase 1 Implementation Complete (2026-01-31)

First version implemented with support for:
- **English (en)** - Default language
- **Finnish (fi)** - First additional language

### What was implemented:
- next-intl integration with Next.js App Router
- Locale-based routing (`/en/`, `/fi/`)
- Message files structure (`messages/en.json`, `messages/fi.json`)
- Middleware for locale detection
- Basic language switcher component

### Remaining work:
- Complete string extraction for all components
- User preference storage in database
- Email localization
- Full QA testing

## Implementation Progress (2026-02-01)

### Infrastructure Complete:
- Created `i18n/config.ts` with locale definitions (en, fi)
- Created `i18n/request.ts` for server-side locale detection
- Created `messages/en.json` with comprehensive translations
- Created `messages/fi.json` with Finnish translations
- Updated `next.config.ts` with next-intl plugin
- Updated `app/layout.tsx` with NextIntlClientProvider
- Created `LanguageSwitcher.tsx` component
- Added language switcher to Header
- Created database migration for language preference

### Pages Updated with i18n:
- `app/auth/login/page.tsx` - Login page fully translated
- `app/auth/signup/page.tsx` - Signup page fully translated
- `app/page.tsx` - Home page partially translated

### Remaining Work:
- Continue translating remaining pages (journeys, boats, profile, etc.)
- Add date/time formatting utilities
- Sync language preference with user profile
- Email localization

## Continued Implementation (2026-02-01 continued)

### Additional Pages Translated:
- `app/components/Footer.tsx` - Footer with privacy links translated
- `app/crew/dashboard/page.tsx` - Crew dashboard with sign-in banner
- `app/crew/registrations/page.tsx` - Crew registrations page fully translated
- `app/owner/boats/page.tsx` - Owner boats page fully translated
- `app/owner/journeys/page.tsx` - Owner journeys page fully translated
- `app/components/Header.tsx` - Filters button translated
- `app/page.tsx` - Home page fully translated (hero, features, how it works, CTA)

### Translation Keys Added:
- `crewDashboard.*` - Sign-in banner texts
- `home.howItWorks.*` - How it works section (3 steps)
- `home.cta.*` - Call-to-action section
- `home.forOwners.feature1-3` - Owner feature list items
- `home.forCrew.feature1-3` - Crew feature list items
- `journeys.*` - Journey management (create, sort, filter, delete)
- `boats.*` - Additional boat management keys
- `registrations.*` - Additional registration keys
- `footer.privacySettings` - Privacy settings link

### Progress Summary:
- Core pages translated: Home, Login, Signup, Footer, Crew Dashboard, Crew Registrations, Owner Boats, Owner Journeys
- Header filter button translated
- Both en.json and fi.json fully synchronized

## Progress Update (2026-02-01 continued)

### Completed in this session:

1. **Language Switcher moved to Navigation Menu (#16)**
   - Added 'menu-item' variant to LanguageSwitcher component
   - Integrated LanguageSwitcher as first item in NavigationMenuContent
   - Removed LanguageSwitcher from Header.tsx
   - Added Language section header using settings.language.title translation

2. **Language preference persists (#4)**
   - Already saving to localStorage (previous work)
   - Added profile sync to LanguageSwitcher when user is logged in
   - Uses getSupabaseBrowserClient to update profiles.language column

3. **Locale-aware date formatting (#6)**
   - Updated app/lib/dateFormat.ts with locale detection
   - Added locale mapping (en -> en-US, fi -> fi-FI)
   - Functions now read locale from cookie or localStorage
   - Added formatDateTime() and formatTime() utilities

4. **NavigationMenu translated**
   - Added useTranslations hooks for navigation, auth, and settings
   - Translated all menu item labels (My Profile, My Boats, My Journeys, etc.)
   - Translated section headers (For Skipper, For Crew)
   - Translated appearance, sign out, login, sign up

5. **AssistantButton localized (#14 partial)**
   - Added useTranslations for aria-label and title

### Translation keys added:
- navigation.forSkipper
- navigation.forCrew
- navigation.appearance
- navigation.completeProfile
- navigation.login
- navigation.signUp
- navigation.loading

### Remaining work:
- Profile page translation
- Settings/Privacy page translation
- Full AI assistant translation
- Remaining pages

## Additional Progress (2026-02-01 session 2)

### Components Translated:

1. **NotificationBell.tsx**
   - Added useTranslations for aria-label

2. **FiltersDialog.tsx**
   - Translated header (Filters), close button
   - Translated availability label, location label, location placeholder
   - Translated Cancel and Save and Search buttons
   - Updated date formatting to use locale-aware formatting

3. **Profile page (app/profile/page.tsx)**
   - Added useTranslations hooks
   - Translated page header (Complete Your Profile / Profile)
   - Translated Profile Completion label
   - Translated success messages
   - Translated all section titles (Personal Information, Sailing Preferences, Sailing Experience and Skills, Notifications and Consents)
   - Translated Save/Cancel buttons

4. **Privacy Settings page (app/settings/privacy/page.tsx)**
   - Added useTranslations hooks
   - Translated page title and subtitle
   - Translated Consent Preferences section (AI Processing, Profile Sharing, Marketing)
   - Translated Email Notifications section (Registration Updates, Journey Updates, Profile Reminders)
   - Translated Your Data section
   - Translated Export Data section
   - Translated Delete Account section
   - Translated delete confirmation dialog

### Translation keys added:

**journeys.browse.filters:**
- availability
- locationPlaceholder
- saveAndSearch

**profile:**
- profile
- completeYourProfile
- save
- saving
- profileCompletion
- profileCreatedSuccess
- profileUpdatedSuccess
- failedToLoadProfile
- failedToSaveProfile
- sections.sailingExperience
- sections.notifications

**settings.privacy (comprehensive):**
- subtitle
- aiProcessing, aiProcessingDesc
- profileSharing, profileSharingDesc
- consentPreferences, consentControlDesc
- emailNotifications, emailNotificationsDesc
- registrationUpdates, registrationUpdatesDesc
- journeyUpdates, journeyUpdatesDesc
- profileReminders, profileRemindersDesc
- yourData, yourDataDesc
- profileInfo, name, notSet
- consentHistory, privacyPolicyAccepted, termsAccepted, notAccepted
- exportData, exportDataDesc, downloadMyData, preparingDownload, dataDownloaded
- deleteAccount, deleteAccountDesc, deleteMyAccount
- deleteConfirmTitle, deleteConfirmDesc, deleteConfirmItems.*, deleteConfirmType
- permanentlyDelete, deleting
- failedToUpdate, failedToExport, failedToDelete

### Summary:
Major pages now translated: Home, Login, Signup, Footer, Header, Crew Dashboard, Crew Registrations, Owner Boats, Owner Journeys, Navigation Menu, Filters Dialog, Profile, Privacy Settings.

## Progress Update (2026-02-01 session 3)

### Components Translated:

1. **AI Assistant components (AC #14)**
   - AssistantSidebar.tsx - title, newConversation, close, previousConversations, deleteConversation
   - AssistantChat.tsx - greeting, greetingMessage, findMatchingJourneys, improveProfile, thinking, used, pendingActions, placeholder
   - assistant/page.tsx - full page translation

2. **NotificationCenter.tsx**
   - title, close aria-label, noNotificationsYet, notifyWhenHappens, loadMore

3. **notifications/page.tsx**
   - Mobile header title translation

4. **owner/dashboard/page.tsx**
   - Loading text translation

5. **owner/registrations/page.tsx (All Registrations)**
   - Full page translation: title, subtitle, all filter labels, status options, sort options, pagination, results count

### Translation keys added:

**assistant:**
- newConversation, close, previousConversations, deleteConversation
- greeting, greetingMessage, findMatchingJourneys, improveProfile
- thinking, used, pendingActions

**notifications:**
- noNotificationsYet, notifyWhenHappens, loadMore

**registrations.allRegistrations:**
- title, subtitle, allStatuses, allJourneys, allLegs
- status, journey, leg, sortBy, sortOrder, ascending, descending
- registrationDate, lastUpdated, journeyName, legName
- showing, noMatchingRegistrations, registered, updated, noEndDate
- previous, next, pageOf
<!-- SECTION:NOTES:END -->
