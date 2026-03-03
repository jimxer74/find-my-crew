# Safety & Trust Features — Gap Analysis

**Source:** `docs/example_issues.md` — First-hand account of an Atlantic crossing on a 1983 40ft steel sloop, detailing skipper conduct, equipment deficiencies, logistics failures, and financial disputes.

**Purpose:** Identify features currently missing from the platform that would help crew avoid — or at least be better prepared for — the class of problems described in the source document. Includes an analysis of where AI and LLM capabilities can mitigate identified risks.

---

## Executive Summary

The source document is an unusually candid real-world account covering six distinct risk categories: **skipper conduct**, **boat readiness**, **safety equipment**, **logistics and financial agreements**, **living conditions**, and **crew composition**. The author is an experienced sailor (40+ years) who still encountered serious problems, underlining that experience alone is not sufficient protection — the platform must provide structural safeguards.

The platform currently has strong foundations for **document storage** (vault, access grants, audit logs), **skill matching**, and **boat/equipment management**. However, it is almost entirely missing the **trust and accountability layer** that experienced crew depend on before committing to a multi-week passage in close confinement.

**AI opportunity is significant across every risk category.** The platform already uses LLMs for equipment generation, journey planning, and onboarding. The same infrastructure — async job workers, document vault, profile system — can support a new tier of AI-powered trust, verification, and risk assessment features without requiring third-party integrations.

---

## 1. Skipper Conduct & Character Verification

### What the source document describes
> *"Calling a specific crew member a 'fuc.... wan...' and 'I just want to smash his face in...' towards other crew members are certainly extreme examples of very poor communication skills by a skipper."*

> *"Check captain out on social media; a lot can be deducted from feedback and overall impressions."*

> *"Is he a balanced and mature character to spend three-four weeks together on a tiny space? Initial impressions on communication styles can tell a lot…"*

### Current app status
- **MISSING.** No review or rating system exists for skippers or crew. The platform has a general app-feedback table but no peer-to-peer voyage feedback mechanism.
- Skipper profiles show self-reported experience and about-me text — entirely unverified and unreviewed.

### Recommended features

**A. Mutual post-voyage review system**
After a journey leg is marked complete, both the skipper and each crew member are prompted to leave a structured review covering:
- Communication & conduct (1–5)
- Boat readiness vs. what was advertised (1–5)
- Accuracy of voyage description (1–5)
- Would you sail with this person again? (Yes / Conditionally / No)
- Free-text comment (optional, appears publicly on profile)

Reviews are visible on both skipper and crew public profiles, attached to specific voyages (so context is clear). Aggregate scores are displayed prominently.

**B. Conduct incident reporting**
An in-voyage or post-voyage "Report a conduct issue" flow, separate from reviews, for serious incidents (verbal aggression, physical threats, refusal to return passport, financial disputes). Reports go to a moderation queue rather than being published automatically.

**C. Profile trust indicators**
Aggregate a visible "trust score" derived from: voyage count, review score average, document verification status, response rate, and account age. This surfaces quickly on the crew search card and voyage detail page without requiring the viewer to read all reviews.

### 🤖 AI opportunities

- **Communication tone analysis.** LLM analysis of a skipper's messages and voyage description text to detect persistent patterns of aggressive, dismissive, or coercive language. This could surface a subtle flag to prospective crew ("Communication style: note — some messages flagged for review") without making definitive judgements.
- **Review authenticity detection.** AI can identify statistical anomalies in review patterns (burst of 5-star reviews, linguistic similarity across reviews, timing correlations) that suggest manipulated or fake feedback. Suspicious review clusters can be quietly deprioritised in the aggregate score.
- **Review summarisation.** When a skipper or crew member has many reviews, an LLM can produce a concise plain-language summary: *"Frequently praised for calm seamanship and clear communication. Two reviewers mentioned delayed financial reimbursement."* This surfaces signal without requiring the reader to parse every entry.
- **Conduct severity classification.** When a conduct incident report is submitted, an LLM can classify the severity (low / medium / high / critical) based on the reported text, route the report to the appropriate moderation tier, and draft an acknowledgement response — reducing manual moderation load at scale.
- **Profile character signals.** AI can analyse the totality of a skipper's public profile — voyage descriptions, about-me text, how they respond to crew questions in the Q&A, response times — and surface a "communication style" summary as an additional signal for crew. Not a verdict, but structured context.

---

## 2. Boat Readiness & Seaworthiness Transparency

### What the source document describes
> *"I have unfortunately witnessed a skipper continuously insinuating blame onto crew for old / ill maintained or faulty equipment."*

> *"When was the rigging last professionally inspected? I would even request to see a copy in future."*

> *"Does the steering work? When last professionally serviced? Does the engine start/work? When last professionally serviced?"*

> *"Has he had the boat he is intending to cross the Atlantic with for more than a year in operation actually proving off-shore capability and readiness?"*

> *"Has he done any serious miles since purchase?"*

### Current app status
- The boat management system has equipment tracking, maintenance task scheduling, and service history — but **none of this is visible to crew browsing a voyage.**
- The journey detail page shows boat name, type, make/model, accommodations text, and images — nothing about service history, rigging condition, or critical systems status.

