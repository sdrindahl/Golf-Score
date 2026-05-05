'use client';

import { useState, useEffect, useRef } from 'react';
import { Comment } from '@/types';

interface CommentsModalProps {
  roundId: string;
  userId: string;
  userName: string;
  onClose: () => void;
  onCommentAdded?: () => void;
}

const REACTION_EMOJIS = ['👍', '😂', '🔥', '🎯', '👏'];

export default function CommentsModal({
  roundId,
  userId,
  userName,
  onClose,
  onCommentAdded,
}: CommentsModalProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editText, setEditText] = useState('');
  const [commentsLoading, setCommentsLoading] = useState(true);
  const commentsEndRef = useRef<HTMLDivElement>(null);

  const charCount = text.length;
  const isOverLimit = charCount > 100;

  // Fetch comments on mount
  useEffect(() => {
    fetchComments();
  }, [roundId]);

  // Auto-scroll to bottom when comments change
  useEffect(() => {
    scrollToBottom();
  }, [comments]);

  const scrollToBottom = () => {
    commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchComments = async () => {
    try {
      setCommentsLoading(true);
      const res = await fetch('/api/get-comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roundId }),
      });
      const data = await res.json();
      if (data.comments) {
        // Keep chronological order (oldest first, newest last)
        setComments(data.comments);
      }
    } catch (error) {
      console.error('Failed to fetch comments:', error);
    } finally {
      setCommentsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || isOverLimit || loading) return;

    setLoading(true);
    try {
      const res = await fetch('/api/save-comment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roundId,
          userId,
          authorName: userName,
          text: text.trim(),
        }),
      });
      const data = await res.json();
      if (data.comment) {
        const newComment = { ...data.comment, reactions: [] };
        // Add new comment to the end (newest at bottom)
        setComments([...comments, newComment]);
        setText('');
        if (onCommentAdded) {
          onCommentAdded();
        }
      }
    } catch (error) {
      console.error('Failed to save comment:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (commentId: number) => {
    if (!editText.trim() || editText.length > 100) return;

    try {
      const res = await fetch('/api/update-comment', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          commentId,
          userId,
          text: editText.trim(),
        }),
      });
      if (res.ok) {
        setComments(
          comments.map((c) =>
            c.id === commentId ? { ...c, text: editText.trim() } : c
          )
        );
        setEditingId(null);
        setEditText('');
      }
    } catch (error) {
      console.error('Failed to update comment:', error);
    }
  };

  const handleDelete = async (commentId: number) => {
    if (!confirm('Delete this comment?')) return;

    try {
      const res = await fetch('/api/delete-comment', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ commentId, userId }),
      });
      if (res.ok) {
        setComments(comments.filter((c) => c.id !== commentId));
      }
    } catch (error) {
      console.error('Failed to delete comment:', error);
    }
  };

  const handleReaction = async (commentId: number, emoji: string) => {
    try {
      await fetch('/api/comment-reactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          commentId,
          emoji,
          increment: true,
        }),
      });
      // Refetch to get updated reactions
      fetchComments();
    } catch (error) {
      console.error('Failed to add reaction:', error);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-xl font-bold">Comments</h2>
          <button
            onClick={onClose}
            className="text-2xl text-gray-500 hover:text-gray-700 transition"
          >
            ✕
          </button>
        </div>

        {/* Comments List - iMessages style chat bubbles */}
        <div className="max-h-[250px] overflow-y-auto p-4 space-y-2 flex flex-col">
          {commentsLoading ? (
            <p className="text-center text-gray-500">Loading comments...</p>
          ) : comments.length === 0 ? (
            <p className="text-center text-gray-500 py-8">
              No comments yet. Be the first!
            </p>
          ) : (
            comments.map((comment) => {
              const isOwnComment = comment.user_id === userId;
              return (
                <div
                  key={comment.id}
                  className={`flex ${isOwnComment ? 'justify-end' : 'justify-start'} gap-2 group`}
                >
                  {/* Edit/Delete buttons for own comments (left side on hover) */}
                  {isOwnComment && (
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity self-center">
                      <button
                        onClick={() => {
                          setEditingId(comment.id);
                          setEditText(comment.text);
                        }}
                        className="text-sm text-blue-500 hover:text-blue-700"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => handleDelete(comment.id)}
                        className="text-sm text-red-500 hover:text-red-700"
                      >
                        🗑️
                      </button>
                    </div>
                  )}

                  {/* Chat bubble */}
                  <div className={`max-w-xs ${isOwnComment ? 'items-end' : 'items-start'} flex flex-col`}>
                    {/* Author name and timestamp (above bubble for others, below for self) */}
                    {!isOwnComment && (
                      <div className="flex gap-1 mb-0.5 px-3">
                        <span className="font-semibold text-xs text-gray-700">
                          {comment.author_name}
                        </span>
                        <span className="text-xs text-gray-500">
                          {new Date(comment.created_at).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                    )}

                    {editingId === comment.id ? (
                      <div className={`space-y-1 p-2 rounded-2xl ${isOwnComment ? 'bg-blue-500' : 'bg-gray-200'}`}>
                        <textarea
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          maxLength={101}
                          rows={2}
                          className="w-full p-2 border border-gray-300 rounded resize-none text-sm"
                        />
                        <div className="flex gap-2 justify-end">
                          <button
                            onClick={() => setEditingId(null)}
                            className="btn-secondary text-xs px-2 py-1"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => handleUpdate(comment.id)}
                            className="btn-primary text-xs px-2 py-1"
                          >
                            Save
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        {/* Message bubble */}
                        <div
                          className={`px-4 py-2 rounded-2xl ${
                            isOwnComment
                              ? 'bg-blue-500 text-white rounded-br-none'
                              : 'bg-gray-200 text-gray-900 rounded-bl-none'
                          }`}
                        >
                          <p className="text-sm break-words">{comment.text}</p>
                        </div>

                        {/* Reactions below bubble */}
                        <div className="flex flex-wrap gap-1 mt-1 px-1">
                          {REACTION_EMOJIS.map((emoji) => {
                            const reaction = comment.reactions?.find(
                              (r) => r.emoji === emoji
                            );
                            return (
                              <button
                                key={emoji}
                                onClick={() => handleReaction(comment.id, emoji)}
                                className={`text-xs px-1.5 py-0.5 rounded-full border transition ${
                                  reaction && reaction.count > 0
                                    ? 'bg-blue-100 border-blue-300'
                                    : 'bg-gray-100 border-gray-300 hover:bg-gray-200'
                                }`}
                                title={`${emoji}${reaction && reaction.count > 0 ? ' x' + reaction.count : ''}`}
                              >
                                {emoji}
                                {reaction && reaction.count > 0 && (
                                  <span className="ml-0.5 text-xs font-semibold">
                                    {reaction.count}
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </>
                    )}

                    {/* Author name and timestamp (below bubble for self) */}
                    {isOwnComment && (
                      <div className="flex gap-1 mt-0.5 px-3 justify-end">
                        <span className="text-xs text-gray-500">
                          {new Date(comment.created_at).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Edit/Delete buttons for others' comments (right side on hover) */}
                  {!isOwnComment && (
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity self-center">
                      {/* No edit/delete for others' comments */}
                    </div>
                  )}
                </div>
              );
            })
          )}
          {/* Auto-scroll anchor */}
          <div ref={commentsEndRef} />
        </div>

        {/* Divider */}
        <div className="border-t border-gray-200"></div>

        {/* Comment Input */}
        <form onSubmit={handleSubmit} className="p-4 space-y-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Drop a comment... (max 100 chars)"
            maxLength={101}
            rows={2}
            disabled={loading}
            className={`w-full p-2 border rounded resize-none text-sm ${
              isOverLimit ? 'border-red-500' : 'border-gray-300'
            }`}
          />
          <div className="flex items-center justify-between">
            <span className={`text-xs ${isOverLimit ? 'text-red-500' : 'text-gray-500'}`}>
              {charCount}/100
            </span>
            <button
              type="submit"
              disabled={!text.trim() || isOverLimit || loading}
              className="btn-primary text-sm px-3 py-1 disabled:opacity-50"
            >
              {loading ? 'Sending...' : 'Comment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
