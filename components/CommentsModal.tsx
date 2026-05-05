'use client';

import { useState, useEffect } from 'react';
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

  const charCount = text.length;
  const isOverLimit = charCount > 100;

  // Fetch comments on mount
  useEffect(() => {
    fetchComments();
  }, [roundId]);

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
        // Reverse so newest comments appear first (no scrolling needed)
        setComments([...data.comments].reverse());
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
        // Add new comment to the beginning (since list is reversed)
        setComments([newComment, ...comments]);
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

        {/* Comments List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {commentsLoading ? (
            <p className="text-center text-gray-500">Loading comments...</p>
          ) : comments.length === 0 ? (
            <p className="text-center text-gray-500 py-4">
              No comments yet. Be the first!
            </p>
          ) : (
            comments.map((comment) => (
              <div
                key={comment.id}
                className="p-3 bg-gray-50 rounded-lg border border-gray-200"
              >
                {editingId === comment.id ? (
                  <div className="space-y-2">
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
                    <div className="flex items-start justify-between mb-1">
                      <div>
                        <span className="font-semibold text-sm">
                          {comment.author_name}
                        </span>
                        <span className="text-xs text-gray-500 ml-2">
                          {new Date(comment.created_at).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      {comment.user_id === userId && (
                        <div className="flex gap-1">
                          <button
                            onClick={() => {
                              setEditingId(comment.id);
                              setEditText(comment.text);
                            }}
                            className="text-xs text-blue-500 hover:text-blue-700"
                          >
                            ✏️
                          </button>
                          <button
                            onClick={() => handleDelete(comment.id)}
                            className="text-xs text-red-500 hover:text-red-700"
                          >
                            🗑️
                          </button>
                        </div>
                      )}
                    </div>
                    <p className="text-sm text-gray-800 mb-2">{comment.text}</p>

                    {/* Reactions */}
                    <div className="flex flex-wrap gap-1">
                      {REACTION_EMOJIS.map((emoji) => {
                        const reaction = comment.reactions?.find(
                          (r) => r.emoji === emoji
                        );
                        return (
                          <button
                            key={emoji}
                            onClick={() => handleReaction(comment.id, emoji)}
                            className={`text-xs px-2 py-1 rounded border transition ${
                              reaction && reaction.count > 0
                                ? 'bg-blue-100 border-blue-300'
                                : 'bg-gray-100 border-gray-300 hover:bg-gray-200'
                            }`}
                          >
                            {emoji} {reaction && reaction.count > 0 ? reaction.count : ''}
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            ))
          )}
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
