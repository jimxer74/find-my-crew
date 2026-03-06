'use client';

import { useState, useEffect } from 'react';
import { ThumbsUp } from 'lucide-react';

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
  const [optimisticVoted, setOptimisticVoted] = useState(userVote === 1);
  const [optimisticCount, setOptimisticCount] = useState(upvotes);
  const [animating, setAnimating] = useState(false);

  // Sync with server state after API responds
  useEffect(() => {
    setOptimisticVoted(userVote === 1);
    setOptimisticCount(upvotes);
  }, [userVote, upvotes]);

  const handleVote = async () => {
    if (disabled || isVoting) return;

    const newVoted = !optimisticVoted;
    const delta = newVoted ? 1 : -1;

    // Optimistic update — instant visual feedback
    setOptimisticVoted(newVoted);
    setOptimisticCount(c => c + delta);
    setAnimating(true);
    setTimeout(() => setAnimating(false), 300);

    setIsVoting(true);
    try {
      await onVote(feedbackId, newVoted ? 1 : 0);
    } catch {
      // Revert on error
      setOptimisticVoted(!newVoted);
      setOptimisticCount(c => c - delta);
    } finally {
      setIsVoting(false);
    }
  };

  return (
    <button
      onClick={handleVote}
      disabled={disabled}
      aria-label={optimisticVoted ? 'Remove like' : 'Like'}
      className={`
        flex flex-col items-center gap-0.5 min-w-[2rem] py-1 px-1.5 rounded-lg
        transition-colors duration-150 select-none
        ${disabled
          ? 'opacity-40 cursor-not-allowed'
          : optimisticVoted
            ? 'text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10'
            : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
        }
      `}
    >
      <ThumbsUp
        className={`w-4 h-4 transition-transform duration-200 ${
          animating ? 'scale-125' : 'scale-100'
        } ${optimisticVoted ? 'fill-current' : ''}`}
        strokeWidth={optimisticVoted ? 2.5 : 2}
      />
      <span className={`text-xs font-semibold tabular-nums leading-none ${
        optimisticCount === 0 ? 'text-muted-foreground/50' : ''
      }`}>
        {optimisticCount}
      </span>
    </button>
  );
}
