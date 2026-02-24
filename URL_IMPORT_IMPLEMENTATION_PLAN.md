# URL Import Front-Page Integration - Implementation Plan

## Scope

Integrate URL import functionality into OwnerComboSearchBox for both desktop and mobile versions. This allows users to optionally bootstrap their onboarding by importing profile content before entering the main combo search flow.

## Files to Create

✅ **Already Created:**
- `URLImportModal.tsx` - Desktop modal wrapper
- `URLImportWizardPage.tsx` - Mobile first wizard page
- `URL_IMPORT_FRONTPAGE_INTEGRATION.md` - Design concept

## Files to Modify

### 1. `app/components/ui/OwnerComboSearchBox.tsx`

This is the main file that needs updates. Current structure:

**Desktop Version:**
- `DesktopOwnerComboSearchBox` component
- 3 segments: Journey Details, Skipper Profile, Crew Requirements
- Each segment opens a dialog

**Mobile Version:**
- `MobileOwnerComboSearchBox` component
- 3-page wizard: Journey Details → Skipper Profile → Crew Requirements

### Changes Required:

#### Desktop Changes:
```typescript
// Add new state
const [showURLImportModal, setShowURLImportModal] = useState(false);
const [importedProfile, setImportedProfile] = useState<{
  url: string;
  source: string;
  content: string;
  metadata: any;
} | null>(null);

// Add pre-form UI section with URL import button
// Before the 3 segments, add:
<div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
  <p className="text-sm text-gray-700 mb-3">
    Have an existing profile? Import it to auto-fill your information.
  </p>
  <button
    onClick={() => setShowURLImportModal(true)}
    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
  >
    Paste Link to Profile
  </button>
</div>

// Add imported profile preview banner if successful
{importedProfile && (
  <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
    <p className="text-sm text-green-900 font-medium">
      ✅ Profile imported from {importedProfile.source}
    </p>
    <p className="text-xs text-green-800 mt-1">
      Review the details below and make any changes as needed.
    </p>
  </div>
)}

// Add URLImportModal component
<URLImportModal
  isOpen={showURLImportModal}
  onClose={() => setShowURLImportModal(false)}
  onSuccess={(content, metadata) => {
    setImportedProfile({
      url: metadata.url,
      source: metadata.platform || 'unknown',
      content,
      metadata,
    });
    setShowURLImportModal(false);
  }}
/>

// When submitting, include importedProfile in the data
const data: OwnerComboSearchData = {
  journeyDetails: { ... },
  skipperProfile: { ... },
  crewRequirements: { ... },
  importedProfile: importedProfile ? {
    url: importedProfile.url,
    source: importedProfile.source,
    content: importedProfile.content,
  } : undefined,
};
```

#### Mobile Changes:
```typescript
// Change currentPage type from 1 | 2 | 3 to 0 | 1 | 2 | 3
const [currentPage, setCurrentPage] = useState<0 | 1 | 2 | 3>(0);

// Add new state for imported profile
const [importedProfile, setImportedProfile] = useState<{
  url: string;
  source: string;
  content: string;
  metadata: any;
} | null>(null);

// Render URLImportWizardPage on page 0
{currentPage === 0 && (
  <URLImportWizardPage
    onImportSuccess={(content, metadata) => {
      setImportedProfile({
        url: metadata.url,
        source: metadata.platform || 'unknown',
        content,
        metadata,
      });
      setCurrentPage(1); // Advance to Journey Details
    }}
    onContinueManually={() => {
      setCurrentPage(1); // Skip import, go to Journey Details
    }}
  />
)}

// Update page navigation
// Previous page button should go to page 0 if on page 1 and not imported
// Or skip page 0 if imported already

// Update handleWizardSubmit to include importedProfile
const data: OwnerComboSearchData = {
  journeyDetails: { ... },
  skipperProfile: { ... },
  crewRequirements: { ... },
  importedProfile: importedProfile ? {
    url: importedProfile.url,
    source: importedProfile.source,
    content: importedProfile.content,
  } : undefined,
};

// Update page numbering display
// "Step 2 of 4" when on URL import page (currentPage === 0)
// "Step 3 of 4" when on Journey Details (currentPage === 1)
// etc.
```

## Component Integration Points

### URLImportModal (Desktop)
- Import from: `app/components/onboarding/URLImportModal.tsx`
- Usage: Controlled by `showURLImportModal` state
- Passes: `URLImportForm` component inside
- Callbacks: `onSuccess`, `onClose`

### URLImportWizardPage (Mobile)
- Import from: `app/components/onboarding/URLImportWizardPage.tsx`
- Usage: Rendered as first wizard page (page 0)
- Callbacks: `onImportSuccess`, `onContinueManually`

### URLImportForm (Both)
- Already imported from: `app/components/onboarding/URLImportForm.tsx`
- Reused in both modal and wizard page
- Provides all form functionality

## Data Flow

