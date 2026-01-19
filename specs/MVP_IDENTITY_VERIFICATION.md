# MVP Identity Verification Strategy

**Document Version:** 1.0  
**Date:** January 2026  
**Approach:** OAuth + Passport Image + AI Verification

---

## Overview

For MVP, instead of complex third-party ID verification services, we'll use a simpler but effective approach:

1. **OAuth Provider Authentication** (Facebook, Google, LinkedIn)
2. **Passport Image Upload** in user profile
3. **AI-Powered Verification** to match passport details with OAuth identity
4. **Auto-Approval Enabled** only when verification passes

---

## Requirements

### 1. OAuth Provider Authentication

**Supported Providers:**
- Google (OAuth 2.0)
- Facebook (OAuth 2.0)
- LinkedIn (OAuth 2.0)

**Identity Data Extracted:**
- Full name (first name, last name)
- Email address
- Profile photo (optional, for additional verification)

**Authentication Flow:**
- User selects OAuth provider on signup/login
- OAuth consent screen → user grants permissions
- Platform receives OAuth token
- Extract identity information from provider
- Store in user profile as "verified identity source"

### 2. Passport Image Upload

**Requirements:**
- Upload passport photo page (MRZ zone visible)
- Supported formats: JPG, PNG, PDF
- Maximum file size: 5MB
- Image quality requirements (clear, readable)

**Storage:**
- Store in Supabase Storage (encrypted)
- Access restricted (only user + admins)
- GDPR-compliant handling

**User Experience:**
- Upload field in profile settings
- Clear instructions on what to upload
- Preview before submission
- Option to retake/re-upload

### 3. AI-Powered Passport Verification

**Verification Process:**

1. **Extract Passport Data (AI OCR)**
   - Extract text from passport image using OCR
   - Parse MRZ (Machine Readable Zone)
   - Extract: Full name, date of birth, passport number, nationality

2. **Match with OAuth Identity**
   - Compare passport name with OAuth provider name
   - Handle name variations (middle names, nicknames, etc.)
   - Calculate similarity/match confidence score

3. **Verification Result**
   - **Verified:** Name matches OAuth identity → Auto-approval enabled
   - **Needs Review:** Name similar but not exact → Manual review
   - **Failed:** Name doesn't match → Rejection, request new upload

**AI/ML Approach Options:**

**Option A: Pre-built OCR Service** (Recommended for MVP)
- Use cloud OCR APIs: Google Cloud Vision, AWS Textract, Azure Form Recognizer
- These services can extract structured data from passports
- Pros: Fast to implement, high accuracy, no ML training needed
- Cons: Cost per verification (~$0.001-0.01 per image)

**Option B: Custom ML Model**
- Train model to extract passport data
- Use libraries like Tesseract OCR + custom parsing
- Pros: No per-verification cost, full control
- Cons: Requires ML expertise, training data, lower accuracy initially

**Recommendation:** Start with Option A (Google Cloud Vision or AWS Textract) for MVP, consider Option B later if costs become prohibitive.

### 4. Verification Status & Auto-Approval

**Verification States:**
- **Unverified:** No OAuth provider connected or no passport uploaded
- **Pending:** Passport uploaded, verification in progress
- **Verified:** Passport matches OAuth identity → Auto-approval enabled
- **Failed:** Verification failed, manual review or retry required

**Auto-Approval Enablement:**
- Auto-approval is ONLY enabled when verification status = "Verified"
- Unverified users: All applications require manual owner approval
- Verified users: Can receive auto-approval (if match score > threshold)

**Security Considerations:**
- Verification must be re-checked periodically (e.g., annually)
- Flag suspicious activity (multiple verification attempts, mismatched data)
- Audit log all verification attempts and results

---

## Implementation Plan

### Phase 1: OAuth Integration (Week 1-2)

**Tasks:**

1. **Set up OAuth Providers**
   - Create OAuth apps in Google, Facebook, LinkedIn developer consoles
   - Configure redirect URIs
   - Store client IDs/secrets securely (environment variables)

2. **Implement OAuth Flow**
   - Add OAuth buttons to signup/login pages
   - Implement OAuth callback handlers
   - Extract identity data from provider responses
   - Link OAuth account to user profile

3. **Database Schema**
   - Add to `profiles` table:
     - `oauth_provider` (enum: google, facebook, linkedin, null)
     - `oauth_provider_id` (string, unique per provider)
     - `verified_name` (string, from OAuth)
     - `verified_email` (string, from OAuth)

**Deliverables:**
- OAuth login working for all 3 providers
- Identity data stored in user profiles
- UI showing connected OAuth provider

