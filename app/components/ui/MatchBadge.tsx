'use client';

//import { getMatchColorClass, getMatchTextColorClass } from '@/app/lib/skillMatching';


interface MatchBadgeProps {
  percentage: number;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function MatchBadge({ 
  percentage, 
  showLabel = true, 
  size = 'md',
  className = '' 
}: MatchBadgeProps) {
  
  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-3 py-1',
    lg: 'text-base px-4 py-1.5',
  };

  return (
    <span
      className={`inline-flex items-center font-semibold rounded-full border-2 ${
        percentage >= 80 ? 'bg-green-300/80 border-green-500 text-green-800' :
        percentage >= 50 ? 'bg-yellow-300/80 border-yellow-600 text-yellow-800' :
        percentage >= 25 ? 'bg-orange-300/80 border-orange-600 text-orange-800' :
        'bg-red-500/80 border-red-600 text-red-800'
      } ${sizeClasses[size]} ${className}`}
      title={`${percentage}% skill match`}
    >
      {showLabel && (
        <span className="mr-1">
          {percentage === 100 ? 'Perfect Match' : `${percentage}% Match`}
        </span>
      )}
      <span></span>
    </span>
  );
}