### Recommended features

**A. Boat readiness score visible on voyage listing**
A computed score derived from the boat's maintenance records: percentage of critical-category tasks (engine, rigging, steering, safety) that are up to date vs. overdue. Displayed as a simple indicator on the voyage card (e.g., "Boat maintenance: Up to date / Overdue items").

**B. Pre-voyage declaration checklist (skipper-completed)**
Before a voyage can be published, prompt the skipper to answer a structured seaworthiness declaration:
- Date of last rigging inspection (and option to attach document)
- Engine last serviced (date + hours)
- Steering last serviced
- Autopilot operational?
- Navigation instruments operational?
- Power budget (installed solar/alternator watts)

This is stored and shown to crew as a "Skipper's pre-departure declaration" section on the voyage detail page — not verified, but the act of declaring creates accountability.

**C. Offshore voyage experience on boat**
A field on the boat profile: "Miles sailed on this boat" and "Offshore passage experience on this vessel (Y/N)". Recommended especially for voyages tagged as offshore or extreme risk.

### 🤖 AI opportunities

- **Service document extraction.** When a skipper uploads a rigging inspection report, engine service certificate, or survey document to the vault, an LLM with document intelligence can extract key data — service date, technician, items checked, issues found — and auto-populate the pre-departure declaration fields. This dramatically reduces friction for skippers who have documentation but face a tedious form.
- **Maintenance gap analysis.** The platform already holds the boat's maintenance task history. An AI can analyse this and produce a pre-voyage readiness narrative: *"Engine last serviced 26 months ago (recommended interval: 12 months). Standing rigging has no recorded inspection. These are relevant for an offshore passage."* Shown to the skipper as a prompt to act, and optionally to crew as contextual risk information.
- **Age-adjusted readiness assessment.** Building on the existing `year_built`-aware equipment generation, AI can flag not just individual equipment replacement likelihood but overall vessel readiness concerns for the intended voyage type — e.g., a 40-year-old steel sloop with no recent rigging records attempting an Atlantic crossing is a materially different risk profile than the same boat for coastal day sailing.
- **Seaworthiness Q&A assistant.** Prospective crew can ask the platform a natural-language question — *"Is this boat suitable for an offshore passage?"* — and an LLM can synthesise available information (boat age, maintenance records visible, skipper qualifications, declared service dates) into a factual answer with caveats, rather than leaving crew to manually interpret raw data.

---

## 3. Safety Equipment Compliance

### What the source document describes
> *"Are the mob and rescue equipment working and within date?"*

> *"Is there a substantial medical kit on board?"*

> *"Life raft and grab bag present and located close to entry / escape position?"*

> *"Emergency rescue location beacon?"*

> *"Will the vessel engage in continuous channel 16 monitoring?"*

> *"Wear your life vest certainly from dusk to dawn and anytime you are outside of the cockpit!"*

### Current app status
- The equipment management system can store any item including safety equipment.
- **No dedicated safety equipment checklist** exists that is pre-voyage-gated or crew-visible.
- **No expiry date tracking** for safety-critical items (flares, life raft service, EPIRB registration).
- Nothing is surfaced to crew about safety equipment status.

### Recommended features

**A. Safety equipment category with expiry tracking**
Extend the existing equipment/inventory system to include a first-class "Safety Equipment" checklist bound to the boat, with item-level expiry dates:
- Life raft (last service date, next service due)
- EPIRB/PLB (registration date, battery expiry)
- Flares (expiry date)
- Fire extinguishers (last inspection)
- Life jackets with harnesses (count vs. crew capacity)
- Jacklines, tethers
- First aid kit (last restocked date)
- Emergency grab bag (last checked)
- AIS transponder (operational Y/N)

Items past their expiry date are flagged visually in the management UI and optionally surfaced to the skipper as "overdue" before publishing a voyage.

**B. Safety equipment summary on voyage detail page**
Show crew a stripped-down safety snapshot from the boat's records: life raft (in/out of service date), EPIRB (registered Y/N), life jackets for all crew (Y/N). This is not full audit disclosure — just enough for crew to ask informed follow-up questions.

**C. Risk-gated safety requirements**
For voyages tagged as "Offshore" or "Extreme" risk, require the skipper to confirm the safety checklist is complete before the voyage state can be set to "Published."

### 🤖 AI opportunities

- **Certificate extraction from documents.** EPIRB registration certificates, life raft service certificates, and flare expiry labels are often photographed and uploaded as images or scanned PDFs. An LLM with vision capability can extract the expiry/service date, serial number, and certification body from these documents and auto-populate the safety equipment record — eliminating manual data entry and transcription errors.
- **Route-aware safety requirements.** AI can generate a voyage-specific minimum safety equipment checklist based on route geography, distance from shore, declared risk level, and season. An Atlantic crossing in October has materially different minimum requirements than a Mediterranean coastal hop in July. The AI output becomes the pre-departure checklist the skipper must confirm.
- **Safety gap narrative.** Before a voyage is published, AI can review the boat's declared safety equipment against route requirements and produce a plain-language summary for the skipper: *"For an offshore Atlantic crossing you are missing: a current EPIRB registration (yours expired 8 months ago), and life jackets are listed for 4 people but your crew roster has 5."* This is advisory, not blocking, but makes gaps impossible to overlook.

