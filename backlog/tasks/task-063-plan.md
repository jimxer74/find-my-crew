# Task-063 Implementation Plan: Journey Cost Management

## Overview
Implement a comprehensive cost management system for journeys and legs that supports multiple cost-sharing models between boat owners and crew members. This system will allow transparent tracking and splitting of costs across different voyage types.

## Requirements Analysis

### Core Cost Models to Support
1. **Shared Contribution Model** - Costs split among crew/owner
2. **Owner Covers All Costs** - Free passage for crew
3. **Crew Pays a Fee** - Fixed daily/total fee
4. **Delivery/Paid Crew** - Professional crew receives compensation
5. **To be Agreed** - Undefined model for later negotiation

### Cost Categories to Track
- **Provisioning**: Food, water, supplies
- **Fuel & Gas**: Diesel, petrol, gas
- **Mooring/Berthing**: Marina fees, anchorage
- **Permits & Licenses**: Entry fees, fishing permits, park fees
- **Insurance**: Additional coverage, liability
- **Repairs & Maintenance**: Emergency repairs, routine maintenance
- **Travel Costs**: Crew transport to/from boat
- **Miscellaneous**: Laundry, internet, entertainment

## Implementation Plan

### Phase 1: Database Schema Design

#### 1.1 New Tables Required
- `journey_cost_models` - Define cost sharing models for journeys
- `journey_expenses` - Track individual expense items
- `journey_contributions` - Track payments/commitments from crew/owner
- `expense_categories` - Standardized expense categories
- `expense_splits` - How expenses are divided among participants

#### 1.2 Modified Tables
- `journeys` - Add cost_model_id reference
- `users` - Add financial contribution tracking fields
- `profiles` - Add cost preferences and payment methods

### Phase 2: Backend API Implementation

#### 2.1 Core Endpoints
- `POST /api/journeys/:id/cost-model` - Set cost model for journey
- `GET /api/journeys/:id/cost-breakdown` - Get detailed cost analysis
- `POST /api/journeys/:id/expenses` - Add new expense
- `GET /api/journeys/:id/expenses` - List all expenses
- `POST /api/journeys/:id/contributions` - Record payment/contribution
- `GET /api/users/:id/financial-summary` - User's cost summary

#### 2.2 Business Logic
- Cost calculation algorithms for each model
- Expense validation and categorization
- Contribution tracking and reconciliation
- Multi-currency support
- Cost estimation based on route/distance

### Phase 3: Frontend Components

#### 3.1 User Interface Components
- `CostModelSelector` - Choose cost sharing model for journey
- `ExpenseForm` - Add and categorize expenses
- `CostBreakdownView` - Visual representation of cost distribution
- `PaymentTracker` - Track contributions and outstanding balances
- `CostEstimator` - Estimate costs based on journey details

#### 3.2 Integration Points
- Journey creation wizard integration
- Profile dashboard cost summary
- Notification system for payment reminders
- Mobile-responsive design

### Phase 4: Features & Functionality

#### 4.1 Cost Management Features
- **Real-time Cost Tracking** - Live updates as expenses are added
- **Automated Cost Splitting** - Based on selected model
- **Payment Reminders** - Automated notifications for outstanding balances
- **Cost History** - Track costs across multiple journeys
- **Budget Management** - Set and track cost limits

#### 4.2 Advanced Features
- **Multi-currency Support** - Handle international voyages
- **Expense Approval Workflow** - Owner approval for crew-added expenses
- **Cost Analytics** - Insights into spending patterns
- **Integration with Payment Systems** - PayPal, Stripe for actual payments
- **Export Functionality** - Generate cost reports

### Phase 5: Validation & Security

#### 5.1 Data Validation
- Expense amount validation
- Currency format validation
- Contribution limit enforcement
- Duplicate expense detection

#### 5.2 Access Control
- Owner-only expense approval
- Crew contribution visibility
- Financial data privacy controls
- Audit logging for financial transactions

### Phase 6: Testing Strategy

#### 6.1 Test Coverage
- Unit tests for cost calculation algorithms
- Integration tests for API endpoints
- UI component testing
- End-to-end journey cost flow testing
- Performance testing for large expense datasets

#### 6.2 Test Scenarios
- Different cost model calculations
- Currency conversion accuracy
- Concurrent expense additions
- Payment workflow validation

## Technical Considerations

### Database Design Principles
- **Normalisation**: Separate expense categories from actual expenses
- **Flexibility**: Support for custom expense categories
- **Audit Trail**: Track all financial changes
- **Performance**: Index frequently queried fields

### API Design Principles
- **RESTful**: Follow REST conventions
- **HATEOAS**: Include links for related resources
- **Pagination**: Handle large expense lists
- **Filtering**: Support for date ranges, categories

### Frontend Architecture
- **State Management**: Use Redux/Zustand for cost data
- **Real-time Updates**: WebSocket for live cost updates
- **Offline Support**: Cache expenses for offline access
- **Accessibility**: WCAG compliant cost displays

## Implementation Timeline

### Week 1-2: Database & Backend Foundation
- Design and implement database schema
- Create core API endpoints
- Implement basic cost calculation logic

### Week 3-4: Frontend Components
- Build cost management UI components
- Integrate with existing journey creation flow
- Add basic expense tracking functionality

### Week 5: Advanced Features
- Implement payment tracking and reminders
- Add multi-currency support
- Create cost analytics and reporting

### Week 6: Testing & Polish
- Comprehensive testing across all features
- Performance optimization
- User experience refinements

## Success Criteria

### Functional Requirements
- [ ] All 5 cost models supported and functional
- [ ] Real-time cost tracking across all models
- [ ] Expense categorization and validation working
- [ ] Contribution tracking and reconciliation accurate
- [ ] Multi-currency support operational

### Non-Functional Requirements
- [ ] API response time < 200ms for cost queries
- [ ] Support for 1000+ expenses per journey
- [ ] Mobile-responsive cost management interface
- [ ] 99.9% accuracy in cost calculations
- [ ] Complete audit trail for financial transactions

### User Experience Requirements
- [ ] Cost setup completed in < 3 minutes
- [ ] Expense addition in < 30 seconds
- [ ] Clear visualization of cost distribution
- [ ] Intuitive payment tracking interface
- [ ] Seamless integration with journey workflow

## Risk Mitigation

### Technical Risks
- **Currency Fluctuations**: Implement real-time exchange rates
- **Data Consistency**: Use database transactions for financial operations
- **Performance**: Implement caching for frequently accessed cost data

### Business Risks
- **Regulatory Compliance**: Research maritime financial regulations
- **User Adoption**: Provide clear guidance on cost model selection
- **Payment Integration**: Partner with established payment providers

## Dependencies

### External Services
- Currency exchange rate API
- Payment processing integration (Stripe/PayPal)
- Email service for payment reminders

### Internal Dependencies
- User authentication system
- Journey management system
- Profile system for financial preferences

## Future Enhancements

### Phase 2 Features (Post-MVP)
- Automated expense categorization using AI
- Integration with marine supply catalogs
- Cost comparison across similar journeys
- Advanced budgeting and forecasting tools
- Crew rating system for financial reliability

### Integration Opportunities
- Marine insurance providers
- Yacht charter companies
- Marine supply vendors
- Port authority systems