### Phase 2: Passport Upload (Week 2-3)

**Tasks:**

1. **Upload UI/UX**
   - Add passport upload field to profile settings
   - Image preview functionality
   - Upload progress indicator
   - Clear instructions/guidelines

2. **Storage Integration**
   - Set up Supabase Storage bucket for passports
   - Implement secure upload (signed URLs, file validation)
   - File size/format validation
   - Encryption at rest

3. **Database Schema**
   - Add to `profiles` table:
     - `passport_image_url` (string, path in storage)
     - `passport_uploaded_at` (timestamp)
     - `passport_verification_status` (enum: unverified, pending, verified, failed)

**Deliverables:**
- Users can upload passport images
- Files stored securely
- Upload status tracked in database

### Phase 3: AI Passport Verification (Week 3-4)

**Tasks:**

1. **OCR Service Integration**
   - Choose OCR service (recommend: Google Cloud Vision API)
   - Set up API credentials
   - Implement image processing pipeline
   - Extract passport data (name, DOB, passport number)

2. **Name Matching Algorithm**
   - Normalize names (lowercase, remove special chars, handle accents)
   - Fuzzy matching for name variations:
     - "John Smith" vs "John A. Smith" → Match
     - "Maria Garcia" vs "Maria García" → Match (handle accents)
     - "Robert" vs "Bob" → Needs fuzzy matching or nickname mapping
   - Calculate confidence score (0-100%)

3. **Verification Logic**
   - Match passport name with OAuth verified name
   - Threshold: >80% similarity = Verified, 60-80% = Needs Review, <60% = Failed
   - Handle edge cases (middle names, multiple surnames)

4. **Verification API Endpoint**
   - `POST /api/verification/verify-passport`
   - Process uploaded passport image
   - Return verification status + confidence score

**Deliverables:**
- Passport OCR working (extracts name)
- Name matching algorithm working
- Verification API endpoint functional
- Verification status updated in database

**Technical Details:**

**OCR Service Example (Google Cloud Vision):**
```typescript
// Extract text from passport image
const [result] = await visionClient.textDetection({
  image: { source: { imageUri: passportImageUrl } }
});

// Parse MRZ or text for name extraction
const extractedText = result.textAnnotations[0].description;
const name = extractNameFromPassport(extractedText);
```

**Name Matching Example:**
```typescript
function matchNames(oauthName: string, passportName: string): number {
  // Normalize names
  const normalizedOAuth = normalizeName(oauthName); // "john smith"
  const normalizedPassport = normalizeName(passportName); // "john a smith"
  
  // Calculate similarity (Levenshtein distance or fuzzy matching)
  const similarity = calculateSimilarity(normalizedOAuth, normalizedPassport);
  
  return similarity; // 0-100%
}
```

### Phase 4: Auto-Approval Integration (Week 4)

**Tasks:**

1. **Check Verification Status in Approval Logic**
   - When evaluating application for auto-approval:
     - Check if crew member has `verification_status = 'verified'`
     - If verified: Proceed with auto-approval if match score > threshold
     - If unverified: Always require manual owner approval

2. **UI Updates**
   - Show verification badge/status in user profiles
   - Display "Verified" status in crew applications
   - Indicate which applications are auto-approved vs. manual

3. **Admin Dashboard**
   - View verification requests requiring manual review
   - Override verification status if needed
   - Audit log of all verifications

**Deliverables:**
- Auto-approval only works for verified users
- UI shows verification status clearly
- Admin tools for verification management

---

## Verification Flow Diagram

```
User Signs Up
    ↓
Connect OAuth Provider (Google/Facebook/LinkedIn)
    ↓
OAuth Identity Stored (name, email)
    ↓
Upload Passport Image
    ↓
AI OCR Extracts Passport Name
    ↓
Compare Passport Name vs OAuth Name
    ↓
    ├─ Match (>80%) → Status: VERIFIED → Auto-approval enabled
    ├─ Similar (60-80%) → Status: NEEDS REVIEW → Manual review
    └─ No Match (<60%) → Status: FAILED → Retry or manual review
```

---

## Security & Privacy Considerations

### Data Protection:
- **Passport Images:** Stored encrypted, access-restricted
- **OAuth Tokens:** Stored securely, never exposed to frontend
- **Verification Results:** Logged but personal data anonymized

### Fraud Prevention:
- **One Verification Per User:** Prevent multiple verification attempts to game system
- **Rate Limiting:** Limit verification requests (e.g., 3 attempts per month)
- **Audit Trail:** Log all verification attempts, successes, failures
- **Manual Review:** Flag suspicious patterns (multiple failures, name variations)