---

## 4. Financial Transparency & Contribution Agreements

### What the source document describes
> *"Define in a written agreement what is included in and what the potential contribution is set at and if it's per day or week / per person or couple."*

> *"When is the contribution to be paid and in cash or bank transfer?"*

> *"What about harbor fees? What if departure is delayed due to ill repair condition of boat? Will you still be required to pay share the harbour fees?"*

> *"Port handling fees? Shared or part of the contribution?"*

> *"Will you be asked to contribute Starlink data or even subscription fees?"*

> *"Is all food included? Discuss dietary preferences. Will you be asked to pay for muesli, nuts or almond milk, but not get credit for not consuming any more expensive fish and meat products?"*

### Current app status
- Journey creation has a `cost_model` enum (5 types) and a free-text `cost_info` field.
- **No structured breakdown** of what is and isn't included in the contribution.
- **No payment/contribution tracking** — no tables, no flows.
- Free-text `cost_info` is the only financial disclosure to crew.

### Recommended features

**A. Structured cost disclosure form**
Replace or augment the free-text `cost_info` with a structured section that skippers fill in per voyage:
- Contribution amount (per person, per day / per leg / fixed total)
- What is included: fuel, harbour fees, food, provisioning, Starlink
- What is excluded (explicit checklist)
- Delay policy (who covers harbour fees if delayed for boat repairs)
- Payment method (cash / bank transfer / other)
- Payment timing (upfront / on arrival / split)

This data is shown to crew in a standardised card layout — not buried in paragraph text.

**B. Voyage agreement acknowledgement**
Before a crew registration is confirmed, the crew member must tap "I have read and accept the voyage terms" on a page that displays the structured cost disclosure plus any additional voyage rules set by the skipper. This acknowledgement is timestamped and stored (similar to the existing consent audit log).

### 🤖 AI opportunities

- **Natural-language cost disclosure extraction.** Skippers who currently write free-text cost descriptions can be offered an AI-assisted migration: paste your existing cost_info text, and the LLM extracts and maps the content into the structured fields, prompting the skipper to confirm or adjust. This lowers the friction of adopting structured disclosure.
- **Fairness and completeness check on cost terms.** Before publishing, an LLM can review the completed cost disclosure and flag terms that are ambiguous, unusually one-sided, or missing important information: *"Your delay policy is not defined. Crew could interpret this differently if departure is delayed for repairs."* This is advisory — it does not block publishing — but creates a moment of reflection.
- **Voyage agreement generation.** Given the structured voyage data (route, duration, cost terms, crew duties, risk level), an LLM can draft a complete, plain-language voyage agreement that both parties can review and acknowledge. This removes the burden of legal drafting from skippers while ensuring the agreement is internally consistent with what they've declared.
- **Financial dispute context.** If a conduct incident report cites a financial dispute, an AI can pull the stored voyage cost agreement and compare it against the reported dispute, providing context to the moderator: *"The crew claims harbour fees were charged unexpectedly. The voyage cost disclosure states harbour fees are 'not included'. The delay policy field was left blank."*

---

## 5. Living Conditions & Voyage Lifestyle Transparency

### What the source document describes
> *"Make sure to get a good tour or video showing of the boat including your designated bunk / cabin prior to agreeing anything."*

> *"Is the only toilet working?"*

> *"What capacity of drinking water is intended to be available on board? Make the calculation yourself and check!"*

> *"Funny one; ask for bunk size and headroom at the helm positions if you are tall 😅"*

> *"Do you need to bring towels, bedding, detergents?"*

> *"Will it be available throughout the trip or randomly just a few minutes per day at times you are mostly helming?"* *(re: Starlink)*

> *"Discuss if Alcohol will be available during the transit, and if so how is it shared and who is responsible to keep an eye on safe consumption."*

### Current app status
- The boat profile has a free-text `accommodations` field shown to crew.
- **No structured living conditions disclosure** (bunk count, toilet count, water maker, connectivity, alcohol policy, what to bring).
- No photos or video of the living areas beyond the general boat image gallery.

### Recommended features

**A. Structured boat living conditions profile**
Extend the boat profile with a structured "Living Conditions" section:
- Berths: count and type (double / single / pipe berth)
- Heads (toilets): count, fresh water flush / bucket
- Freshwater capacity (litres), watermaker installed (Y/N)
- Shower: fresh water / salt water / none
- Galley: gas stove / electric, oven Y/N
- Connectivity: Starlink / SSB / satellite phone / none
- What crew should bring: bedding, towels, toiletries

**B. Voyage lifestyle policy fields**
Add per-voyage lifestyle policy fields:
- Alcohol policy (none / moderate / social)
- Dietary accommodations (omnivore / vegetarian / vegan / flexible)
- Watch system (2-on-4-off / 3-watch system / TBD)
- Expected crew duties (cooking rotation Y/N, maintenance work expected Y/N)

