# Playwright UX Testing Setup

This directory contains the Playwright configuration and UX tests for the SailSmart application.

## 🚀 Quick Start

### Install Dependencies
```bash
npm install
```

### Run Tests
```bash
# Run all tests
npm run playwright

# Run with interactive UI
npm run playwright:ui

# Run in headed mode (see browser)
npm run playwright:headed

# Run specific test file
npx playwright test tests/ux/home-page.ux.spec.ts

# Run example test (works with current app)
npx playwright test tests/example.home.spec.ts

# Debug mode
npm run playwright:debug

# View test report
npm run playwright:report
```

### Generate Tests
```bash
# Record and generate test code
npx playwright codegen http://localhost:3000

# Generate test in headed mode
npx playwright test --codegen --headed
```

## 📁 Project Structure

```
tests/
├── example.home.spec.ts        # Example test that works with current app
├── ux/                          # UX test files
│   ├── home-page.ux.spec.ts    # Home page UX tests
│   ├── authentication.ux.spec.ts # Auth flow UX tests
│   └── crew-management.ux.spec.ts # Crew management UX tests
├── utils/                       # Shared utilities
│   ├── selectors.ts            # Centralized selectors
│   ├── testHelpers.ts          # Test helper functions
│   └── constants.ts            # Test constants
└── fixtures/                    # Test data
    └── testUsers.ts            # Mock user data
```

## ⚙️ Configuration

### Browser Support
- **Chromium** (default)
- **Firefox**
- **WebKit**
- **Mobile devices**: iPhone 12, Pixel 5

### Viewports
- Desktop: 1280x720
- Tablet: 768x1024
- Mobile: 375x812

### Test Parallelism
- Tests run in parallel by default
- CI environment runs tests sequentially
- Configurable via environment variables

## 📋 Adapting Tests for Your Application

### Step 1: Start Dev Server
Before running tests, ensure your development server is running:

```bash
npm run dev
```

### Step 2: Add Data Attributes
Add `data-testid` attributes to your React components:

```jsx
// Before
<button onClick={handleClick}>Submit</button>

// After
<button data-testid="submit-button" onClick={handleClick}>Submit</button>
```

### Step 2: Update Selectors
Update the selectors in `tests/utils/selectors.ts` to match your application:

```typescript
export const selectors = {
  // Update these to match your app
  auth: {
    loginButton: '[data-testid="your-login-button"]',
    emailInput: '[data-testid="your-email-input"]',
    // ...
  }
};
```

### Step 3: Start with Example Test
Run the example test to see Playwright working with your current application:

```bash
npx playwright test tests/example.home.spec.ts
```

This test will:
- Load your home page
- Test navigation
- Check responsive design
- Verify basic accessibility
- Take screenshots

### Step 4: Customize Test Scenarios
Modify the test files in `tests/ux/` to test your specific user flows:

```typescript
test('should handle your specific flow', async ({ page }) => {
  // Your custom test logic here
});
```

### Step 5: Fix TypeScript Errors
If you encounter TypeScript errors in the test files, check:
- Use proper Playwright matchers (`expect(element).toHaveCount()` not `toHaveCountGreaterThan()`)
- Handle nullable return values (`textContent()` can return `null`)
- Use correct async/await patterns

## 🧪 Test Categories

### UX Tests (`tests/ux/`)
- **Accessibility**: Screen reader compatibility, keyboard navigation
- **Responsive Design**: Mobile, tablet, desktop views
- **User Flows**: Complete user journeys
- **Error Handling**: Error states and user feedback
- **Performance**: Loading states and responsiveness
- **Form Validation**: Real-time validation and user guidance

### Common Test Patterns

#### Form Testing (Basic)
```typescript
// Find form fields by type or placeholder
await page.fill('input[type="email"]', 'test@example.com');
await page.click('button[type="submit"]');
```

### Form Testing (With Data Attributes)
```typescript
// After adding data-testid attributes
await page.fill('[data-testid="email-input"]', 'test@example.com');
await page.click('[data-testid="submit-button"]');
await expect(page.locator('[data-testid="success-message"]')).toBeVisible();
```

#### Navigation Testing
```typescript
await page.click('[data-testid="nav-browse"]');
await expect(page).toHaveURL(/.*browse/);
```