### GDPR/Privacy:
- **Data Minimization:** Only store necessary passport data
- **Right to Deletion:** Allow users to delete passport images
- **Consent:** Clear consent for passport upload and verification
- **Data Retention:** Define retention period for passport images (e.g., delete after 1 year of inactivity)

---

## Success Metrics

1. **Verification Success Rate:**
   - >80% of uploads successfully verified on first attempt
   - <5% false positives (incorrectly verified)
   - <10% false negatives (incorrectly rejected)

2. **User Experience:**
   - <5 minutes to complete verification (OAuth + upload + processing)
   - >70% of users complete verification
   - <10% user complaints about verification process

3. **Security:**
   - 0 fraud cases from verified accounts
   - >95% of auto-approvals from verified users are accepted by owners

4. **Cost:**
   - OCR processing cost <$0.01 per verification
   - Total verification cost <$1 per user per year

---

## Challenges & Mitigation

### Challenge 1: Name Matching Variations
**Problem:** OAuth name "John Smith" vs Passport "John A. Smith" or "John Michael Smith"

**Solution:**
- Normalize names (remove middle initials)
- Use fuzzy matching (Levenshtein distance, Soundex)
- For 60-80% match: Flag for manual review rather than auto-reject

### Challenge 2: OCR Accuracy
**Problem:** Poor quality passport images result in incorrect OCR extraction

**Solution:**
- Require minimum image quality (resolution, clarity)
- Validate extracted data format (passport numbers, dates)
- Manual review fallback for low-confidence extractions

### Challenge 3: Multiple Languages/Scripts
**Problem:** Passports in non-Latin scripts (Arabic, Chinese, etc.)

**Solution:**
- Start MVP with Latin script only (English passports)
- Expand to other scripts in future iterations
- Or require English-language passport for international users

### Challenge 4: OAuth Provider Data Variations
**Problem:** Different OAuth providers return names in different formats

**Solution:**
- Normalize all OAuth responses to standard format
- Handle "given_name" + "family_name" vs "name" fields
- Store normalized version for matching

---

## Future Enhancements

1. **Additional Document Types:** Driver's license, national ID cards
2. **Liveness Detection:** Selfie verification to match passport photo
3. **Biometric Matching:** AI comparison of OAuth profile photo with passport photo
4. **Real-time Verification:** Verify during application submission (not just profile setup)
5. **Blockchain/Web3:** Decentralized identity verification (future consideration)

---

## MVP vs Full Solution

| Feature | MVP (This Plan) | Full Solution (Future) |
|---------|----------------|------------------------|
| Identity Source | OAuth providers | OAuth + Government ID databases |
| Verification Method | Passport OCR + Name matching | Passport OCR + Liveness + Biometrics |
| Processing | Async (few minutes) | Real-time (seconds) |
| Cost | ~$0.01 per verification | ~$0.50-2.00 per verification |
| Fraud Prevention | Basic (name matching) | Advanced (biometric, database checks) |
| Coverage | Latin script passports | All passport types |

**MVP is sufficient for:**
- Proving concept works
- Enabling auto-approval for majority of users
- Building trust in automated system
- Iterating based on real-world usage

---

## Testing Strategy

### Unit Tests:
- Name normalization functions
- Name matching algorithm (test various name formats)
- OCR response parsing

### Integration Tests:
- OAuth flow end-to-end
- Passport upload → OCR → verification flow
- Auto-approval logic with verified vs unverified users

### User Acceptance Testing:
- Test verification with real passports (various formats)
- Measure success rate, user satisfaction
- Validate fraud prevention (attempts with mismatched names)

---

## Go-Live Checklist

- [ ] OAuth integration tested with all 3 providers
- [ ] Passport upload working securely
- [ ] OCR integration tested (accuracy >90%)
- [ ] Name matching algorithm tested (handles variations)
- [ ] Verification status updates correctly
- [ ] Auto-approval logic respects verification status
- [ ] UI shows verification status clearly
- [ ] Admin dashboard for verification management
- [ ] Security audit completed
- [ ] Privacy policy updated
- [ ] User documentation/help created

---

## Next Steps

1. **Week 1:** Set up OAuth providers, implement OAuth flow
2. **Week 2:** Build passport upload feature, integrate OCR service
3. **Week 3:** Implement name matching, verification logic
4. **Week 4:** Integrate with auto-approval, test end-to-end
5. **Week 5:** User testing, refinements, security review
