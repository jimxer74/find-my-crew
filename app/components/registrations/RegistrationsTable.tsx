'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
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
    end_date: string | null;
    journeys: {
      id: string;
      name: string;
    };
  };
  profiles: {
    full_name: string | null;
    username: string | null;
  };
}

interface RegistrationsTableProps {
  registrations: Registration[];
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  onSort: (field: string) => void;
}

const columns = [
  { key: 'created_at', label: 'Registration Date', sortable: true },
  { key: 'status', label: 'Status', sortable: true },
  { key: 'full_name', label: 'Full Name', sortable: false },
  { key: 'journey_name', label: 'Journey', sortable: true },
  { key: 'leg_name', label: 'Leg', sortable: true },
  { key: 'leg_start_date', label: 'Leg Start', sortable: true },
  { key: 'leg_end_date', label: 'Leg End', sortable: true },
];

function SortIndicator({ column, sortBy, sortOrder }: { column: string; sortBy: string; sortOrder: 'asc' | 'desc' }) {
  if (sortBy !== column) return null;
  return <span className="ml-1">{sortOrder === 'asc' ? '↑' : '↓'}</span>;
}

export function RegistrationsTable({ registrations, sortBy, sortOrder, onSort }: RegistrationsTableProps) {
  const router = useRouter();

  return (
    <div className="overflow-x-auto rounded-lg shadow border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-muted border-b border-border">
            {columns.map((column) => (
              <th key={column.key} className="px-4 py-3 text-left font-semibold text-foreground">
                {column.sortable ? (
                  <button
                    onClick={() => onSort(column.key)}
                    className="flex items-center gap-1 hover:text-primary transition-colors w-full py-1"
                  >
                    {column.label}
                    <SortIndicator column={column.key} sortBy={sortBy} sortOrder={sortOrder} />
                  </button>
                ) : (
                  column.label
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {registrations.map((registration, index) => (
            <tr
              key={registration.id}
              className={`border-b border-border hover:bg-accent/50 transition-colors cursor-pointer ${
                index % 2 === 0 ? 'bg-background' : 'bg-card'
              }`}
              onClick={() => {
                // Navigate to detail page
                router.push(`/owner/registrations/${registration.id}`);
              }}
            >
              <td className="px-4 py-3">
                {formatDate(registration.created_at)}
              </td>
              <td className="px-4 py-3">
                <StatusBadge status={registration.status} variant="full" />
              </td>
              <td className="px-4 py-3 font-medium">
                <Link
                  href={`/owner/registrations/${registration.id}`}
                  className="text-primary hover:underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  {registration.profiles?.full_name || registration.profiles?.username || 'Unknown'}
                </Link>
              </td>
              <td className="px-4 py-3">
                <Link
                  href={`/owner/journeys/${registration.legs.journeys.id}/legs`}
                  className="text-primary hover:underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  {registration.legs.journeys.name}
                </Link>
              </td>
              <td className="px-4 py-3">
                <Link
                  href={`/owner/journeys/${registration.legs.journeys.id}/legs/${registration.legs.id}`}
                  className="text-primary hover:underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  {registration.legs.name}
                </Link>
              </td>
              <td className="px-4 py-3">
                {registration.legs.start_date ? formatDate(registration.legs.start_date) : '-'}
              </td>
              <td className="px-4 py-3">
                {registration.legs.end_date ? formatDate(registration.legs.end_date) : '-'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
