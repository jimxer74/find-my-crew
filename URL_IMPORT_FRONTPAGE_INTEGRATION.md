# URL Import Front-Page Integration Concept

## Overview

Integrate the URL import functionality into the existing OwnerComboSearchBox to allow users to optionally bootstrap their onboarding by pasting a link to their existing profile/post.

---

## Desktop Flow

### Current State
3-segment combo search box:
- Segment 1: Journey Details
- Segment 2: Skipper Profile
- Segment 3: Crew Requirements

### New Design: Pre-Search Option

**Visual Layout:**
```
┌────────────────────────────────────────────────────────────┐
│ Accelerate Your Setup                                      │
│ [Paste Link to Profile]  OR  [Enter Details Manually >]   │
└────────────────────────────────────────────────────────────┘
        ↓                              ↓
    Modal Opens              Current 3-segment form
  with URLImportForm        (Journey/Skipper/Crew)
```

### Implementation Details

**New Button Section (above current 3 segments):**
- Label: "Have an existing profile? Paste the link"
- Button: [Paste Link] (opens modal)
- Alternative: "Or [Enter Details Manually]" (proceeds to form)

**Modal Dialog:**
- Title: "Import Your Profile"
- Contains: URLImportForm component
- On Success:
  - Store imported content in state
  - Close modal
  - Show preview of what was imported
  - Auto-fill relevant fields
  - Continue to manual refinement
- On Skip/Cancel: Close modal, show form

**Field Population:**
After URL import succeeds:
- Extract content and show preview banner
- Suggest: "We found your profile! Review and refine below:"
- Pre-fill form fields with extracted information
- User can edit before submitting

---

## Mobile Flow

### Current State
3-page wizard:
- Page 1: Journey Details
- Page 2: Skipper Profile
- Page 3: Crew Requirements

### New Design: Pre-Wizard URL Import Page

**Page 0: URL Import Option**
```
┌─────────────────────────────────────────────┐
│ Quick Start                                  │
│                                             │
│ Have an existing profile? Import it to      │
│ auto-fill your information.                 │
│                                             │
│ [Paste Link]                                │
│ [URL input field]                           │
│ [Fetch Data] button                         │
│                                             │
│ OR                                          │
│                                             │
│ [Enter Details Manually >]                  │
└─────────────────────────────────────────────┘
```

### Page Flow

**Option A: User Chooses to Import**
```
Page 0: URL Paste
  ↓
[Fetching...]
  ↓
Page 0: Preview (shows imported content)
  ↓
[Continue] button
  ↓
Page 1: Journey Details (with imported data as context)
  ↓
Page 2: Skipper Profile (pre-filled from imported profile)
  ↓
Page 3: Crew Requirements
```

**Option B: User Chooses Manual**
```
Page 0: URL Paste
  ↓
[Enter Details Manually >]
  ↓
Page 1: Journey Details
  ↓ (current flow continues)
```

### Mobile Page 0 Details

**URL Input State:**
```
Title: "Import Your Profile"
Subtitle: "Have a Facebook post, blog, or profile URL?"

Text Input:
- Placeholder: "Paste URL here..."
- Help: "Facebook, Twitter, blogs, or any public URL"
- Examples:
  - facebook.com/user/posts/123
  - twitter.com/user/status/456
  - myblog.com/article

Buttons:
[Fetch & Auto-fill] [Skip - Enter Manually]
```

**Loading State:**
```
Spinner animation
"Fetching your profile..."
```

**Preview State:**
```
Green success banner: "✅ Profile imported!"
Source: "Facebook" (or Twitter/Blog)
Preview box: First 300 chars of content

Buttons:
[Continue] [Try Different URL]
```

**Navigation:**
- After fetch succeeds: Show preview, then [Continue] goes to Page 1
- After skip/manual chosen: Go directly to Page 1
- From preview: [Continue] passes imported content to subsequent pages

---

## Data Flow

### Desktop
```
User clicks [Paste Link]
  ↓
Modal opens with URLImportForm
  ↓
User enters URL + clicks [Import]
  ↓
API: POST /api/url-import/fetch-content
  ↓
Success: Store in local state { importedProfile }
  ↓
Close modal
  ↓
Show preview banner: "Profile imported from {source}"
  ↓
User can edit fields (they're pre-filled)
  ↓
On submit: Include imported content in onboarding context
```

### Mobile
```
User on Page 0: URL Import
  ↓
Enters URL + clicks [Fetch & Auto-fill]
  ↓
API: POST /api/url-import/fetch-content
  ↓
Success: Store in local state { importedProfile }
  ↓
Show preview state
  ↓
User clicks [Continue]
  ↓
Navigate to Page 1 with importedProfile in context
  ↓
Pages 1-3 can reference imported content
```

---

## Implementation Files to Create/Modify

### New Components
- `URLImportModal.tsx` - Desktop modal wrapper
- `URLImportWizardPage.tsx` - Mobile first page

### Modified Files
- `app/components/ui/OwnerComboSearchBox.tsx`
  - Add URL import option to desktop version
  - Add URL import page to mobile wizard
  - Handle importedProfile state
  - Pre-fill fields from imported data

### Integration Points
- OwnerComboSearchBox handles URL import trigger
- URLImportForm component is reused
- Store imported profile in component state
- Pass to onboarding context on submit

---

## Component Hierarchy

```
OwnerComboSearchBox
├── Desktop Version
│   ├── URL Import Button/Label
│   ├── URLImportModal (conditionally)
│   │   └── URLImportForm
│   └── 3-segment Form (Journey/Skipper/Crew)
│
└── Mobile Version
    ├── URLImportWizardPage (Page 0)
    │   └── URLImportForm
    └── Existing 3 wizard pages
```

---

## Field Pre-filling Strategy

When URL import succeeds, extract and pre-fill:

**From [IMPORTED_PROFILE]:**
- Skipper Profile page:
  - Name (if available)
  - Description/bio
  - Experience level (if mentioned)
  - Location (if available)

- Journey Details page:
  - Trip description (if journey mentioned)
  - Any location references

- Crew Requirements:
  - Skills mentioned in profile
  - Team size preferences
  - Any experience requirements mentioned

**Show as:** "Based on your profile, we found:" with options to edit

---

## User Experience Benefits

✅ **Friction Reduction:**
- Paste a link instead of typing everything
- Auto-fill reduces manual data entry
- Skip if they don't have a link

✅ **Data Accuracy:**
- Pull from existing public profiles
- Reduce typos/mistakes

✅ **Flexibility:**
- Works with any public URL (not just Facebook)
- Falls back to manual entry
- Can edit auto-filled data

✅ **Mobile-Friendly:**
- First page is specifically for URL paste
- Clear "manual" alternative

---

## Error Handling

**Desktop:**
- Modal stays open if URL fails
- Error shown with retry option
- Can close modal and use manual form
- No data loss

**Mobile:**
- Page 0 stays on first page if URL fails
- Error shown inline
- Can retry or click [Skip - Enter Manually]
- Navigation doesn't advance

---

## Next Steps

1. Create URLImportModal component (desktop wrapper)
2. Create URLImportWizardPage component (mobile first page)
3. Update OwnerComboSearchBox to integrate both
4. Update OwnerChatContext to handle importedProfile
5. Test full flow on desktop and mobile
6. Deploy to staging for user testing
