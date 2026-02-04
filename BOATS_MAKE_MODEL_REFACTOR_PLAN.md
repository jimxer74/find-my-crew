# Boats Table Make/Model Refactoring Plan

## Overview

This document outlines the comprehensive plan to refactor the boats table by combining the make and model fields into a single make_model field.

## Current State Analysis

From codebase exploration, the current situation is:

1. **Database Schema**: The boats table already has a `make_model` field (specs/tables.sql line 150)
2. **Existing Migration**: Migration 017_combine_make_model_to_make_model.sql exists showing the intended approach
3. **UI Components**: BoatFormModal and NewBoatWizard already use the combined `make_model` field
4. **Database Function**: `get_legs_in_viewport` returns `boat_make_model`
5. **Legacy References**: Multiple components still reference separate `make` and `model` fields with complex UI logic

## Required Changes

### 1. Database Changes

- [ ] Verify existing `make_model` field is properly populated and indexed
- [ ] **CRITICAL**: Remove separate `make` and `model` columns from boats table (they still exist in database but not in schema)
- [ ] Confirm migration 017 has been applied correctly
- [ ] Ensure `boats_make_model_idx` index exists for performance
- [ ] Update migration 017 to DROP the old make/model columns
- [ ] Update migration 009 to use `boat_make_model` instead of separate fields

### 2. UI Logic Code Changes

#### High Priority Components with Complex Logic

**RegistrationSummaryModal.tsx (lines 433-437):**

Current Logic:
```typescript
{(data.boat.make || data.boat.model) && (
  <p className="text-sm text-muted-foreground">
    {data.boat.make && data.boat.model
      ? `${data.boat.make} ${data.boat.model}`
      : data.boat.make || data.boat.model || ''}
  </p>
)}
```

New Logic:
```typescript
{(data.boat.make_model) && (
  <p className="text-sm text-muted-foreground">
    {data.boat.make_model}
  </p>
)}
```

**LegMobileCard.tsx (lines 158-160):**

Current Logic:
```typescript
{(leg.boat_make || leg.boat_model) && (
  <p className="text-sm text-muted-foreground">
    {leg.boat_make && leg.boat_model ? `${leg.boat_make} ${leg.boat_model}` : leg.boat_make || leg.boat_model}
  </p>
)}
```

New Logic:
```typescript
{leg.boat_make_model && (
  <p className="text-sm text-muted-foreground">
    {leg.boat_make_model}
  </p>
)}
```

**crew/registrations/page.tsx (lines 290-294):**

Current Logic:
```typescript
{(registration.boat_make || registration.boat_model) && (
  <div className="text-sm text-muted-foreground">
    {registration.boat_make && registration.boat_model
      ? `${registration.boat_make} ${registration.boat_model}`
      : registration.boat_make || registration.boat_model || ''}
  </div>
)}
```

New Logic:
```typescript
{registration.boat_make_model && (
  <div className="text-sm text-muted-foreground">
    {registration.boat_make_model}
  </div>
)}
```

**owner/boats/page.tsx (lines 163-165):**

Current Logic:
```typescript
{boat.make && boat.model && (
  <div className="text-sm text-muted-foreground">
    {boat.make} {boat.model}
  </div>
)}
```

New Logic:
```typescript
{boat.make_model && (
  <div className="text-sm text-muted-foreground">
    {boat.make_model}
  </div>
)}
```

**AI Assistant Context (lines 225-226):**

Current Logic:
```typescript
if (boat.make || boat.model) {
  prompt += ` (${[boat.make, boat.model].filter(Boolean).join(' ')})`;
}
```

New Logic:
```typescript
if (boat.make_model) {
  prompt += ` (${boat.make_model})`;
}
```

### 3. API Routes & Backend Changes

#### API registration details route:
- Update field selection to include `make_model` instead of separate fields
- Modify TypeScript interfaces to use `make_model`

#### AI Assistant Tool Executor:
- Update database queries to select `make_model` field
- Remove references to separate `make`/`model` fields

### 4. Testing Files

#### test_sql_queries.sql:
- Update GROUP BY clauses to use `make_model` instead of separate `make`/`model` fields
- Update any WHERE clauses that filter by make/model

## Migration Strategy

### Phase 1: Database Cleanup (45 minutes) - UPDATED

- [ ] **CRITICAL**: Drop separate `make` and `model` columns from boats table
- [ ] Update migration 017 to include DROP COLUMN statements for old columns
- [ ] Update migration 009 to use `boat_make_model` instead of separate fields
- [ ] Verify `make_model` field contains correct data
- [ ] Confirm index `boats_make_model_idx` exists
- [ ] Test that boats table only has `make_model` field

