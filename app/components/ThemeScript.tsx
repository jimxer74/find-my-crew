/**
 * ThemeScript Component
 *
 * Injects an inline script into the <head> that runs before React hydration
 * to prevent flash of unstyled content (FOUC) when the theme differs from
 * the user's stored preference.
 */

export function ThemeScript() {
  const themeScript = `
    (function() {
      try {
        const stored = localStorage.getItem('theme');
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

        // Determine if dark mode should be applied
        // Priority: stored preference > system preference
        const shouldBeDark = stored === 'dark' ||
          (stored === 'system' && prefersDark) ||
          (!stored && prefersDark);

        if (shouldBeDark) {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
      } catch (e) {
        // localStorage may not be available (e.g., private browsing)
        // Fall back to system preference via CSS media query
      }
    })();
  `;

  return (
    <script
      dangerouslySetInnerHTML={{ __html: themeScript }}
      suppressHydrationWarning
    />
  );
}
