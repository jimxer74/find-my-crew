# Review: Propose Journey Flow and How Coordinates Are Resolved

## Overview

**Propose Journey** (`/owner/journeys/propose`) is a form-based flow: the user picks a boat, selects start/end (and optional waypoints) via **location autocomplete**, optionally sets dates and options, then clicks **Generate**. The app calls `/api/ai/generate-journey` with **already-resolved coordinates** from the UI. There is no “approximate lat/lng” step in the backend for this flow—coordinates are resolved **client-side** before the API is called.

---

## 1. Propose Journey flow (high level)

1. **Load** – Page loads; boats are fetched for the authenticated owner.
2. **Form** – User selects boat, start location, end location (and optionally intermediate waypoints, start/end dates, speed planning, waypoint density).
3. **Validation** – “Generate” is only allowed when:
   - Boat is selected.
   - Start and end **locations have valid coordinates** (`lat !== 0 && lng !== 0`).
   - Any intermediate waypoints also have valid coordinates.
4. **Generate** – `POST /api/ai/generate-journey` with `boatId`, `startLocation: { name, lat, lng }`, `endLocation: { name, lat, lng }`, optional `intermediateWaypoints`, dates, etc.
5. **Result** – Response is shown (journey name, description, risk level, legs with waypoints). User can **Accept** to persist the journey and legs (and waypoints) to the DB, then is redirected to the journey’s legs page.

So in this flow, **every location sent to the API already has `lat` and `lng`**; they come from the UI, not from the AI or from “approximate” resolution in the propose flow itself.

---

## 2. How coordinates are resolved: `LocationAutocomplete`

Propose Journey uses **`LocationAutocomplete`** (`app/components/ui/LocationAutocomplete.tsx`) for:

- Start location  
- End location  
- Each intermediate waypoint  

The component exposes `Location`: `{ name, lat, lng, ... }`. The user types, gets suggestions, and **must pick a suggestion** to set the location. Picking a suggestion is what sets `lat` and `lng`.

### 2.1 Two sources of coordinates

**A) Mapbox Search Box API (places)**

- **Suggest:** As the user types (≥2 chars, debounced 300ms), the component calls Mapbox **suggest** (`/search/searchbox/v1/suggest`) and shows place suggestions (with `mapbox_id`).
- **Retrieve:** When the user **clicks a suggestion**, the component calls Mapbox **retrieve** (`/search/searchbox/v1/retrieve/{mapbox_id}`) to get the full feature; `feature.geometry.coordinates` gives `[lng, lat]`.
- That `lat`/`lng` (and a display name from the feature) are passed to the parent via `onChange(location)`. So for Mapbox, **coordinates are resolved by Mapbox**, not by the user or by “approximate” logic in our app.

**B) Predefined cruising regions** (`app/lib/geocoding/locations.ts`)

- The same autocomplete also searches **LOCATION_REGISTRY** (and aliases) for sailing regions (e.g. “Mediterranean”, “San Blas” if present).
- Matches are shown as “Cruising location” suggestions.
- When the user selects a **cruising region**, the component does **not** call Mapbox. It uses the region’s **bbox** and sets:
  - `lat` = center of bbox: `(bbox.minLat + bbox.maxLat) / 2`
  - `lng` = center of bbox: `(bbox.minLng + bbox.maxLng) / 2`
- So for cruising regions, **coordinates are “approximate” in the sense** that they are the **center of the region’s bounding box**, not a specific port or address. They are still resolved **in the frontend** when the user selects a suggestion.

### 2.2 What happens if the user only types and does not select?

- If the user types “Port Antonio, Jamaica” but **does not click a suggestion**, the input shows that text but the component does **not** call `onChange` with coordinates.
- The parent keeps `startLocation` as `{ name: '...', lat: 0, lng: 0 }` (or similar from `onInputChange` that only updates `name` and clears lat/lng).
- Propose Journey then **blocks Generate**: it requires `startLocation.lat !== 0 && startLocation.lng !== 0` (and same for end). So **coordinates are required** and are only set when the user **selects** from autocomplete (Mapbox or cruising region).

So in Propose Journey there is **no server-side or AI “approximate” resolution**: resolution is entirely **client-side**, via Mapbox or cruising-region bbox center, at the moment the user selects a suggestion.

---

## 3. Data flow summary

| Step | Where | How coordinates are set |
|------|--------|---------------------------|
| User types location | `LocationAutocomplete` | Only name is updated; lat/lng stay 0 until a suggestion is selected. |
| User selects Mapbox suggestion | `LocationAutocomplete` → Mapbox retrieve | `lat`/`lng` from `feature.geometry.coordinates`. |
| User selects cruising region | `LocationAutocomplete` → LOCATION_REGION bbox | `lat`/`lng` = bbox center. |
| Click Generate | Propose page | Requires `lat !== 0 && lng !== 0` for start/end (and waypoints). |
| `POST /api/ai/generate-journey` | Propose page | Sends `startLocation: { name, lat, lng }`, `endLocation: { name, lat, lng }`, etc. |
| `generateJourneyRoute()` | `app/lib/ai/generateJourney.ts` | Receives already-filled locations; uses them in the prompt and for validation. Journey AI then refines waypoint geocodes in its reply. |

So **approximate lat/lng in the Propose Journey flow** means only:

- For **cruising regions**: the coordinates are the **bbox center** (approximate for the region), not a specific point.
- For **Mapbox places**: the coordinates are whatever Mapbox returns for that place (not “approximate” in our code).

There is no separate “resolve name → approximate lat/lng” step in the backend for Propose Journey; the backend always receives concrete numbers from the client.

---

## 4. Contrast with Owner Chat flow

- **Owner Chat:** The user says something like “Create my journey from Port Antonio, Jamaica to San Blas, Panama, Feb 11–Jun 30, 2026.” There is no `LocationAutocomplete`; the model must call `generate_journey_route` with `startLocation` and `endLocation` including `lat` and `lng`. So we instructed the **AI** to supply **approximate coordinates from its own knowledge** and not to ask the user for latitude/longitude. Resolution is effectively “in the model’s head” plus the journey-generation AI in `generateJourney.ts` which can refine waypoint coordinates in the returned legs.
- **Propose Journey:** The user selects locations in the UI; **coordinates are resolved by the UI** (Mapbox or cruising-region bbox) before any API call. The backend does not need to “resolve” names to approximate coordinates; it just uses what the client sent.

So the two flows are consistent in that both end up calling the same `generateJourneyRoute` with `{ name, lat, lng }` per location; they differ only in **who** supplies the coordinates: **Owner Chat** = AI from geography knowledge; **Propose Journey** = client via LocationAutocomplete (Mapbox or cruising-region center).
