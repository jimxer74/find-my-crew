import { getSupabaseAdmin } from '../utils/supabase-admin.js';
import { getRandom } from '../utils/seeded-random.js';
import type { GeneratedProfile } from './profiles.js';

export interface GeneratedNotification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string | null;
  link: string | null;
  read: boolean;
  metadata: Record<string, unknown>;
}

export interface NotificationGeneratorOptions {
  profiles: GeneratedProfile[];
  notificationsPerUser?: number | { min: number; max: number };
  readRatio?: number;
  onProgress?: (message: string) => void;
}

// Notification templates
const NOTIFICATION_TEMPLATES = [
  {
    type: 'registration_approved',
    title: 'Registration Approved!',
    message: 'Your registration for the sailing leg has been approved. Welcome aboard!',
    link: '/crew/registrations',
  },
  {
    type: 'registration_denied',
    title: 'Registration Update',
    message: 'Unfortunately, your registration was not approved for this leg.',
    link: '/crew/registrations',
  },
  {
    type: 'new_registration',
    title: 'New Crew Application',
    message: 'A new crew member has applied to join your sailing leg.',
    link: '/owner/manage',
  },
  {
    type: 'journey_updated',
    title: 'Journey Details Updated',
    message: 'The journey you\'re registered for has been updated.',
    link: '/journey',
  },
  {
    type: 'leg_updated',
    title: 'Leg Schedule Changed',
    message: 'The dates or details for your sailing leg have been modified.',
    link: '/journey',
  },
  {
    type: 'profile_reminder',
    title: 'Complete Your Profile',
    message: 'Add more details to your profile to increase your chances of being accepted.',
    link: '/profile',
  },
  {
    type: 'new_journey',
    title: 'New Journey Published',
    message: 'A new sailing journey matching your preferences has been published.',
    link: '/explore',
  },
  {
    type: 'message_received',
    title: 'New Message',
    message: 'You have received a new message from a crew member.',
    link: '/messages',
  },
];

/**
 * Generate notifications for profiles
 */
export async function generateNotifications(
  options: NotificationGeneratorOptions
): Promise<GeneratedNotification[]> {
  const {
    profiles,
    notificationsPerUser = { min: 0, max: 5 },
    readRatio = 0.6,
    onProgress = console.log,
  } = options;

  const random = getRandom();
  const admin = getSupabaseAdmin();
  const notifications: GeneratedNotification[] = [];

  // Calculate total notifications
  const notificationCounts = profiles.map(() => {
    if (typeof notificationsPerUser === 'number') {
      return notificationsPerUser;
    }
    return random.int(notificationsPerUser.min, notificationsPerUser.max);
  });
  const totalNotifications = notificationCounts.reduce((a, b) => a + b, 0);

  onProgress(`Generating ${totalNotifications} notifications for ${profiles.length} profiles...`);

  let notificationIndex = 0;
  for (let profileIdx = 0; profileIdx < profiles.length; profileIdx++) {
    const profile = profiles[profileIdx];
    const notificationCount = notificationCounts[profileIdx];

    // Select appropriate notification types based on user role
    const isOwner = profile.roles.includes('owner');
    const availableTemplates = NOTIFICATION_TEMPLATES.filter(t => {
      if (isOwner) {
        return ['new_registration', 'journey_updated', 'leg_updated', 'profile_reminder', 'message_received'].includes(t.type);
      } else {
        return ['registration_approved', 'registration_denied', 'journey_updated', 'leg_updated', 'profile_reminder', 'new_journey', 'message_received'].includes(t.type);
      }
    });

    for (let n = 0; n < notificationCount; n++) {
      const template = random.pick(availableTemplates);

      const notification: GeneratedNotification = {
        id: random.uuid(),
        user_id: profile.id,
        type: template.type,
        title: template.title,
        message: template.message,
        link: template.link,
        read: random.bool(readRatio),
        metadata: {},
      };

      // Insert notification into database
      const { data, error } = await admin.from('notifications').insert({
        user_id: notification.user_id,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        link: notification.link,
        read: notification.read,
        metadata: notification.metadata,
      }).select('id').single();

      if (error) {
        throw new Error(`Failed to insert notification: ${error.message}`);
      }

      notification.id = data.id;
      notifications.push(notification);
      notificationIndex++;
    }

    if ((profileIdx + 1) % 10 === 0 || profileIdx === profiles.length - 1) {
      onProgress(`  Created notifications for ${profileIdx + 1}/${profiles.length} profiles`);
    }
  }

  return notifications;
}

/**
 * Get notifications for a specific user
 */
export function getNotificationsByUser(notifications: GeneratedNotification[], userId: string): GeneratedNotification[] {
  return notifications.filter(n => n.user_id === userId);
}