### Desktop
```
User clicks [Paste Link to Profile]
  ↓
URLImportModal opens
  ↓
URLImportForm rendered inside modal
  ↓
User pastes URL and clicks [Import Profile/Post]
  ↓
onSuccess callback triggered
  ↓
Store importedProfile in state
  ↓
Close modal
  ↓
Show green success banner
  ↓
User can review/edit fields
  ↓
On submit: Include importedProfile in OwnerComboSearchData
```

### Mobile
```
Page 0: URLImportWizardPage shown
  ↓
User sees URL import option + manual option
  ↓
Option A: User pastes URL and clicks [Fetch & Auto-fill]
  ↓
  onImportSuccess callback
  ↓
  Store importedProfile
  ↓
  Advance to Page 1 (Journey Details)

OR

Option B: User clicks [Enter Details Manually]
  ↓
  onContinueManually callback
  ↓
  Advance to Page 1 without imported profile
```

## Type Updates

### OwnerComboSearchData Interface

Update in `app/components/ui/OwnerComboSearchBox.tsx`:

```typescript
export interface OwnerComboSearchData {
  journeyDetails: {
    text: string;
    aiProcessingConsent: boolean;
  };
  skipperProfile: {
    text: string;
    aiProcessingConsent: boolean;
  };
  crewRequirements: {
    text: string;
    aiProcessingConsent: boolean;
  };
  // NEW: Optional imported profile
  importedProfile?: {
    url: string;
    source: string; // 'facebook', 'twitter', 'generic'
    content: string;
  };
}
```

## URL Parameter Updates

When user submits with imported profile:

```
?journeyDetails=...&skipperProfile=...&crewRequirements=...&importedProfile=...
```

This gets passed to `page.tsx` and through to `OwnerChatContext`.

## OwnerChatContext Integration

**Location:** `app/contexts/OwnerChatContext.tsx`

When processing initial message:

```typescript
// Extract importedProfile from URL params
const importedProfileParam = searchParams?.get('importedProfile');
const importedProfileData = importedProfileParam ? JSON.parse(importedProfileParam) : null;

// Build message with imported profile context
const parts: string[] = [];

if (importedProfileData) {
  parts.push(`[IMPORTED_PROFILE]:\nURL: ${importedProfileData.url}\nSource: ${importedProfileData.source}\n\n${importedProfileData.content}`);
}

if (skipperProfileParam?.trim()) {
  parts.push(`[SKIPPER PROFILE]:\n${skipperProfileParam}`);
}

if (crewRequirementsParam?.trim()) {
  parts.push(`[CREW REQUIREMENTS]:\n${crewRequirementsParam}`);
}

if (journeyDetailsText) {
  parts.push(journeyDetailsText.trim());
}

const message = parts.join('\n\n');
```

## Visual Design Details

### Desktop Modal
- Max width: 500px (lg)
- Position: Center screen with backdrop
- Header: Title + close button
- Content: URLImportForm + descriptive text
- Spacing: 24px padding

### Mobile First Page
- Full width
- Title: "Quick Start"
- Subtitle: "Have an existing profile? Import it to auto-fill..."
- URLImportForm: Full width
- Divider: "OR" with lines
- Manual option: Button with chevron
- Info box: Blue background with tips

## Acceptance Criteria

### Desktop Integration
- [ ] URL import button shown above combo search box
- [ ] Click opens modal dialog
- [ ] Modal contains URLImportForm
- [ ] Success shows green banner
- [ ] Imported content included in submit data
- [ ] Desktop responsive on all sizes
- [ ] No console errors

### Mobile Integration
- [ ] Page 0 shown as first wizard page
- [ ] URLImportWizardPage component rendered
- [ ] Can paste URL and fetch content
- [ ] Can skip to manual entry
- [ ] Page navigation works correctly
- [ ] Imported content persists across pages
- [ ] Imported content included in submit data
- [ ] Mobile responsive and touch-friendly
- [ ] No console errors

### End-to-End Flow
- [ ] Desktop: Import URL → Form prefilled → Submit includes imported data
- [ ] Mobile: Import URL on page 0 → Pages 1-3 completed → Submit includes imported data
- [ ] Context receives imported profile correctly
- [ ] AI onboarding uses [IMPORTED_PROFILE] context
- [ ] Fallback to manual entry works for both versions

## Testing Checklist

- [ ] Test with valid Facebook URL
- [ ] Test with valid Twitter URL
- [ ] Test with generic blog URL
- [ ] Test with invalid URL
- [ ] Test network error handling
- [ ] Test rate limiting
- [ ] Test desktop modal open/close
- [ ] Test mobile wizard page navigation
- [ ] Test skip/manual continuation
- [ ] Verify data passed to OwnerChatContext
- [ ] Verify AI receives [IMPORTED_PROFILE] context
- [ ] Cross-browser testing (Chrome, Firefox, Safari)
- [ ] Mobile testing (iOS Safari, Chrome Android)

## Deployment Checklist

- [ ] All tests passing
- [ ] No TypeScript errors
- [ ] No console warnings
- [ ] Code review approved
- [ ] UX tested with users (optional)
- [ ] Deploy to staging
- [ ] Final QA on staging
- [ ] Deploy to production
