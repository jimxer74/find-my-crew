'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Heart, Copy, Check, MessageCircle, Send, Trash2, Edit2 } from 'lucide-react';
import { Button } from '@shared/ui/Button/Button';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SocialMeta {
  likes_count: number;
  user_has_liked: boolean;
  comments_enabled: boolean;
  comments_count: number;
}

interface Comment {
  id: string;
  content: string;
  user_id: string;
  author_name: string;
  author_image_url: string | null;
  created_at: string;
  updated_at: string;
  is_own: boolean;
}

interface SocialSectionProps {
  legId: string;
  isAuthenticated: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function LikeButton({
  count,
  liked,
  onToggle,
  disabled,
}: {
  count: number;
  liked: boolean;
  onToggle: () => void;
  disabled: boolean;
}) {
  return (
    <button
      onClick={onToggle}
      disabled={disabled}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
        liked
          ? 'bg-red-50 text-red-500 hover:bg-red-100 dark:bg-red-950/30 dark:text-red-400'
          : 'bg-muted text-muted-foreground hover:bg-accent hover:text-foreground'
      } disabled:opacity-50 disabled:cursor-not-allowed`}
      title={disabled ? 'Sign in to like' : liked ? 'Unlike' : 'Like'}
    >
      <Heart className={`w-4 h-4 ${liked ? 'fill-current' : ''}`} />
      <span>{count}</span>
    </button>
  );
}

function ShareButtons({ legId }: { legId: string }) {
  const [copied, setCopied] = useState(false);

  const legUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/crew/dashboard?legId=${legId}`
      : `/crew/dashboard?legId=${legId}`;

  const encodedUrl = encodeURIComponent(legUrl);
  const shareText = encodeURIComponent('Check out this sailing leg on Find My Crew!');

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(legUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: select text
    }
  };

