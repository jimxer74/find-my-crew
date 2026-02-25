export type OAuthPopupResult = {
  success: boolean;
  isNewUser?: boolean;
  error?: string;
};

/**
 * Opens an OAuth provider URL in a centered popup window and waits for a message back.
 * Falls back to a standard redirect if the popup is blocked.
 *
 * @param url The OAuth provider URL to open
 * @param provider The name of the provider (for error messages)
 * @returns A promise that resolves with the OAuthPopupResult
 */
export async function openOAuthPopup(url: string, provider: string): Promise<OAuthPopupResult> {
  return new Promise((resolve) => {
    // Popup dimensions
    const width = 500;
    const height = 600;

    // Calculate center relative to current window
    const left = window.screenX + (window.innerWidth - width) / 2;
    const top = window.screenY + (window.innerHeight - height) / 2;

    const popupFeatures = `scrollbars=yes, width=${width}, height=${height}, top=${top}, left=${left}`;

    // Try to open the popup
    const popup = window.open(url, `OAuth_${provider}`, popupFeatures);

    // Follow the fallback strategy if popup is blocked
    if (!popup || popup.closed || typeof popup.closed === 'undefined') {
      console.warn(`[OAuth Popup] Popup blocked by browser for ${provider}. Falling back to full page redirect.`);
      window.location.href = url;
      // We don't resolve the promise here because the page is redirecting
      return;
    }

    // Set up message listener to receive the callback from the popup
    const messageListener = (event: MessageEvent) => {
      // Ensure the message is coming from our own origin
      if (event.origin !== window.location.origin) return;

      if (event.data?.type === 'oauth_success') {
        cleanup();
        resolve({
          success: true,
          isNewUser: event.data.isNewUser,
        });
      }

      if (event.data?.type === 'oauth_error') {
        cleanup();
        resolve({
          success: false,
          error: event.data.error || 'Authentication failed',
        });
      }
    };

    window.addEventListener('message', messageListener);

    // Set up polling to detect if the user manually closes the popup
    const pollTimer = setInterval(() => {
      if (popup.closed) {
        cleanup();
        resolve({
          success: false,
          error: 'Popup closed by user',
        });
      }
    }, 500);

    // Cleanup function to remove listeners and interval
    const cleanup = () => {
      window.removeEventListener('message', messageListener);
      clearInterval(pollTimer);
    };
  });
}