**C. Boat interior photo gallery**
Designate a separate photo category within the boat image gallery for "interior / living areas" to allow skippers to upload bunk photos, galley, head — giving crew visual evidence of what they're signing up for.

### 🤖 AI opportunities

- **Spec-sheet auto-population.** Given a boat's make and model (which the platform already records), an LLM with web search can look up the builder's standard specification sheet and pre-populate living conditions fields: berth count, water capacity, heads, galley configuration. The skipper confirms or overrides. This is a natural extension of the existing `product_registry` and boat spec intelligence already in the platform.
- **Personalised "what to bring" list.** Based on the declared living conditions (no watermaker → limited fresh water), voyage destination, season, and duration, an AI can generate a crew-specific packing and preparation list: *"This boat has no watermaker. Budget 3L/day for drinking + 3L for cooking. Bring your own towel and bedding. The crossing is expected to be warm, but night watches on the Atlantic in November require a good offshore jacket."* This directly addresses the practical gap described by the author.
- **Conditions vs. vessel cross-check.** If a skipper declares a 40ft boat has 8 berths and 3 heads, or a 25ft boat declares unlimited fresh water, AI can flag this as statistically unlikely for the vessel size and prompt the skipper to verify — catching accidental or intentional misrepresentation before crew rely on it.

---

## 6. Watch Schedule & Crew Composition Transparency

### What the source document describes
> *"What is the intended watch sequence? How will any time zone shift be dealt with and how will the time shift be shared?"*

> *"Who are the other crew, age, couples or singles and their experience levels?"*

> *"Did we have some fun, YES - fortunately the other crew members were very capable and contributed to an overall super adventure!"*

### Current app status
- Voyage detail shows "crew needed" count and required skills, but **not the composition of crew already confirmed.**
- Pending registrations are managed by the skipper but crew cannot see who else is joining.
- No watch schedule field exists.

### Recommended features

**A. Crew composition preview**
Once a crew member's registration is confirmed, show them an anonymised list of other confirmed crew: first name/initial, sailing experience level, nationality. Full profiles only visible after mutual opt-in. This allows crew to assess the team they'll be sailing with.

**B. Watch schedule field**
A structured (or free-text with a template) watch schedule declaration on the voyage, visible to crew before applying:
- System type (2-watch, 3-watch, Swedish watch, TBD)
- Hours per watch
- Note on time zone change handling

### 🤖 AI opportunities

- **Watch schedule optimisation.** Given the confirmed crew count, experience levels, voyage duration, and planned route (including time zone crossings), an AI can suggest an optimal watch schedule that distributes rest fairly and accounts for time zone shift: *"With 4 crew on a 3-week Atlantic crossing crossing 4 time zones westward, a 3-watch system of 4-on/8-off with a 1-hour shift every 3 days is recommended."* The skipper can accept or customise.
- **Team experience assessment.** AI can analyse the confirmed crew composition against the voyage risk level and flag if the team as a whole is under-experienced for the declared risk: *"Your confirmed crew has an average experience level of 2/5, and no one has recorded offshore passage experience. This voyage is tagged as Offshore (risk level 3). Consider adjusting crew requirements or voyage risk declaration."* This surfaces before departure, not after something goes wrong.
- **Compatibility signals.** AI can surface soft compatibility signals from crew profiles (e.g., all crew have declared dietary preferences or alcohol policies — are they consistent with what the skipper declared?) and flag mismatches to the skipper during crew selection, reducing friction that turns into conflict at sea.

---

## 7. Skipper Qualification & Insurance Verification

### What the source document describes
> *"Ask for his navigational qualifications, VHF license, safety training."*

> *"Does he have sufficient sailing experience?"*

> *"Ask to see a copy of the insurance policy of the boat."*

### Current app status
- The document vault supports uploading `sailing_license`, `certification`, and `insurance` category documents.
- Access grants allow time-limited document sharing.
- **However, the vault is entirely passive** — there is no prompt, requirement, or flow that connects document uploads to voyage publishing or crew visibility.
- Skipper profiles have a free-text `certifications` field — unverified, unstructured.

### Recommended features

**A. Structured qualifications on skipper profile**
Replace the free-text certifications field with a structured list of recognisable qualification types:
- RYA Coastal Skipper / Yachtmaster / Ocean
- ASA 114 / 106 / 107
- IYT Master of Yachts
- STCW Basic Safety Training
- VHF / SRC radio licence
- First Aid certification
- Other (free text)

Each entry has an issue date and optional expiry, and can be backed by a document vault upload. Verified entries (backed by document) receive a checkmark badge; self-declared entries are shown differently.

**B. Insurance document requirement for offshore voyages**
For voyages tagged as Offshore or Extreme risk, add an optional (initially) but prominently visible field: "Third-party liability insurance." Skippers can upload to the vault and mark the voyage as "Insurance on file." Crew see the status (on file / not declared) in the voyage detail.

**C. Crew-initiated document request**
Allow a registered crew member to formally request (via a single button in their registration view) that the skipper share a specific document (e.g., insurance, qualification). The skipper is notified and can approve a time-limited access grant from the vault without leaving the platform.