### Phase 2: UI Logic Updates (3-4 hours)
- [ ] Update RegistrationSummaryModal.tsx conditional logic
- [ ] Update LegMobileCard.tsx conditional logic
- [ ] Update crew/registrations/page.tsx conditional logic
- [ ] Update owner/boats/page.tsx conditional logic
- [ ] Update AI assistant context logic
- [ ] Test all UI components with various data scenarios

### Phase 3: API & Backend Updates (2-3 hours)
- [ ] Update API routes to serve `make_model` instead of separate fields
- [ ] Update AI assistant tool executor database queries
- [ ] Update any internal queries that reference separate fields
- [ ] Update TypeScript interfaces and types

### Phase 4: Testing & Deployment (2-3 hours)
- [ ] Unit tests for all updated components
- [ ] Integration tests for API responses
- [ ] End-to-end tests for boat creation and display flows
- [ ] Performance tests for make_model field queries
- [ ] Deploy changes with monitoring

## Testing Approach

### UI Component Testing
- [ ] Test conditional rendering with `make_model` field
- [ ] Test empty/null `make_model` scenarios
- [ ] Test display formatting and styling
- [ ] Test edge cases (special characters, long names)

### Integration Testing
- [ ] Test API responses include correct `make_model` field
- [ ] Test database queries return proper data
- [ ] Test AI assistant context building
- [ ] Test data flow from database to UI

### Data Integrity Testing
- [ ] Verify no data loss during transition
- [ ] Test that separate make/model columns are properly removed
- [ ] Test that make_model field contains correct concatenated data
- [ ] Test edge cases (null values, empty strings, special characters)
- [ ] Verify existing migration 017 works correctly
- [ ] Test rollback scenarios

### Performance Testing
- [ ] Ensure queries on `make_model` are efficient
- [ ] Test index usage on `make_model` field
- [ ] Verify no performance regression
- [ ] Test query optimization

## Rollback Plan

### Database Rollback
- If issues arise, migration 017 can be reviewed/modified
- `make_model` field can be safely modified without data loss
- Document rollback procedure for database changes

### Code Rollback
- Changes are primarily field name updates, easily reversible
- UI logic changes are straightforward to revert
- Maintain backup of original conditional logic

### Data Migration Rollback
- Existing migration 017 can be rolled back if needed
- Data integrity maintained throughout transition
- Test rollback procedure in development environment

## Success Criteria

- [ ] All UI components display boat make/model correctly using `make_model`
- [ ] Complex conditional rendering logic simplified to use single field
- [ ] API responses use consistent field naming
- [ ] AI assistant context uses combined field
- [ ] **CRITICAL**: Separate make/model columns removed from boats table
- [ ] Database functions use `boat_make_model` instead of separate fields
- [ ] Migration 017 updated to include DROP COLUMN statements
- [ ] Migration 009 updated to use combined field
- [ ] No broken functionality in boat management features
- [ ] Performance maintained or improved
- [ ] Data integrity preserved throughout transition
- [ ] All tests pass with updated code

## Risk Assessment

- **Low Risk**: UI component updates (cosmetic changes with clear mapping)
- **Medium Risk**: API route updates (affects data consumers)
- **Low Risk**: AI assistant updates (internal tooling)
- **Low Risk**: Database changes (field already exists, migration exists)

## Timeline Estimate

- **Phase 1 (Database Verification)**: 30 minutes
- **Phase 2 (UI Logic Updates)**: 3-4 hours (due to complex conditional logic)
- **Phase 3 (API & Backend Updates)**: 2-3 hours
- **Phase 4 (Testing & Deployment)**: 2-3 hours
- **Total Estimated Time**: 8-11 hours

## Implementation Priority

1. **High Priority**: Update UI components with complex conditional logic
2. **High Priority**: Update API routes that serve boat data
3. **Medium Priority**: Update AI assistant and internal tools
4. **Low Priority**: Update documentation and comments

## Key UI Logic Considerations

The most critical aspect is updating the complex conditional rendering logic in components. The current code has sophisticated logic to handle cases where:
- Only make exists
- Only model exists
- Both make and model exist
- Neither exists

This needs to be simplified to check for the existence of the single `make_model` field, which should contain the properly formatted combined value.

The refactoring will:
- Simplify conditional logic significantly
- Reduce code complexity
- Improve maintainability
- Ensure consistent data handling across the application