#### Mobile Testing
```typescript
await page.setViewportSize({ width: 375, height: 812 });
// Test mobile-specific interactions
```

## 📊 Test Reports

### HTML Report
After running tests, view the HTML report:
```bash
npm run playwright:report
```

### Screenshots and Videos
- Failed tests automatically capture screenshots
- Videos are saved for debugging
- Located in `test-results/` directory
- Screenshots saved in project root (example-*.png)

### Trace Viewer
For detailed debugging:
```bash
npx playwright show-trace test-results/your-test-trace.zip
```

### Test Output
- Console logs show test progress and results
- Screenshot paths are displayed for easy access
- Error messages provide debugging information

## 🔧 Environment Variables

```bash
# Base URL for tests
BASE_URL=http://localhost:3000

# Test timeout
PLAYWRIGHT_TIMEOUT=30000

# Slow motion (for debugging)
PLAYWRIGHT_SLOWMO=1000

# Browser selection
PLAYWRIGHT_BROWSERS=chromium,firefox
```

## 🎯 Best Practices

### 1. Use Descriptive Test Names
```typescript
test('should display error message for invalid email', async ({ page }) => {
  // ...
});
```

### 2. Test User Scenarios, Not Implementation
```typescript
// Good: Tests user behavior
await page.click('[data-testid="submit-button"]');

// Avoid: Tests implementation details
await page.evaluate(() => submitForm());
```

### 3. Use Page Object Model for Complex Flows
```typescript
class HomePage {
  constructor(private page: Page) {}

  async browseCrews() {
    await this.page.click('[data-testid="browse-button"]');
  }
}
```

### 4. Handle Async Operations Properly
```typescript
// Wait for navigation
await Promise.all([
  page.waitForNavigation(),
  page.click('[data-testid="submit-button"]')
]);

// Wait for elements
await expect(page.locator('[data-testid="success"]')).toBeVisible();
```

### 5. Clean Up Between Tests
```typescript
test.afterEach(async ({ page }) => {
  await page.context().clearCookies();
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
});
```

## 🐛 Troubleshooting

### Tests Failing on CI
- Check if dev server is running
- Verify base URL configuration
- Ensure proper authentication setup

### Element Not Found Errors
- Verify data-testid attributes exist
- Check for dynamic content loading
- Use proper waiting strategies

### Timeout Issues
- Increase timeout in config
- Add explicit waits for async operations
- Check network conditions
- Ensure dev server is running before tests

### TypeScript Errors
- Use proper Playwright matchers (`expect(element).toHaveCount()` not `toHaveCountGreaterThan()`)
- Handle nullable return values (`textContent()` can return `null`)
- Use correct async/await patterns

### Mobile Testing Issues
- Verify viewport configuration
- Test touch interactions
- Check responsive CSS
- Ensure proper touch target sizes (minimum 44px)

## 📈 Performance Testing

### Measure Page Load
```typescript
const navigationPromise = page.goto('/');
const response = await navigationPromise;
console.log(`Page loaded in ${response?.timing?.responseEnd}ms`);
```

### Check Resource Loading
```typescript
await page.waitForLoadState('networkidle');
```

### Monitor Console Errors
```typescript
page.on('console', msg => {
  if (msg.type() === 'error') {
    console.log(`Console error: ${msg.text()}`);
  }
});
```

## 🔗 Integration with CI/CD

### GitHub Actions
```yaml
name: Playwright Tests
on:
  push:
    branches: [ main ]
  pull_request:

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      - run: npm ci
      - run: npm run build
      - run: npm run playwright
        env:
          BASE_URL: https://your-staging-url.com
```

### Docker
```dockerfile
FROM mcr.microsoft.com/playwright:v1.40.0-jammy
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
RUN npx playwright install
CMD ["npm", "run", "playwright"]
```

## 📚 Further Reading

- [Playwright Documentation](https://playwright.dev/docs/intro)
- [Accessibility Testing](https://playwright.dev/docs/accessibility-testing)
- [Mobile Testing](https://playwright.dev/docs/mobile)
- [Test Generator](https://playwright.dev/docs/codegen)

## 🤝 Contributing

1. Add new test files to `tests/ux/`
2. Update selectors in `tests/utils/selectors.ts`
3. Add test data to `tests/fixtures/`
4. Update this README if needed
5. Run tests: `npm run playwright`
6. Submit PR with test results