'use client';

import { useState } from 'react';
import { ThumbsUp } from 'lucide-react';
import { Button } from '@/app/components/ui/Button/Button';

interface VoteButtonsProps {
  feedbackId: string;
  upvotes: number;
  userVote: number | null;
  disabled?: boolean;
  onVote: (feedbackId: string, vote: 1 | -1 | 0) => Promise<void>;
}

export function VoteButtons({
  feedbackId,
  upvotes,
  userVote,
  disabled = false,
  onVote,
}: VoteButtonsProps) {
  const [isVoting, setIsVoting] = useState(false);
  const hasVoted = userVote === 1;

  const handleVote = async () => {
    if (disabled || isVoting) return;

    setIsVoting(true);
    try {
      // Toggle: if already voted, remove vote (0), otherwise add upvote (1)
      const newVote = hasVoted ? 0 : 1;
      await onVote(feedbackId, newVote);
    } finally {
      setIsVoting(false);
    }
  };

  return (
    <Button
      onClick={handleVote}
      disabled={disabled || isVoting}
      variant="ghost"
      size="sm"
      className={`!p-0 flex items-center gap-1 ${
        hasVoted
          ? '!text-blue-600 dark:!text-blue-400'
          : '!text-muted-foreground hover:!text-foreground'
      }`}
      aria-label={hasVoted ? 'Remove like' : 'Like'}
    >
      <ThumbsUp
        className={`w-4 h-4 ${hasVoted ? 'fill-current' : ''}`}
        strokeWidth={hasVoted ? 2.5 : 2}
      />
      {upvotes > 0 && (
        <span className="text-sm font-medium tabular-nums">
          {upvotes}
        </span>
      )}
    </Button>
  );
}
