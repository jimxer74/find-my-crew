---
id: TASK-023
title: Notifications and Communications
status: In Progress
assignee: []
created_date: '2026-01-24 11:40'
updated_date: '2026-01-24 13:48'
labels: []
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Goal: Automate user communication and reduce manual follow-ups

Features:

Real-time In-app notifications
Email notifications: For important events
In-app notification center: Bell icon with unread count
Notification types:
Registration approved/denied (to crew) email and in-app
New registration received (to owner) email and in-app
Journey or leg updated email and in-app
Profile completion reminders email and in-app
<!-- SECTION:DESCRIPTION:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Phase 1: Database Schema & Core Infrastructure

### 1.1 Database Schema
Create Supabase migration for notifications table:

```sql
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT,
  link VARCHAR(500),
  read BOOLEAN DEFAULT false,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_user_unread ON notifications(user_id, read) WHERE read = false;
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);

-- Enable Row Level Security
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own notifications
CREATE POLICY "Users can view own notifications" ON notifications
  FOR SELECT USING (auth.uid() = user_id);

-- Policy: Users can update (mark read) their own notifications
CREATE POLICY "Users can update own notifications" ON notifications
  FOR UPDATE USING (auth.uid() = user_id);
```

### 1.2 Email Preferences Table (Optional Enhancement)
```sql
CREATE TABLE email_preferences (
  user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  registration_updates BOOLEAN DEFAULT true,
  journey_updates BOOLEAN DEFAULT true,
  profile_reminders BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

---

## Phase 2: Notification Service Layer

### 2.1 Core Notification Service
**File: `app/lib/notifications/service.ts`**

Functions to implement:
- `createNotification(userId, type, title, message, link?, metadata?)` - Creates in-app notification
- `getUnreadCount(userId)` - Returns count of unread notifications
- `getNotifications(userId, limit?, offset?)` - Paginated notification list
- `markAsRead(notificationId, userId)` - Mark single notification read
- `markAllAsRead(userId)` - Mark all notifications read for user
- `deleteNotification(notificationId, userId)` - Delete a notification

### 2.2 Notification Types Enum
**File: `app/lib/notifications/types.ts`**

```typescript
export enum NotificationType {
  REGISTRATION_APPROVED = 'registration_approved',
  REGISTRATION_DENIED = 'registration_denied',
  NEW_REGISTRATION = 'new_registration',
  JOURNEY_UPDATED = 'journey_updated',
  LEG_UPDATED = 'leg_updated',
  PROFILE_REMINDER = 'profile_reminder',
  AI_AUTO_APPROVED = 'ai_auto_approved',
  AI_REVIEW_NEEDED = 'ai_review_needed',
}

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  message: string | null;
  link: string | null;
  read: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
}
```

### 2.3 Email Service Integration
**File: `app/lib/notifications/email.ts`**

Using Resend (already in project) or similar:
- `sendRegistrationApprovedEmail(userEmail, journeyDetails)`
- `sendRegistrationDeniedEmail(userEmail, journeyDetails, reason?)`
- `sendNewRegistrationEmail(ownerEmail, crewDetails, journeyDetails)`
- `sendJourneyUpdatedEmail(userEmail, journeyDetails, changes)`
- `sendProfileReminderEmail(userEmail, missingFields)`

---

## Phase 3: API Routes

### 3.1 Notifications List & Create
**File: `app/api/notifications/route.ts`**
- `GET` - Fetch user's notifications (paginated)
- Query params: `?limit=20&offset=0&unread_only=true`

### 3.2 Single Notification Operations
**File: `app/api/notifications/[id]/route.ts`**
- `PATCH` - Mark notification as read
- `DELETE` - Delete notification

### 3.3 Bulk Operations
**File: `app/api/notifications/mark-all-read/route.ts`**
- `POST` - Mark all notifications as read for current user

### 3.4 Unread Count
**File: `app/api/notifications/unread-count/route.ts`**
- `GET` - Returns `{ count: number }` for badge display

---

## Phase 4: UI Components

### 4.1 Notification Bell Component
**File: `app/components/notifications/NotificationBell.tsx`**

Features:
- Bell icon in header/navbar
- Red badge with unread count (hide if 0)
- Click opens NotificationCenter dropdown/panel
- Uses SWR or React Query for polling unread count (every 30s)

### 4.2 Notification Center (Dropdown/Panel)
**File: `app/components/notifications/NotificationCenter.tsx`**

Features:
- Dropdown panel or slide-out drawer
- Header with "Notifications" title and "Mark all read" button
- Scrollable list of NotificationItem components
- "No notifications" empty state
- "View all" link to full notifications page (optional)
- Infinite scroll or "Load more" for pagination

### 4.3 Notification Item Component
**File: `app/components/notifications/NotificationItem.tsx`**

Features:
- Icon based on notification type
- Title and message preview
- Timestamp (relative: "2 hours ago")
- Unread indicator (dot or background highlight)
- Click navigates to link and marks as read
- Hover shows delete button

### 4.4 Full Notifications Page (Optional)
**File: `app/notifications/page.tsx`**

Full-page view of all notifications with:
- Filter by type
- Filter by read/unread
- Bulk delete option

---

## Phase 5: Real-time Updates (Supabase Realtime)

### 5.1 Realtime Subscription Hook
**File: `app/hooks/useNotifications.ts`**

```typescript
// Subscribe to notifications table changes for current user
// On INSERT: Update notification list and increment badge
// On UPDATE: Refresh notification item
// On DELETE: Remove from list
```

### 5.2 Integration with NotificationBell
- Subscribe on component mount
- Unsubscribe on unmount
- Show toast/animation on new notification

---

## Phase 6: Trigger Integration Points

### 6.1 Registration Flow Triggers
**Location: Registration approval/denial actions**

When owner approves registration:
1. Create in-app notification for crew member
2. Send email to crew member
3. Link to journey details page

When owner denies registration:
1. Create in-app notification for crew member
2. Send email with optional reason
3. Link to find other journeys

### 6.2 New Registration Trigger
**Location: Registration submission action**

When crew submits registration:
1. Create in-app notification for journey owner
2. Send email to journey owner
3. Link to registration review page

### 6.3 Journey/Leg Update Triggers
**Location: Journey and leg edit actions**

When journey owner updates journey/leg:
1. Find all approved crew for that journey
2. Create in-app notification for each
3. Send email to each (respecting preferences)
4. Link to updated journey/leg details

### 6.4 Profile Reminder Trigger
**Location: Scheduled task or login hook**

Check for incomplete profiles:
1. Identify users with missing required fields
2. Create reminder notification (if not sent recently)
3. Send email reminder
4. Link to profile completion page

---

## Files Summary

**New Files to Create:**
1. `supabase/migrations/XXXXXX_create_notifications.sql`
2. `app/lib/notifications/types.ts`
3. `app/lib/notifications/service.ts`
4. `app/lib/notifications/email.ts`
5. `app/api/notifications/route.ts`
6. `app/api/notifications/[id]/route.ts`
7. `app/api/notifications/mark-all-read/route.ts`
8. `app/api/notifications/unread-count/route.ts`
9. `app/components/notifications/NotificationBell.tsx`
10. `app/components/notifications/NotificationCenter.tsx`
11. `app/components/notifications/NotificationItem.tsx`
12. `app/hooks/useNotifications.ts`

**Files to Modify:**
1. Header/Navbar component - Add NotificationBell
2. Registration approval/denial actions - Add notification triggers
3. Registration submission action - Add notification trigger
4. Journey/Leg edit actions - Add notification triggers

---

## Dependencies

- Resend (for email) - likely already installed
- Supabase Realtime - included with Supabase client
- date-fns or similar for relative timestamps
<!-- SECTION:PLAN:END -->
