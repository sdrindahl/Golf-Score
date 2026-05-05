'use client';

import { useState, useEffect } from 'react';
import CommentsModal from './CommentsModal';

interface CommentsBubbleProps {
  roundId: string;
  userId: string;
  userName: string;
}

export default function CommentsBubble({
  roundId,
  userId,
  userName,
}: CommentsBubbleProps) {
  const [commentCount, setCommentCount] = useState(0);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Fetch comment count
  useEffect(() => {
    const fetchCommentCount = async () => {
      try {
        const res = await fetch('/api/get-comments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ roundId }),
        });
        const data = await res.json();
        setCommentCount(data.comments?.length || 0);
      } catch (error) {
        console.error('Failed to fetch comment count:', error);
      }
    };

    fetchCommentCount();
  }, [roundId]);

  const handleCommentAdded = () => {
    setCommentCount(prev => prev + 1);
  };

  return (
    <>
      <button
        onClick={(e) => {
          e.stopPropagation(); // Prevent card click from triggering
          setIsModalOpen(true);
        }}
        className="relative inline-flex items-center justify-center w-10 h-10 rounded-full bg-blue-500 hover:bg-blue-600 text-white shadow-lg transition-all active:scale-95"
        title="Comments"
      >
        <span className="text-lg">💬</span>
        {commentCount > 0 && (
          <span className="absolute -top-1 -right-1 inline-flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-red-500 rounded-full">
            {commentCount > 99 ? '99+' : commentCount}
          </span>
        )}
      </button>

      {isModalOpen && (
        <CommentsModal
          roundId={roundId}
          userId={userId}
          userName={userName}
          onClose={() => setIsModalOpen(false)}
          onCommentAdded={handleCommentAdded}
        />
      )}
    </>
  );
}
