type Status = 'Pending approval' | 'Approved' | 'Not approved' | 'Cancelled';

interface StatusBadgeProps {
  status: Status;
  variant?: 'full' | 'circle'; // full text or just letter
}

export function StatusBadge({ status, variant = 'full' }: StatusBadgeProps) {
  const statusConfig = {
    'Pending approval': { letter: 'P', bg: 'bg-yellow-500', label: 'Pending' },
    'Approved': { letter: 'A', bg: 'bg-green-500', label: 'Approved' },
    'Not approved': { letter: 'N', bg: 'bg-red-500', label: 'Not Approved' },
    'Cancelled': { letter: 'C', bg: 'bg-gray-500', label: 'Cancelled' },
  };

  const config = statusConfig[status];

  if (variant === 'circle') {
    return (
      <div
        className={`w-8 h-8 rounded-full ${config.bg} flex items-center justify-center text-white text-xs font-bold`}
        title={config.label}
      >
        {config.letter}
      </div>
    );
  }

  return (
    <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${config.bg} text-white`}>
      {status}
    </span>
  );
}