  return (
    <div className="flex items-center gap-1.5">
      {/* Facebook */}
      <a
        href={`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center w-8 h-8 rounded-full bg-[#1877F2] text-white hover:bg-[#166FE5] transition-colors"
        title="Share on Facebook"
      >
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
        </svg>
      </a>

      {/* WhatsApp */}
      <a
        href={`https://wa.me/?text=${shareText}%20${encodedUrl}`}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center w-8 h-8 rounded-full bg-[#25D366] text-white hover:bg-[#1ebe5b] transition-colors"
        title="Share on WhatsApp"
      >
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
        </svg>
      </a>

      {/* Copy link */}
      <button
        onClick={handleCopy}
        className="flex items-center justify-center w-8 h-8 rounded-full bg-muted text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
        title={copied ? 'Copied!' : 'Copy link'}
      >
        {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
      </button>
    </div>
  );
}

function CommentItem({
  comment,
  onEdit,
  onDelete,
}: {
  comment: Comment;
  onEdit: (id: string, content: string) => void;
  onDelete: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(comment.content);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleStartEdit = () => {
    setEditValue(comment.content);
    setEditing(true);
    setTimeout(() => textareaRef.current?.focus(), 0);
  };

  const handleSaveEdit = () => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== comment.content) {
      onEdit(comment.id, trimmed);
    }
    setEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSaveEdit();
    if (e.key === 'Escape') setEditing(false);
  };

  return (
    <div className="flex gap-2.5 group">
      {comment.author_image_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={comment.author_image_url}
          alt={comment.author_name}
          className="w-6 h-6 rounded-full object-cover flex-shrink-0 mt-0.5"
        />
      ) : (
        <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center flex-shrink-0 mt-0.5 text-xs font-semibold text-muted-foreground">
          {comment.author_name.charAt(0).toUpperCase()}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="text-xs font-semibold text-foreground truncate">{comment.author_name}</span>
          <span className="text-xs text-muted-foreground flex-shrink-0">{timeAgo(comment.created_at)}</span>
          {comment.updated_at !== comment.created_at && (
            <span className="text-xs text-muted-foreground flex-shrink-0">(edited)</span>
          )}
        </div>

        {editing ? (
          <div className="mt-1">
            <textarea
              ref={textareaRef}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={handleKeyDown}
              maxLength={2000}
              rows={2}
              className="w-full text-sm bg-background border border-border rounded-md px-2.5 py-1.5 resize-none focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <div className="flex gap-2 mt-1">
              <button
                onClick={handleSaveEdit}
                disabled={!editValue.trim()}
                className="text-xs text-primary hover:underline disabled:opacity-50"
              >
                Save
              </button>
              <button onClick={() => setEditing(false)} className="text-xs text-muted-foreground hover:underline">
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-foreground mt-0.5 break-words whitespace-pre-wrap">{comment.content}</p>
        )}
      </div>

      {/* Actions (own comment or skipper) */}
      {!editing && comment.is_own && (
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
          <button
            onClick={handleStartEdit}
            className="p-1 text-muted-foreground hover:text-foreground rounded"
            title="Edit comment"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onDelete(comment.id)}
            className="p-1 text-muted-foreground hover:text-destructive rounded"
            title="Delete comment"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function SocialSection({ legId, isAuthenticated }: SocialSectionProps) {
  const [meta, setMeta] = useState<SocialMeta | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [loadingComments, setLoadingComments] = useState(false);
  const [liking, setLiking] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Fetch social meta ────────────────────────────────────────────────────────
  const fetchMeta = useCallback(async () => {
    setLoadingMeta(true);
    try {
      const res = await fetch(`/api/legs/${legId}/social`);
      if (res.ok) {
        const data = await res.json();
        setMeta(data);
      }
    } finally {
      setLoadingMeta(false);
    }
  }, [legId]);

  useEffect(() => {
    fetchMeta();
    setComments([]);
    setShowComments(false);
    setNewComment('');
  }, [legId, fetchMeta]);

  // ── Fetch comments ────────────────────────────────────────────────────────────
  const fetchComments = useCallback(async (cursor?: string) => {
    setLoadingComments(true);
    try {
      const url = `/api/legs/${legId}/comments${cursor ? `?cursor=${cursor}` : ''}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setComments((prev) => cursor ? [...prev, ...data.comments] : data.comments);
        setHasMore(data.has_more);
      }
    } finally {
      setLoadingComments(false);
    }
  }, [legId]);

  const handleToggleComments = () => {
    if (!showComments && comments.length === 0) {
      fetchComments();
    }
    setShowComments((v) => !v);
  };

  // ── Like toggle ───────────────────────────────────────────────────────────────
  const handleLike = async () => {
    if (!isAuthenticated || liking || !meta) return;
    setLiking(true);
    // Optimistic update
    const prevMeta = meta;
    setMeta({
      ...meta,
      user_has_liked: !meta.user_has_liked,
      likes_count: meta.likes_count + (meta.user_has_liked ? -1 : 1),
    });
    try {
      const res = await fetch(`/api/legs/${legId}/like`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setMeta((m) => m ? { ...m, user_has_liked: data.liked, likes_count: data.likes_count } : m);
      } else {
        setMeta(prevMeta); // revert
      }
    } catch {
      setMeta(prevMeta);
    } finally {
      setLiking(false);
    }
  };

  // ── Post comment ──────────────────────────────────────────────────────────────
  const handleSubmitComment = async () => {
    const content = newComment.trim();
    if (!content || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/legs/${legId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });
      if (res.ok) {
        const data = await res.json();
        setComments((prev) => [...prev, data.comment]);
        setMeta((m) => m ? { ...m, comments_count: m.comments_count + 1 } : m);
        setNewComment('');
      } else {
        const err = await res.json();
        setError(err.error ?? 'Failed to post comment');
      }
    } finally {
      setSubmitting(false);
    }
  };

  // ── Edit comment ──────────────────────────────────────────────────────────────
  const handleEditComment = async (commentId: string, content: string) => {
    const res = await fetch(`/api/legs/${legId}/comments/${commentId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    });
    if (res.ok) {
      const data = await res.json();
      setComments((prev) => prev.map((c) => (c.id === commentId ? data.comment : c)));
    }
  };

  // ── Delete comment ────────────────────────────────────────────────────────────
  const handleDeleteComment = async (commentId: string) => {
    const res = await fetch(`/api/legs/${legId}/comments/${commentId}`, { method: 'DELETE' });
    if (res.ok) {
      setComments((prev) => prev.filter((c) => c.id !== commentId));
      setMeta((m) => m ? { ...m, comments_count: Math.max(0, m.comments_count - 1) } : m);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSubmitComment();
  };

  if (loadingMeta || !meta) {
    return <div className="h-10 animate-pulse bg-muted rounded-lg mx-4 mt-3" />;
  }

  return (
    <div className="mx-4 mt-3 space-y-3">
      {/* Like + Share row */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <LikeButton
            count={meta.likes_count}
            liked={meta.user_has_liked}
            onToggle={handleLike}
            disabled={!isAuthenticated || liking}
          />
          {meta.comments_enabled && (
            <button
              onClick={handleToggleComments}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm bg-muted text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            >
              <MessageCircle className="w-4 h-4" />
              <span>{meta.comments_count}</span>
            </button>
          )}
        </div>
        <ShareButtons legId={legId} />
      </div>

      {/* Comments section */}
      {meta.comments_enabled && showComments && (
        <div className="space-y-3">
          {/* Comment list */}
          {loadingComments && comments.length === 0 ? (
            <div className="space-y-2">
              {[0, 1].map((i) => (
                <div key={i} className="flex gap-2.5">
                  <div className="w-6 h-6 rounded-full bg-muted animate-pulse flex-shrink-0" />
                  <div className="flex-1 space-y-1">
                    <div className="h-3 bg-muted animate-pulse rounded w-24" />
                    <div className="h-3 bg-muted animate-pulse rounded w-48" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {comments.map((c) => (
                <CommentItem
                  key={c.id}
                  comment={c}
                  onEdit={handleEditComment}
                  onDelete={handleDeleteComment}
                />
              ))}
              {hasMore && (
                <button
                  onClick={() => fetchComments(comments[comments.length - 1]?.created_at)}
                  disabled={loadingComments}
                  className="text-xs text-primary hover:underline disabled:opacity-50"
                >
                  {loadingComments ? 'Loading...' : 'Load more comments'}
                </button>
              )}
              {comments.length === 0 && !loadingComments && (
                <p className="text-xs text-muted-foreground text-center py-2">
                  No comments yet. Be the first!
                </p>
              )}
            </div>
          )}

          {/* Comment input */}
          {isAuthenticated ? (
            <div className="space-y-1.5">
              <div className="flex gap-2">
                <textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Write a comment… (Ctrl+Enter to submit)"
                  maxLength={2000}
                  rows={2}
                  className="flex-1 text-sm bg-background border border-border rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground"
                />
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleSubmitComment}
                  disabled={!newComment.trim() || submitting}
                  className="self-end"
                  title="Post comment"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
              {error && <p className="text-xs text-destructive">{error}</p>}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground text-center py-1">
              Sign in to comment
            </p>
          )}
        </div>
      )}

      {/* Commenting disabled notice */}
      {!meta.comments_enabled && (
        <p className="text-xs text-muted-foreground">Comments are disabled for this journey.</p>
      )}
    </div>
  );
}