### 🤖 AI opportunities

- **Certificate OCR and data extraction.** This is the highest-value single AI application in this category. When a skipper uploads a qualification certificate (RYA, ASA, IYT, STCW) or insurance document as an image or PDF, an LLM with vision can extract: issuing authority, qualification type, holder name, issue date, expiry date, certificate number. These fields auto-populate the structured qualification record — the skipper confirms with one tap. This is already architecturally feasible given the existing document vault and AI infrastructure.
- **Document authenticity signals.** AI can analyse an uploaded certificate image for signs of obvious tampering or fabrication — missing issuing authority logos, inconsistent fonts, implausible dates — and flag the document for manual review rather than immediately granting a "document verified" badge. Not forensic verification, but a meaningful filter.
- **Qualification sufficiency check.** Before an offshore voyage is published, AI can compare the skipper's declared qualifications against standard minimum requirements for the voyage type: *"An offshore Atlantic passage is typically considered to require at minimum RYA Coastal Skipper or equivalent. Your highest declared qualification is Day Skipper. This is below the recommended minimum for this voyage type — consider adding a more qualified skipper or adjusting the risk declaration."*
- **Insurance coverage extraction.** When an insurance document is uploaded, AI can extract coverage dates, vessel details, covered waters, and liability limit — presenting these to crew in a structured summary rather than requiring them to read a full policy document.

---

## 8. Pre-Voyage Mutual Agreement

### What the source document describes
> *"Sign a mutual indemnity agreement."*

> *"There should be part of the agreement that states a mutual understanding of healthy conduct between all people on board that strongly discourages foul language against anybody on board and banning any form of, or threat of physical and verbal aggression."*

> *"Ask your passports back after each harbour check in/out."*

> *"Is all food included? Discuss dietary preferences."*

### Current app status
- The platform has consent infrastructure (timestamped, auditable user_consents table).
- The general Terms of Service contains broad liability waivers.
- **No per-voyage agreement or conduct acknowledgement** exists.
- No prompt about passport retention — a real-world risk raised in the document.

### Recommended features

**A. Per-voyage voyage agreement builder**
Skippers can optionally attach a voyage agreement to their journey. A default template is provided covering:
- Liability and assumption of risk
- Conduct standards (no verbal/physical aggression)
- Cost and contribution terms (auto-populated from structured cost section)
- Crew duties
- Passport handling (skipper may retain for check-in purposes but must return within 24 hours)
- Emergency decision authority

Crew must sign (tap "I agree") before their registration is moved to "Confirmed" status. The signed acknowledgement is stored against the registration record, timestamped.

**B. Conduct standards baseline**
Regardless of whether a skipper creates a custom agreement, all voyage registrations include a mandatory baseline acknowledgement (one tap): "I acknowledge the SailSmart Community Conduct Standards which prohibit verbal aggression, physical threats, and financial misrepresentation." This applies to both crew and skipper.

### 🤖 AI opportunities

- **Conversational agreement builder.** Rather than presenting a skipper with a blank or template form, a conversational LLM flow asks them a series of natural-language questions — *"Who covers harbour fees if departure is delayed?"*, *"Are meals included or does crew contribute separately?"* — and assembles a complete, plain-language voyage agreement from the answers. This is consistent with the existing onboarding chat approach already in the platform.
- **Agreement plain-language explainer.** Before crew tap "I agree," an AI-powered chat button lets them ask *"What does assumption of risk mean here?"* or *"What happens if the skipper holds my passport for more than 24 hours?"* The LLM provides plain-language explanations in the context of the specific agreement, reducing the risk of crew signing something they don't understand.
- **Unusual clause detection.** When a skipper adds custom clauses to the agreement, an LLM reviews them and flags anything that is outside normal range for sailing voyage agreements: extreme liability waivers, clauses that would appear to circumvent legal protections, or financial terms that contradict the structured cost disclosure already on file. The skipper is not blocked from publishing, but receives a clear prompt to review.
- **Post-voyage dispute assistant.** If a conduct or financial dispute is reported, an AI can review all stored voyage data (agreement text, cost disclosure, signed acknowledgement, messages exchanged on the platform) and produce a structured incident summary for the moderation team — saving hours of manual case assembly.

---

## 9. AI & LLM Role Summary

The AI opportunities across all eight categories fall into four distinct functional roles. Understanding these roles helps prioritise implementation and avoid duplication.

### Role 1: Document Intelligence (Extract & Verify)
**What it does:** Reads uploaded documents (PDFs, photos, scanned certificates) and extracts structured data — dates, names, certificate types, coverage limits, expiry dates — into the platform's data model.

**Where it applies:**
- Qualification certificates → auto-populate structured qualification fields (§7)
- Insurance documents → extract coverage dates, vessel, waters covered (§7)
- Rigging / engine / survey reports → populate seaworthiness declaration fields (§2)
- EPIRB registrations and life raft service certificates → populate safety equipment expiry tracking (§3)
- Flare packaging photos → extract batch expiry dates (§3)

