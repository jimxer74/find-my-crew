---
id: TASK-023
title: Notifications and Communications
status: To Do
assignee: []
created_date: '2026-01-24 11:40'
labels: []
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Goal: Automate user communication and reduce manual follow-ups

Features:

Real-time notifications: WebSocket or polling-based
Email notifications: For important events (optional)
In-app notification center: Bell icon with unread count
Notification types:
New match available (crew)
Registration approved/denied
New registration received (owner)
Journey or leg updated
AI assessment completed
Profile completion reminders
<!-- SECTION:DESCRIPTION:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Notification service:
/app/lib/notifications

Database Schema:

CREATE TABLE notifications (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES profiles(id),
  type VARCHAR(50),
  title VARCHAR(255),
  message TEXT,
  link VARCHAR(500),
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_read ON notifications(user_id, read);
Files to Create:

app/lib/notifications/service.ts
app/api/notifications/route.ts
`app/api/notifications/[id]/route.ts`
app/api/notifications/mark-read/route.ts
app/components/notifications/NotificationCenter.tsx
app/components/notifications/NotificationBell.tsx
app/components/notifications/NotificationItem.tsx
<!-- SECTION:PLAN:END -->
