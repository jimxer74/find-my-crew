/**
 * Test utility functions
 */

/**
 * Wait for a condition to be true
 */
export async function waitForCondition(
  condition: () => boolean,
  timeout = 1000,
  interval = 50
): Promise<void> {
  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    if (condition()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
  }
  throw new Error(`Condition not met within ${timeout}ms`);
}

/**
 * Mock sessionStorage for tests
 */
export function mockSessionStorage() {
  const storage: Record<string, string> = {};

  return {
    getItem: (key: string) => storage[key] || null,
    setItem: (key: string, value: string) => {
      storage[key] = value;
    },
    removeItem: (key: string) => {
      delete storage[key];
    },
    clear: () => {
      Object.keys(storage).forEach((key) => delete storage[key]);
    },
    get length() {
      return Object.keys(storage).length;
    },
    key: (index: number) => Object.keys(storage)[index] || null,
  };
}

/**
 * Setup sessionStorage mock before tests
 */
export function setupSessionStorageMock() {
  const mockStorage = mockSessionStorage();
  Object.defineProperty(window, 'sessionStorage', {
    value: mockStorage,
    writable: true,
  });
  return mockStorage;
}

/**
 * Clean up sessionStorage mock after tests
 */
export function cleanupSessionStorageMock() {
  // Clear storage but don't delete the property
  const mockStorage = mockSessionStorage();
  Object.defineProperty(window, 'sessionStorage', {
    value: mockStorage,
    writable: true,
    configurable: true,
  });
}
