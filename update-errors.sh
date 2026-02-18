#!/bin/bash
# Batch update script for error sanitization across API routes

# Color codes for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Error Sanitization Batch Update${NC}"
echo "================================"

# Routes to update - prioritized by impact
PRIORITY_ROUTES=(
  "app/api/journeys/[journeyId]/auto-approval/route.ts"
  "app/api/journeys/[journeyId]/images/route.ts"
  "app/api/journeys/[journeyId]/requirements/route.ts"
  "app/api/journeys/[journeyId]/requirements/[requirementId]/route.ts"
  "app/api/registrations/owner/all/route.ts"
  "app/api/registrations/crew/details/route.ts"
  "app/api/registrations/by-journey/[journeyId]/route.ts"
  "app/api/registrations/[registrationId]/details/route.ts"
  "app/api/registrations/[registrationId]/answers/route.ts"
)

UPDATE_COUNT=0

for route in "${PRIORITY_ROUTES[@]}"; do
  if [ -f "$route" ]; then
    echo -e "${GREEN}✓ Updating: $route${NC}"

    # Check if already has imports
    if ! grep -q "sanitizeErrorResponse" "$route"; then
      # Add imports if not present
      sed -i "1,5s/^import { NextResponse }/import { sanitizeErrorResponse } from '@\/app\/lib\/errorResponseHelper';\nimport { logger } from '@\/app\/lib\/logger';\nimport { NextResponse }/" "$route"
      echo "  → Added imports"
    fi

    # Replace error.message patterns
    sed -i "s/{ error: '\([^']*\)', details: error\.message }/sanitizeErrorResponse(error, '\1')/g" "$route"
    sed -i "s/{ error: '\([^']*\)', details: error instanceof Error ? error\.message : \(.*\) }/sanitizeErrorResponse(error, '\1')/g" "$route"

    # Replace console.error with logger.error for catch blocks
    sed -i "s/console\.error('Unexpected error/logger.error('Request failed/g" "$route"

    UPDATE_COUNT=$((UPDATE_COUNT + 1))
  fi
done

echo ""
echo -e "${GREEN}Updated ${UPDATE_COUNT} high-priority routes${NC}"
echo "Next: Verify build and test critical endpoints"
