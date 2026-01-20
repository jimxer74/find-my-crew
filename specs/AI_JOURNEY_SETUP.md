# AI Journey Generation - Test Setup

This is a simple test implementation for AI-generated journeys using Google Gemini API (free tier).

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

This will install the `@google/generative-ai` package.

### 2. Get Google Gemini API Key

1. Go to https://makersuite.google.com/app/apikey
2. Sign in with your Google account
3. Click "Create API Key"
4. Copy the API key

### 3. Add API Key to Environment Variables

Add this line to your `.env.local` file:

```
GOOGLE_GEMINI_API_KEY=your_api_key_here
```

### 4. Restart Your Dev Server

```bash
npm run dev
```

## How to Use

1. Go to `/owner/journeys` page
2. Click the "🤖 Generate with AI (Test)" button
3. Select a boat
4. Enter start location (e.g., "Barcelona, Spain")
5. Enter end location (e.g., "Palma, Mallorca")
6. Click "Generate Journey"
7. Review the generated journey and legs
8. Click "Accept & Create Journey" to save it

## Current Limitations (Test Version)

- **Simple criteria**: Only start and end locations
- **Approximate coordinates**: Uses hardcoded coordinates for common locations
- **2-3 legs**: AI generates 2-3 legs maximum
- **No geocoding**: Location names are matched to approximate coordinates

## Testing Locations

The test version includes approximate coordinates for these common sailing locations:
- Barcelona
- Palma / Mallorca
- Valencia
- Ibiza
- Marseille
- Monaco
- Nice
- Cannes
- Saint-Tropez
- Porto
- Lisbon
- Malaga
- Gibraltar

For other locations, it defaults to Mediterranean center coordinates.

## Next Steps (Future Enhancements)

- Add proper geocoding service integration
- Add more criteria (journey type, dates, preferences)
- Add journey style selection (leisurely vs delivery)
- Add preference options (historical sights, nature, etc.)
- Improve coordinate accuracy
- Add map preview of generated route

## Troubleshooting

**Error: "Google Gemini API key not configured"**
- Make sure you've added `GOOGLE_GEMINI_API_KEY` to `.env.local`
- Restart your dev server after adding the key

**Error: "Failed to generate journey"**
- Check your API key is valid
- Check you haven't exceeded the free tier limits (15 requests/minute)
- Check the browser console for detailed error messages

**Invalid coordinates**
- The test version uses approximate coordinates
- For accurate results, use the predefined location names listed above
