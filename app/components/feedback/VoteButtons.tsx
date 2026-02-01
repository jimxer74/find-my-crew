'use client';

import { useState } from 'react';

interface VoteButtonsProps {
  feedbackId: string;
  voteScore: number;
  userVote: number | null;
  disabled?: boolean;
  onVote: (feedbackId: string, vote: 1 | -1 | 0) => Promise<void>;
}

export function VoteButtons({
  feedbackId,
  voteScore,
  userVote,
  disabled = false,
  onVote,
}: VoteButtonsProps) {
  const [isVoting, setIsVoting] = useState(false);

  const handleVote = async (vote: 1 | -1) => {
    if (disabled || isVoting) return;

    setIsVoting(true);
    try {
      // If clicking the same vote, remove it (toggle)
      const newVote = userVote === vote ? 0 : vote;
      await onVote(feedbackId, newVote);
    } finally {
      setIsVoting(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-0.5">
      {/* Upvote button */}
      <button
        onClick={() => handleVote(1)}
        disabled={disabled || isVoting}
        className={`p-1 rounded transition-colors ${
          userVote === 1
            ? 'text-green-600 dark:text-green-400'
            : 'text-muted-foreground hover:text-foreground'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        aria-label="Upvote"
      >
        <svg className="w-5 h-5" fill={userVote === 1 ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
        </svg>
      </button>

      {/* Vote count */}
      <span className={`text-sm font-medium tabular-nums ${
        voteScore > 0 ? 'text-green-600 dark:text-green-400' :
        voteScore < 0 ? 'text-red-600 dark:text-red-400' :
        'text-muted-foreground'
      }`}>
        {voteScore}
      </span>

      {/* Downvote button */}
      <button
        onClick={() => handleVote(-1)}
        disabled={disabled || isVoting}
        className={`p-1 rounded transition-colors ${
          userVote === -1
            ? 'text-red-600 dark:text-red-400'
            : 'text-muted-foreground hover:text-foreground'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        aria-label="Downvote"
      >
        <svg className="w-5 h-5" fill={userVote === -1 ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
    </div>
  );
}
