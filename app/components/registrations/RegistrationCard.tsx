import Link from 'next/link';
import Image from 'next/image';
import { Card } from '@/app/components/ui';
import { formatDate } from '@/app/lib/dateFormat';
import { StatusBadge } from './StatusBadge';

type Status = 'Pending approval' | 'Approved' | 'Not approved' | 'Cancelled';

interface Registration {
  id: string;
  status: Status;
  created_at: string;
  legs: {
    id: string;
    name: string;
    start_date: string | null;
  };
  profiles: {
    full_name: string | null;
    username: string | null;
    profile_image_url: string | null;
  };
}

interface RegistrationCardProps {
  registration: Registration;
}

export function RegistrationCard({ registration }: RegistrationCardProps) {
  const profile = registration.profiles;
  const leg = registration.legs;

  return (
    <Link href={`/owner/registrations/${registration.id}`}>
      <Card className="cursor-pointer hover:shadow-lg hover:bg-accent/50 transition-all relative">
        {/* Status Badge - Top Right */}
        <div className="absolute top-3 right-3">
          <StatusBadge status={registration.status} variant="circle" />
        </div>

        {/* Content with padding for badge */}
        <div className="pr-12 space-y-3">
          {/* Name with Avatar */}
          <div className="flex items-center gap-3">
            <div className="relative w-10 h-10 flex-shrink-0">
              {profile?.profile_image_url ? (
                <Image
                  src={profile.profile_image_url}
                  alt={profile.full_name || profile.username || 'Crew member'}
                  fill
                  className="object-cover rounded-full"
                  sizes="40px"
                />
              ) : (
                <div className="w-full h-full bg-accent rounded-full flex items-center justify-center">
                  <svg
                    className="w-5 h-5 text-muted-foreground"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                    />
                  </svg>
                </div>
              )}
            </div>
            <h3 className="text-sm font-semibold text-foreground line-clamp-1">
              {profile?.full_name || profile?.username || 'Unknown User'}
            </h3>
          </div>

          {/* Registration Date */}
          <p className="text-xs text-muted-foreground">
            Registered: {formatDate(registration.created_at)}
          </p>

          {/* Leg Name */}
          <p className="text-sm font-medium text-foreground line-clamp-1">
            {leg.name}
          </p>

          {/* Leg Start Date */}
          {leg.start_date && (
            <p className="text-xs text-muted-foreground">
              Starts: {formatDate(leg.start_date)}
            </p>
          )}
        </div>
      </Card>
    </Link>
  );
}
