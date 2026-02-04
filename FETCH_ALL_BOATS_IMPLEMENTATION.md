# fetch_all_boats AI Tool Implementation

## Overview

The `fetch_all_boats` tool allows both owners and crew to fetch boat information from the database with role-based access control and comprehensive filtering options.

## Implementation Details

### Tool Definition (`tools.ts`)

```typescript
{
  name: 'fetch_all_boats',
  description: 'Fetch boats available to the current user. For owners: returns their own boats. For crew: returns all boats with published journeys. Includes comprehensive boat information including performance metrics and images.',
  parameters: {
    type: 'object',
    properties: {
      limit: {
        type: 'number',
        description: 'Maximum number of boats to return (default 50)',
      },
      includePerformance: {
        type: 'boolean',
        description: 'Include detailed performance metrics and calculations',
        default: false,
      },
      boatType: {
        type: 'string',
        description: 'Filter by boat type/category',
        enum: ['Daysailers', 'Coastal cruisers', 'Traditional offshore cruisers', 'Performance cruisers', 'Multihulls', 'Expedition sailboats'],
      },
      homePort: {
        type: 'string',
        description: 'Filter by home port location',
      },
      includeImages: {
        type: 'boolean',
        description: 'Include boat image URLs',
        default: true,
      },
    },
  },
}
```

### Function Implementation (`toolExecutor.ts`)

The `fetchAllBoats` function implements the following logic:

1. **Role Detection**: Checks if the user has 'owner' role from their profile
2. **Data Query**:
   - **Owners**: Query boats table filtered by `owner_id`
   - **Crew**: Query boats joined with journeys where `journeys.state = 'Published'`
3. **Filtering**: Apply filters for boat type and home port
4. **Response Processing**: Filter fields based on permissions and user preferences
5. **Result Enhancement**: Add context fields like `published_journeys_count` for crew users

## Access Control

### Owner Users
- **Access**: All boats owned by the user
- **Query**: `SELECT * FROM boats WHERE owner_id = userId`
- **Fields**: All boat information available
- **Context**: No additional journey context needed

### Crew Users
- **Access**: Only boats with published journeys
- **Query**: `SELECT boats.* FROM boats INNER JOIN journeys ON journeys.boat_id = boats.id WHERE journeys.state = 'Published'`
- **Fields**: All public boat information
- **Context**: Additional `published_journeys_count` field

## Field Filtering

### Always Included
- Basic boat identification: `id`, `name`, `type`, `make`, `model`, `capacity`, `home_port`, `country_flag`
- Basic performance metrics: `loa_m`, `lwl_m`, `beam_m`, `max_draft_m`, `displcmt_m`
- Descriptions: `characteristics`, `capabilities`, `accommodations`

### Conditional Inclusion
- **Performance metrics**: Only when `includePerformance = true`
  - `sail_area_sqm`, `average_speed_knots`, `sa_displ_ratio`, `ballast_displ_ratio`, `displ_len_ratio`, `cbr`, `hsc`, `dsf`
- **Images**: Only when `includeImages = true` (default)
  - `images` array
- **Journey context**: Only for crew users
  - `published_journeys_count`

## Usage Examples

### Basic Usage
```typescript
// Get up to 50 boats (owner sees own boats, crew sees boats with published journeys)
{
  "name": "fetch_all_boats",
  "arguments": {}
}
```

### Filtered Search
```typescript
// Get coastal cruisers with full performance data
{
  "name": "fetch_all_boats",
  "arguments": {
    "limit": 20,
    "boatType": "Coastal cruisers",
    "includePerformance": true,
    "includeImages": true
  }
}
```

### Location Filter
```typescript
// Find boats in Mediterranean region
{
  "name": "fetch_all_boats",
  "arguments": {
    "limit": 10,
    "homePort": "Mediterranean",
    "includePerformance": true
  }
}
```

## Database Schema Dependencies

### Required Tables
- `public.profiles` - User profiles with roles
- `public.boats` - Boat information (main table)
- `public.journeys` - Journey information (for crew access control)

### Required RLS Policies
- `boats`: Public SELECT access (already implemented)
- `profiles`: User access to own profile (already implemented)
- `journeys`: Published journeys visible to all (already implemented)

### Performance Considerations
- **Indexes**: Ensure proper indexing on `boats.owner_id`, `journeys.boat_id`, `journeys.state`
- **Pagination**: Always use `limit` parameter to prevent large result sets
- **Filtering**: Use database-level filtering before application-level processing

## Testing

### Unit Tests ✅
- ✅ Test owner vs crew access patterns
- ✅ Test parameter filtering (boatType, homePort)
- ✅ Test performance metric inclusion/exclusion
- ✅ Test image field handling

### Integration Tests ✅
- ✅ Test with real database data
- ✅ Verify RLS policy compliance
- ✅ Test tool execution in AI assistant context

### User Scenarios ✅
- ✅ Owner viewing their boats with performance metrics
- ✅ Crew browsing available boats with journey information
- ✅ Filtered searches by boat type and location
- ✅ Image display in boat listings

## Error Handling

### Validation
- Validate enum values for `boatType`
- Validate numeric limits for `limit` parameter
- Handle missing user profile gracefully

### Error Responses
- Clear error messages for permission issues
- Graceful handling of database query failures
- Fallback responses for empty results

## Security Considerations

### Data Privacy
- Sensitive owner-only data is automatically filtered for crew users
- Images are only included when explicitly requested
- Performance metrics are optional to reduce data exposure

### Access Control
- Role verification happens server-side, not client-side
- Database queries respect RLS policies
- No sensitive fields are exposed to unauthorized users

## Future Enhancements

### Potential Improvements
- Add more filtering options (size range, capacity range, etc.)
- Implement caching for frequently accessed boat lists
- Add sorting options (by name, capacity, etc.)
- Support for boat availability dates

### Integration Opportunities
- Link with journey planning tools
- Integrate with boat comparison features
- Add boat recommendation engine
- Support for boat favorites/bookmarks