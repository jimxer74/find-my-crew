---
id: TASK-073
title: Add image carousels
status: In Progress
assignee: []
created_date: '2026-02-02 21:11'
updated_date: '2026-02-03 10:18'
labels: []
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add Image carousel UI compoments for boat images
Add images for Journeys datamodel and update the Journey editing page to enable upload images to Journey
Update LegDetailPanel to show both boat images and journey images in image carousel
<!-- SECTION:DESCRIPTION:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Implementation Plan for Task-073: Add Image Carousels

  Overview

  This task involves adding image carousel UI components for both boat and journey images, updating the Journey editing page to enable
  image uploads, and modifying the LegDetailPanel to display both boat and journey images in an image carousel.

  Technical Approach

  1. Database Schema Updates

  - boats table: Already has images column (text[] array) - no changes needed
  - journeys table: Added images column (text[] array) for journey images
  - Storage policies: Added new journey-images bucket with same permissions as boat-images bucket

  2. Frontend Components

  New Components:
  - ImageCarousel.tsx - Reusable carousel component with navigation, indicators, and keyboard support
  - ImageUpload.tsx - Component for uploading images to journeys with drag-and-drop support

  Updated Components:
  - LegDetailsPanel.tsx - Modified to display both boat and journey images in carousel format
  - EditJourneyPage.tsx - Enhanced with journey image upload functionality
  - BoatFormModal.tsx - Already has boat image upload (no changes needed)

  3. API Endpoints

  New API Routes:
  - GET /api/journeys/[journeyId]/images - Retrieve journey images
  - POST /api/journeys/[journeyId]/images - Upload journey images
  - DELETE /api/journeys/[journeyId]/images/[imageId] - Delete journey images

  Updated API Routes:
  - GET /api/journeys/[journeyId] - Include journey images in response

  4. File Structure

  app/
  ├── components/
  │   ├── ui/
  │   │   └── ImageCarousel.tsx
  │   ├── crew/
  │   │   └── LegDetailsPanel.tsx (modified)
  │   └── manage/
  │       ├── EditJourneyPage.tsx (modified)
  │       └── BoatFormModal.tsx (no changes needed)
  └── api/
      └── journeys/[journeyId]/
          └── images/
              └── route.ts (new)

  Implementation Steps

  Phase 1: Database and Storage Setup

  1. ✅ Database schema already updated in specs/tables.sql
  2. ✅ Storage policies added for journey-images bucket
  3. Deploy database changes to Supabase

  Phase 2: Core Components

  1. Create ImageCarousel.tsx component with:
    - Swipe gestures (mobile)
    - Keyboard navigation
    - Thumbnail navigation
    - Full-screen modal view
    - Loading states and error handling
  2. Create ImageUpload.tsx component with:
    - Drag-and-drop interface
    - Multiple file support
    - Progress indicators
    - Image preview before upload

  Phase 3: API Integration

  1. Implement journey image API endpoints
  2. Update existing journey API to include images
  3. Add proper authentication and authorization
  4. Implement error handling and validation

  Phase 4: UI Integration

  1. Update LegDetailsPanel.tsx to:
    - Display combined boat and journey images
    - Show source indicators (boat vs journey)
    - Maintain existing boat image as fallback
  2. Enhance EditJourneyPage.tsx with:
    - Image upload section
    - Image preview grid
    - Delete functionality

  Phase 5: Testing and Polish

  1. Test image upload functionality
  2. Verify carousel responsiveness
  3. Ensure proper error handling
  4. Add accessibility features
  5. Optimize image loading

  Dependencies and Integration Points

  Existing Systems Integration

  - Supabase Storage: Leverage existing boat image upload infrastructure
  - Auth Context: Use existing authentication for image operations
  - Supabase Client: Reuse existing Supabase client configuration
  - Database: Extend existing journey data model

  Reusable Components

  - ImageCarousel will be designed for reuse across the application
  - ImageUpload component can be adapted for other entities
  - Follow existing component patterns and styling conventions

  Technical Considerations

  Performance

  - Lazy loading for carousel images
  - Optimized image sizes for different screen sizes
  - Efficient storage management

  Security

  - Proper file type validation
  - Size limits and virus scanning
  - User permission validation

  User Experience

  - Smooth transitions and animations
  - Intuitive navigation controls
  - Mobile-friendly touch interactions
  - Clear visual feedback for uploads

  Files to Create/Modify

  New Files:
  - app/components/ui/ImageCarousel.tsx
  - app/components/ui/ImageUpload.tsx
  - app/api/journeys/[journeyId]/images/route.ts

  Modified Files:
  - app/components/crew/LegDetailsPanel.tsx
  - app/owner/journeys/[journeyId]/edit/page.tsx

  This implementation plan provides a comprehensive approach to adding image carousel functionality while maintaining consistency with
  the existing codebase architecture and patterns.
<!-- SECTION:PLAN:END -->