**Why it matters:** The document vault already exists and is used. AI document intelligence turns passive storage into active data — linking uploaded evidence to the structured profile fields that crew actually see. This is the single highest-leverage application because it reduces the friction of declaring information from "tedious form" to "upload photo, confirm."

**Platform fit:** Feasible today using the existing async job worker + document vault infrastructure with an LLM vision model call.

---

### Role 2: Generative Assistance (Draft & Suggest)
**What it does:** Produces drafts, templates, checklists, and summaries that a human then reviews and confirms — reducing blank-page friction without removing human judgement.

**Where it applies:**
- Voyage agreement drafting from structured voyage data (§8)
- Safety equipment checklist generation based on route and risk level (§3)
- Watch schedule suggestion based on crew count, duration, time zones (§6)
- "What to pack" list generation based on living conditions and route (§5)
- Cost disclosure migration from free-text to structured fields (§4)
- Spec-sheet auto-population of living conditions from make/model (§5)

**Why it matters:** Skippers will not complete lengthy forms before every voyage. If AI can draft 80% of the answer and the skipper just confirms, completion rates for trust-relevant declarations will be dramatically higher.

**Platform fit:** Consistent with the conversational onboarding pattern already in the platform. The same `OnboardingChat` / `submitJob` infrastructure applies.

---

### Role 3: Analytical Risk Assessment (Flag & Score)
**What it does:** Analyses structured data already in the platform — maintenance records, declared equipment, crew experience, voyage risk level, skipper qualifications — and produces risk signals, readiness scores, or compatibility assessments.

**Where it applies:**
- Maintenance gap analysis before voyage publication (§2)
- Age-adjusted vessel readiness for voyage type (§2)
- Safety checklist gap narrative for offshore voyages (§3)
- Qualification sufficiency check against voyage risk level (§7)
- Team experience adequacy check against declared voyage risk (§6)
- Conditions vs. vessel-size plausibility check (§5)
- Fairness and completeness check on cost terms (§4)

**Why it matters:** This role turns existing data into actionable safety intelligence. The platform already holds boat age, equipment records, maintenance history, crew experience, and voyage risk level. An AI layer connecting these can surface risks that neither the skipper nor crew would notice by reviewing fields in isolation.

**Platform fit:** Could run as a background async job triggered when a voyage is moved to "Published" state, producing a readiness report stored against the voyage.

---

### Role 4: Accountability & Moderation (Detect & Classify)
**What it does:** Monitors platform activity and submitted content to detect patterns of misrepresentation, conduct violations, or suspicious behaviour — and assists human moderators with classification and context assembly.

**Where it applies:**
- Review authenticity detection — flag suspicious review patterns (§1)
- Communication tone analysis — detect persistent aggressive language in skipper messages (§1)
- Conduct incident severity classification and routing (§1)
- Unusual clause detection in custom voyage agreements (§8)
- Post-voyage dispute context assembly from stored voyage data (§8)
- Financial dispute context — compare incident report against stored cost agreement (§4)

**Why it matters:** At scale, no human moderation team can review every review, every message, and every agreement clause. AI as a first-pass filter dramatically improves the quality of what reaches human moderators and reduces the response time for serious incidents.

**Platform fit:** Could be implemented as event-triggered async jobs (on review submission, on incident report submission, on agreement publication) rather than continuous monitoring — keeping compute costs bounded.

---

## Priority Matrix (Updated)

| Feature | Impact | Effort | AI-Enabled | Priority |
|---|---|---|---|---|
| Post-voyage mutual review system | Very High | Medium | Review summarisation, authenticity detection | **P1** |
| Structured cost disclosure | Very High | Low | Migration from free-text, fairness check | **P1** |
| Voyage agreement acknowledgement | High | Low | Agreement generation, plain-language explainer | **P1** |
| Structured qualification fields + certificate OCR | High | Low | **Core AI feature** — document extraction | **P1** |
| Safety equipment expiry tracking + pre-voyage gating | High | Medium | Certificate extraction, route-aware checklist | **P2** |
| Boat readiness pre-departure declaration | High | Low | Service doc extraction, maintenance gap analysis | **P2** |
| Structured living conditions (berths, water, connectivity) | High | Low | Spec-sheet auto-population, plausibility check | **P2** |
| Voyage lifestyle policy (watch system, alcohol, duties) | Medium | Low | Watch schedule suggestion | **P2** |
| Crew composition preview | Medium | Low | Team experience assessment | **P2** |
| Conduct incident reporting | High | High | Severity classification, dispute context assembly | **P2** |
| Crew-initiated document request | Medium | Low | — | **P3** |
| Insurance requirement for offshore voyages | Medium | Low | Insurance doc extraction | **P3** |
| Safety summary on voyage listing | Medium | Medium | AI readiness narrative | **P3** |
| Boat interior photo gallery | Low | Low | — | **P3** |
| Trust score aggregation on profiles | Medium | High | Multi-signal AI scoring | **P3** |

---

## Closing Observations

Two patterns stand out across all the failures described in the source document:

**1. Information asymmetry at the point of commitment.**
Crew agreed to join the voyage without structured access to the skipper's qualifications, the boat's maintenance status, the exact financial terms, or the living conditions. The platform currently displays a voyage card and a skipper bio — both of which can be written to present any image the skipper chooses. The highest-leverage intervention is requiring skippers to *declare* structured information (seaworthiness, costs, conditions) before publishing, not after crew commit.

**2. No accountability after the fact.**
The author explicitly chose not to name the skipper publicly — a decision many people make to avoid conflict. But this means the next crew will find the same listing with no warning. A transparent, verified review system — where reviews are attached to real confirmed voyages and cannot be anonymously fabricated — is the single feature most likely to improve platform-wide safety over time. It shifts incentives: skippers with poor conduct accumulate a visible record; skippers with excellent conduct gain a competitive advantage.

**3. AI as friction-reducer, not gatekeeper.**
The most important observation about AI's role here is what it should *not* be: a hard enforcement gate that blocks skippers who haven't completed every field. Overreach in this direction kills supply. Instead, AI should lower the *cost* of doing the right thing — extracting data from documents that already exist, drafting agreements from information already declared, flagging gaps with plain-language explanations rather than hard errors. When declaring information is as easy as uploading a photo, compliance rates rise without coercion.

All three of these observations are achievable with the existing data infrastructure (consent audit log, document vault, async job workers, registration system) and without requiring third-party database integrations.

---

## Prioritized Feature Summary

Ranked by the product of three factors: **safety/trust impact** (how much does this actually prevent a bad experience?) × **effort minimised** (how little must skipper and crew do?) × **AI leverage** (does AI absorb the hard parts?).

Features where AI does the heavy lifting score highest — a photo upload that auto-populates a qualification record is better than a form the skipper must fill manually, because friction determines compliance.

---

### #1 — Post-Voyage Review System with AI-Assisted Moderation

**What it is:** After a voyage ends, both skipper and crew receive a verified review prompt. Reviews are tied to a confirmed booking record and cannot be posted for unverified voyages. AI classifies content for safety issues (aggressive conduct, deception, unsafe conditions) and surfaces aggregated ratings on all profile pages.

| Role | Effort |
|------|--------|
| Skipper | None (passive — receives reviews) |
| Crew | ~3 min to rate + 1–3 sentences |
| Platform AI | Classifies sentiment, flags safety language, detects boilerplate fake reviews |

**Why #1:** The source document's core problem — an aggressive, volatile skipper with no accountability — is directly solved by this feature over time. Even without solving the *current* voyage, a visible review history shifts incentives for every *future* voyage. It also requires the least active effort from skippers (they don't have to do anything), which eliminates adoption resistance.

---

### #2 — AI Skipper Qualification Extraction from Certificate Photos

**What it is:** Skipper uploads a photo of their sailing license, VHF certificate, or first aid card. AI (OCR + LLM extraction) reads the document, extracts issuing authority, license level, and expiry date, and populates the qualification record automatically. The raw document is stored in the document vault for crew to view.

| Role | Effort |
|------|--------|
| Skipper | ~30 seconds per certificate (photo upload) |
| Crew | Zero (data already displayed on profile) |
| Platform AI | OCR → field extraction → validation → profile update |

**Why #2:** The most commonly cited pre-voyage risk in the source text is the inability to verify skipper qualifications. Certificate extraction eliminates both the skipper's effort (no manual form) and the crew's problem (no "trust me" self-declarations). High-leverage AI application on an already-existing document vault infrastructure.

---

### #3 — AI Boat Readiness Narrative from Existing Maintenance Data

**What it is:** When a skipper has completed the boat equipment inventory (already available in the platform), AI synthesises a plain-language "Boat Readiness Summary" paragraph — noting service dates, flagged replacement-likelihood items, and any gaps — and displays it on the voyage listing. Zero additional skipper input required beyond what they've already entered.

| Role | Effort |
|------|--------|
| Skipper | Zero (data already in system from equipment wizard) |
| Crew | Zero (reads the generated paragraph on the voyage card) |
| Platform AI | Synthesises existing structured data → narrative paragraph |

**Why #3:** Requires *no new work* from either party. It converts data the skipper has already entered (which is used for their own maintenance reminders) into a crew-facing trust signal. The source document describes a boat that "was not quite ready" — a readiness narrative makes this visible before commitment rather than after three weeks at sea.

---

### #4 — Structured Cost Disclosure with AI Migration from Free Text

**What it is:** Replace the free-text "contribution details" field with a structured cost form: contribution amount, frequency (per day/week/total), port fees included (yes/no), food included (yes/no), fuel/Starlink surcharges (yes/no), payment timing, method. For skippers with existing free-text descriptions, AI pre-fills the form from their current text so they only need to confirm rather than re-enter.

| Role | Effort |
|------|--------|
| Skipper | ~2 min for new listings; ~30 seconds confirmation for existing (AI pre-fill) |
| Crew | Zero (reads structured table instead of ambiguous text) |
| Platform AI | Parses existing free-text descriptions → pre-populates structured fields |

**Why #4:** Financial disputes are explicitly described in the source document as a source of severe tension mid-voyage. Structured disclosure is non-negotiable for trust — ambiguous free text about "contribution" is how crew end up owing money for repairs, harbour fees, and Starlink subscriptions they didn't anticipate. AI migration from free text removes the single biggest adoption barrier (re-entry burden for existing skippers).

---

### #5 — AI Voyage Agreement Generator

**What it is:** Before a crew application is confirmed, both parties are prompted to review and sign a standard voyage agreement. The agreement is pre-populated from the voyage's structured data (dates, ports, contribution terms, food/accommodation scope, watch schedule). AI fills in the clauses; both parties tap "I agree" with a timestamped consent record stored in the existing consent audit log.

| Role | Effort |
|------|--------|
| Skipper | ~1 min to review pre-filled agreement |
| Crew | ~1 min to review pre-filled agreement |
| Platform AI | Generates agreement text from structured voyage data |

**Why #5:** The source document explicitly recommends signing a mutual indemnity agreement covering conduct standards, financial terms, and responsibilities — and this is precisely the kind of document that never gets signed because drafting it is too much friction for informal sailing arrangements. AI drafting from existing data drops the effort to near zero.

---

### #6 — Safety Equipment Expiry Tracking with AI Certificate Extraction

**What it is:** The equipment inventory gains expiry date fields for life raft, EPIRB, flares, and fire extinguishers. Skippers can upload a service certificate photo; AI extracts the service date and next-due date automatically. Crew see an expiry status on the voyage listing (✓ in date / ⚠ overdue / — not declared).

| Role | Effort |
|------|--------|
| Skipper | ~30 seconds per item (photo upload, same as #2) |
| Crew | Zero (status displayed on listing) |
| Platform AI | OCR on service sticker/certificate → date extraction → expiry calculation |

**Why #6:** Safety equipment status is the single most tangible life-or-death indicator on the list. The source document specifically questions whether MOB and rescue equipment is "working and within date." Photo upload with AI extraction keeps effort minimal; even partial adoption (life raft + EPIRB only) provides meaningful crew-facing signal.

---

### #7 — Route-Aware AI Safety Checklist (Auto-Generated, Zero Effort)

**What it is:** When a skipper publishes a voyage (e.g., Atlantic crossing), AI automatically generates a passage-type-specific checklist — rigging inspection, safety equipment expiry, medical kit, MOB drill plan, watch schedule — based on the declared route and duration. The checklist is displayed to both the skipper (as a pre-departure action list) and crew (as a "What this skipper is expected to verify" section on the listing).

| Role | Effort |
|------|--------|
| Skipper | Zero to see checklist; optional to mark items complete |
| Crew | Zero (reads the generated checklist on the voyage card) |
| Platform AI | Route classification → passage-type template → gap detection vs. equipment inventory |

**Why #7:** No skipper input required beyond the voyage data already entered. A pre-populated checklist shifts the conversation from "I hope everything is fine" to "here are the specific items verified for this passage type." Crew can ask targeted questions; skippers who don't address flagged gaps face a visible disclosure gap on their listing.

---

### #8 — Living Conditions Auto-Population from Boat Spec

**What it is:** When a skipper adds a boat make/model to their profile, AI looks up or infers from registry data the number of berths, headroom, galley configuration, and number of heads. This pre-populates a "living conditions" card on the voyage listing. The skipper can override any value (e.g., "one head out of service") but is not required to fill it from scratch.

| Role | Effort |
|------|--------|
| Skipper | Zero for standard configurations; ~1 min for corrections |
| Crew | Zero (reads pre-populated card on voyage listing) |
| Platform AI | Make/model lookup → spec inference → conditions pre-fill |

**Why #8:** The source document raises bunk size, headroom, toilet function, and fresh water capacity as legitimate pre-voyage concerns. These are structurally predictable from boat specification data — crew deserve access to this information without having to ask in advance. AI makes it available at near-zero skipper cost.

---

### Summary Matrix

| # | Feature | Impact | Skipper Effort | Crew Effort | AI Role |
|---|---------|--------|----------------|-------------|---------|
| 1 | Post-voyage reviews + AI moderation | ★★★★★ | None | Minimal | Accountability & Moderation |
| 2 | Qualification certificate extraction | ★★★★★ | Minimal (photo) | None | Document Intelligence |
| 3 | AI boat readiness narrative | ★★★★☆ | None | None | Generative Assistance |
| 4 | Structured cost disclosure + AI migration | ★★★★☆ | Minimal | None | Generative Assistance |
| 5 | AI voyage agreement generator | ★★★★☆ | Minimal | Minimal | Generative Assistance |
| 6 | Safety equipment expiry + extraction | ★★★★☆ | Minimal (photo) | None | Document Intelligence |
| 7 | Route-aware AI safety checklist | ★★★☆☆ | None | None | Analytical Risk Assessment |
| 8 | Living conditions auto-population | ★★★☆☆ | None | None | Generative Assistance |

The top three features share a common property: **they require zero ongoing effort from skippers** while creating meaningful crew-facing trust signals. This is the highest-leverage quadrant for platform adoption — skippers will not resist features that don't cost them anything, and crew will gain meaningful information that currently doesn't exist anywhere on the platform.
