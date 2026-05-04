"use client";
import { useEffect, useState, useRef } from 'react';
import { getRoundsInProgress, subscribeToRoundsInProgress } from '@/lib/roundsInProgress';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/useAuth';
import CommentsBubble from '@/components/CommentsBubble';
import CommentsModal from '@/components/CommentsModal';
// import Link from 'next/link';

// LeaderboardByCourse component renders leaderboard tables grouped by parent course
// Type definitions for leaderboard
type Round = {
  id: string;
  user_name?: string;
  userName?: string;
  course_id?: string;
  courseId?: string;
  scores?: number[];
  holes?: { par?: number }[];
  total_score?: number;
  totalScore?: number;
  in_progress?: boolean;
  parentName?: string;
  childNames?: string[];
};

type GroupedRounds = {
  [key: string]: Round[];
};

function LeaderboardByCourse({ rounds, currentUserId, currentUserName, onOpenComments, commentCounts, openEmojiPicker, onOpenEmojiPicker, onEmojiReaction, roundReactions, userReactions, whoReactedModal, onShowWhoReacted }: { rounds: Round[]; currentUserId?: string; currentUserName?: string; onOpenComments?: (roundId: string) => void; commentCounts?: { [roundId: string]: number }; openEmojiPicker?: string | null; onOpenEmojiPicker?: (roundId: string | null) => void; onEmojiReaction?: (roundId: string, emoji: string) => void; roundReactions?: { [roundId: string]: { [emoji: string]: { count: number; users: { user_id: string; user_name: string }[] } } }; userReactions?: { [roundId: string]: string[] }; whoReactedModal?: { roundId: string; emoji: string } | null; onShowWhoReacted?: (modal: { roundId: string; emoji: string } | null) => void }) {
  // Helper to group rounds by parent course name
  function groupByParent(rounds: Round[]): GroupedRounds {
    const grouped: GroupedRounds = {};
    for (const round of rounds) {
      const { parentName, childNames } = getCourseNames(round.course_id || round.courseId || "");
      const key = parentName || 'Unknown Course';
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push({ ...round, parentName, childNames });
    }
    return grouped;
  }

  // Calculate toPar and holes completed for sorting
  function getToPar(round: Round): number {
    const holesCompleted = Array.isArray(round.scores) ? round.scores.filter((s: number) => s > 0).length : 0;
    const totalPar = Array.isArray(round.holes) ? round.holes.slice(0, holesCompleted).reduce((sum: number, h: { par?: number }) => sum + (h.par || 0), 0) : 0;
    const playedScores = Array.isArray(round.scores) ? round.scores.slice(0, holesCompleted).reduce((sum, s) => sum + (s > 0 ? s : 0), 0) : 0;
    return totalPar ? playedScores - totalPar : playedScores;
  }

  const grouped = groupByParent(rounds);

  return (
    <div className="flex flex-col gap-8 mt-6">
      {Object.entries(grouped).map(([parentName, group]: [string, Round[]]) => {
        // Sort by toPar ascending, then by holes completed descending
        const sorted = [...group].sort((a: Round, b: Round) => {
          const aToPar = getToPar(a);
          const bToPar = getToPar(b);
          if (aToPar !== bToPar) return aToPar - bToPar;
          const aHoles = a.scores?.filter((s: number) => s > 0).length || 0;
          const bHoles = b.scores?.filter((s: number) => s > 0).length || 0;
          return bHoles - aHoles;
        });
        return (
          <div key={parentName} className="bg-white rounded-2xl shadow-lg p-0 overflow-x-auto border border-green-200 w-full max-w-full">
            <div className="bg-green-800 text-white text-base font-semibold px-3 py-2">{parentName}</div>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-green-50 border-b border-green-200">
                  <th className="px-2 py-2 text-left font-semibold text-gray-700"></th>
                  <th className="px-2 py-2 text-left font-semibold text-gray-700"> </th>
                  <th className="px-2 py-2 text-center font-semibold text-gray-700">+/-</th>
                  <th className="px-2 py-2 text-center font-semibold text-gray-700">Thru</th>
                  <th className="px-2 py-2 text-center font-semibold text-gray-700">TOT</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((round: Round, idx: number) => {
                  const holesCompleted = Array.isArray(round.scores) ? round.scores.filter((s: number) => s > 0).length : 0;
                  const thru = round.in_progress === false ? 'F' : holesCompleted;
                  const toPar = getToPar(round);
                  const totalScore = round.total_score ?? round.totalScore ?? 0;
                  // Get last 3 holes (score/par)
                  let last3: { score: number, par: number }[] = [];
                  if (Array.isArray(round.scores) && Array.isArray(round.holes)) {
                    const played = round.scores
                      .map((score, i) => ({ score, par: round.holes?.[i]?.par ?? 0 }))
                      .filter((h) => h.score > 0 && h.par > 0);
                    last3 = played.slice(-3);
                  }

                  return (
                    <tr key={round.id} className="border-b last:border-b-0 hover:bg-green-50 cursor-pointer" onClick={() => window.location.href = `/round-detail?id=${round.id}&from=rounds-in-progress`}>
                      <td className="px-2 py-2 align-middle w-8">
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-green-100 text-green-800 text-xs font-bold">{idx + 1}</span>
                      </td>
                      <td className="px-2 py-2">
                        <div className="font-semibold text-gray-800 flex items-center gap-2 whitespace-nowrap overflow-hidden text-ellipsis">
                          {round.user_name || round.userName}
                          <div className="relative">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onOpenEmojiPicker?.(openEmojiPicker === round.id ? null : round.id);
                              }}
                              className="flex items-center gap-1 hover:opacity-70 transition-opacity flex-shrink-0"
                              title="Add reaction"
                            >
                              <div className="flex gap-0.5">
                                {(userReactions && userReactions[round.id]?.length > 0) ? (
                                  userReactions[round.id].map((emoji) => (
                                    <span key={emoji} className="text-sm">{emoji}</span>
                                  ))
                                ) : (
                                  <span className="text-sm">👍</span>
                                )}
                              </div>
                              {roundReactions && roundReactions[round.id] && Object.values(roundReactions[round.id]).reduce((sum: number, data: any) => sum + (data.count || 0), 0) > 0 && (
                                <span className="text-xs font-semibold text-gray-700">
                                  {Object.values(roundReactions[round.id]).reduce((sum: number, data: any) => sum + (data.count || 0), 0)}
                                </span>
                              )}
                            </button>
                            {openEmojiPicker === round.id && (
                              <div className="fixed bg-white rounded-lg shadow-xl border border-gray-300 p-3 z-50" style={{ 
                                left: '50%',
                                top: '200px',
                                transform: 'translateX(-50%)',
                                minWidth: '320px'
                              }}>
                                <div className="flex gap-2 flex-wrap justify-center">
                                  {['👍', '❓', '💩'].map((emoji) => {
                                    const reactionData = roundReactions && roundReactions[round.id]?.[emoji];
                                    const userHasReacted = userReactions && userReactions[round.id]?.includes(emoji);
                                    const count = reactionData?.count || 0;

                                    return (
                                      <div
                                        key={emoji}
                                        className="flex flex-col items-center gap-1"
                                      >
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            onEmojiReaction?.(round.id, emoji);
                                          }}
                                          className={`flex flex-col items-center gap-1 p-2 rounded transition-all ${
                                            userHasReacted
                                              ? 'bg-blue-100 border-2 border-blue-500'
                                              : 'hover:bg-gray-100 border-2 border-transparent'
                                          }`}
                                        >
                                          <span className="text-2xl">{emoji}</span>
                                        </button>
                                        {count > 0 && (
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              onShowWhoReacted?.({ roundId: round.id, emoji });
                                            }}
                                            className="text-xs font-bold text-blue-600 hover:underline cursor-pointer"
                                          >
                                            {count}
                                          </button>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenComments?.(round.id);
                            }}
                            className="flex items-center gap-1 hover:opacity-70 transition-opacity flex-shrink-0"
                            title="View reactions and comments"
                          >
                            <span className="text-sm">💬</span>
                          </button>
                        </div>
                        {round.childNames && round.childNames.length > 0 && (
                          <div className="text-xs text-gray-600 font-normal whitespace-nowrap overflow-hidden text-ellipsis">{round.childNames.join(', ')}</div>
                        )}
                      </td>
                      {/* Remove old Comments Bubble column */}
                      <td className="px-4 py-2 text-center font-bold text-lg text-gray-900 align-middle">
                        {toPar > 0 ? `+${toPar}` : toPar === 0 ? 'E' : toPar}
                        {/* Last 3 holes symbols */}
                        <div className="flex flex-row gap-1 justify-center mt-1">
                          {last3.map((h, i) => (
                            <LastHoleSymbol key={i} score={h.score} par={h.par} />
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-2 text-center font-semibold text-gray-800">{thru}</td>
                      <td className="px-4 py-2 text-center font-semibold text-gray-800">{totalScore}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}

// Helper to get parent/child course names from localStorage
function getCourseNames(courseId: string) {
  if (typeof window === 'undefined') return { parentName: '', childNames: [] };
  const savedCourses = localStorage.getItem('golfCourses');
  if (!savedCourses) return { parentName: '', childNames: [] };
  const courses = JSON.parse(savedCourses);
  let parentName = '';
  let childNames: string[] = [];
  if (courses && courseId) {
    const courseIds = courseId.split(',');
    const childCourses = courses.filter((c: any) => courseIds.includes(c.id));
    if (childCourses.length > 0) {
      const parentId = childCourses[0].parent_id;
      if (parentId) {
        const parent = courses.find((c: any) => c.id === parentId);
        if (parent) parentName = parent.name;
      }
      childNames = childCourses.map((c: any) => c.name);
    } else {
      const course = courses.find((c: any) => c.id === courseId);
      if (course && course.parent_id) {
        const parent = courses.find((c: any) => c.id === course.parent_id);
        if (parent) parentName = parent.name;
        childNames = [course.name];
      } else if (course) {
        childNames = [course.name];
      }
    }
  }
  return { parentName, childNames };
}

export default function RoundsInProgressPage() {
  const router = useRouter();
  const auth = useAuth();
  const [rounds, setRounds] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isClient, setIsClient] = useState(false);
  const [openCommentsModal, setOpenCommentsModal] = useState<string | null>(null);
  const [commentCounts, setCommentCounts] = useState<{ [roundId: string]: number }>({});
  const [openEmojiPicker, setOpenEmojiPicker] = useState<string | null>(null);
  const [roundReactions, setRoundReactions] = useState<{ [roundId: string]: { [emoji: string]: { count: number; users: { user_id: string; user_name: string }[] } } }>({});
  const [userReactions, setUserReactions] = useState<{ [roundId: string]: string[] }>({});
  const [whoReactedModal, setWhoReactedModal] = useState<{ roundId: string; emoji: string } | null>(null);
  const fetchedReactionsRef = useRef<Set<string>>(new Set());
  const currentUser = auth.getCurrentUser();

  // Fetch comment counts for a specific round
  const fetchCommentCount = async (roundId: string) => {
    try {
      const res = await fetch('/api/get-comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roundId }),
      });
      const data = await res.json();
      const count = data.comments?.length || 0;
      setCommentCounts((prev) => ({ ...prev, [roundId]: count }));
      return count;
    } catch (error) {
      console.error(`Failed to fetch comments for round ${roundId}:`, error);
      return 0;
    }
  };

  // Fetch round reactions
  const fetchRoundReactions = async (roundId: string) => {
    try {
      const res = await fetch('/api/get-round-reactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roundId }),
      });
      const data = await res.json();
      setRoundReactions((prev) => ({ ...prev, [roundId]: data.reactions || {} }));

      // Calculate which emojis the current user has reacted with
      if (currentUser && data.reactions) {
        const userEmojis: string[] = [];
        for (const [emoji, reactionData] of Object.entries(data.reactions || {})) {
          const reaction = reactionData as { count: number; users: { user_id: string; user_name: string }[] };
          if (reaction.users?.some((u) => u.user_id === currentUser.id)) {
            userEmojis.push(emoji);
          }
        }
        setUserReactions((prev) => ({ ...prev, [roundId]: userEmojis }));
      }
    } catch (error) {
      console.error(`Failed to fetch reactions for round ${roundId}:`, error);
    }
  };

  // Toggle emoji reaction
  const handleEmojiReaction = async (roundId: string, emoji: string) => {
    if (!currentUser) return;

    try {
      const res = await fetch('/api/toggle-round-reaction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roundId,
          userId: currentUser.id,
          userName: currentUser.name,
          emoji,
        }),
      });

      if (res.ok) {
        // Refetch reactions to update UI
        await fetchRoundReactions(roundId);
        setOpenEmojiPicker(null);
      }
    } catch (error) {
      console.error('Failed to toggle reaction:', error);
    }
  };

  // Hydrate rounds with holes from localStorage
  function hydrateRoundsWithHoles(rounds: any[]): any[] {
    if (typeof window === 'undefined') return rounds;
    const savedCourses = localStorage.getItem('golfCourses');
    if (!savedCourses) return rounds;
    const courses = JSON.parse(savedCourses);
    return rounds.map((round) => {
      const courseIds = (round.course_id || round.courseId || '').split(',').map((id: string) => id.trim()).filter(Boolean);
      const foundCourses = courses.filter((c: any) => courseIds.includes(c.id));
      let holes: any[] = [];
      if (foundCourses.length > 0) {
        holes = foundCourses.flatMap((c: any) => Array.isArray(c.holes) ? c.holes : []);
      }
      return { ...round, holes };
    });
  }

  // Fetch and hydrate rounds
  const fetchAndHydrateRounds = () => {
    setLoading(true);
    getRoundsInProgress().then(data => {
      setRounds(hydrateRoundsWithHoles(data || []));
      setLoading(false);
    }).catch((err) => {
      setLoading(false);
      setRounds([]);
      console.error(err);
    });
  };

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!isClient) return;
    let subscription: any;
    fetchAndHydrateRounds();
    // Subscribe for real-time updates
    subscription = subscribeToRoundsInProgress(() => {
      fetchAndHydrateRounds();
    });
    return () => {
      if (subscription && subscription.unsubscribe) subscription.unsubscribe();
    };
  }, [isClient]);

  // Fetch comment counts for all rounds
  useEffect(() => {
    if (rounds.length === 0) return;

    const fetchCommentCounts = async () => {
      const counts: { [roundId: string]: number } = {};
      for (const round of rounds) {
        try {
          const res = await fetch('/api/get-comments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ roundId: round.id }),
          });
          const data = await res.json();
          counts[round.id] = data.comments?.length || 0;
        } catch (error) {
          console.error(`Failed to fetch comments for round ${round.id}:`, error);
          counts[round.id] = 0;
        }
      }
      setCommentCounts(counts);
    };

    fetchCommentCounts();
  }, [rounds]);

  // Fetch reactions for all rounds (only once per round)
  useEffect(() => {
    if (rounds.length === 0) return;

    const fetchAllReactions = async () => {
      for (const round of rounds) {
        // Skip if we already fetched this round's reactions
        if (fetchedReactionsRef.current.has(round.id)) continue;
        
        fetchedReactionsRef.current.add(round.id);
        await fetchRoundReactions(round.id);
      }
    };

    fetchAllReactions();
  }, [rounds.length]);

  if (loading) return <div className="p-8 text-center">Loading...</div>;

  // Navigation handlers for bottom nav
  const handleViewRounds = () => router.push('/')
  const handleViewCourses = () => router.push('/courses')
  const handleViewGolfers = () => router.push('/players')
  const handleSettings = () => router.push('/settings')

  return (
    <div className="min-h-screen flex flex-col pb-24" style={{ background: 'var(--green-bg)' }}>
      <div className="max-w-xl mx-auto px-2 sm:px-4 py-4">
        <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2 drop-shadow-lg text-center">Rounds in Progress</h1>
        {/* Helper text for last 3 holes symbols */}
        <div className="w-full text-center text-xs text-black mb-1">
          Symbols below +/- show last 3 holes
        </div>
        {/* Legend for last 3 holes symbols */}
        <div className="flex flex-row flex-wrap gap-2 items-center justify-center bg-white/80 rounded-md shadow p-1 mb-2 text-xs" style={{ fontSize: '12px' }}>
          <LegendSymbol abbr="A" color="#a020f0" label="Ace" />
          <LegendSymbol abbr="E" color="#2563eb" label="Eagle" />
          <LegendSymbol abbr="B" color="#22c55e" label="Birdie" />
          <LegendSymbol abbr="P" color="#a3a3a3" label="Par" />
          <LegendSymbol abbr="Bo" color="#ef4444" label="Bogey" />
          <LegendSymbol abbr="Db" color="#f59e42" label="Double Bogey" />
          <LegendSymbol abbr="Tb" color="#222" label="Triple+ Bogey" />
        </div>
        {rounds.length === 0 && (
          <div className="bg-white/90 rounded-xl shadow-md p-6 text-center">
            <p className="text-gray-500 font-semibold">No rounds in progress.</p>
          </div>
        )}
        {/* Leaderboard Table Cards by Parent Course */}
        {isClient && rounds.length > 0 && (
          <>
            <LeaderboardByCourse rounds={rounds} currentUserId={currentUser?.id} currentUserName={currentUser?.name} onOpenComments={setOpenCommentsModal} commentCounts={commentCounts} openEmojiPicker={openEmojiPicker} onOpenEmojiPicker={setOpenEmojiPicker} onEmojiReaction={handleEmojiReaction} roundReactions={roundReactions} userReactions={userReactions} whoReactedModal={whoReactedModal} onShowWhoReacted={setWhoReactedModal} />
            <div className="flex justify-start mt-3 mb-2">
              <button
                className="bg-green-700 hover:bg-green-800 text-white font-semibold py-2 px-6 rounded-full shadow transition-all duration-150"
                style={{ minWidth: '90px' }}
                onClick={fetchAndHydrateRounds}
                aria-label="Refresh rounds"
              >
                Refresh
              </button>
            </div>
          </>
        )}
      </div>

      {/* Comments Modal */}
      {openCommentsModal && currentUser && (
        <CommentsModal
          roundId={openCommentsModal}
          userId={currentUser.id}
          userName={currentUser.name || 'Anonymous'}
          onClose={() => setOpenCommentsModal(null)}
        />
      )}

      {/* Who Reacted Modal */}
      {whoReactedModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-lg max-w-sm w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">
                {whoReactedModal.emoji} Reactions
              </h3>
              <button
                onClick={() => setWhoReactedModal(null)}
                className="text-gray-500 hover:text-gray-700 text-2xl font-bold"
              >
                ×
              </button>
            </div>
            <div className="space-y-2">
              {roundReactions?.[whoReactedModal.roundId]?.[whoReactedModal.emoji]?.users?.map((user) => (
                <div key={user.user_id} className="flex items-center gap-2 p-2 hover:bg-gray-100 rounded">
                  <span className="text-2xl">{whoReactedModal.emoji}</span>
                  <span className="text-sm font-medium text-gray-700">{user.user_name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
// Legend symbol component
// Legend symbol component (letters version, with old symbol code commented)
function LegendSymbol({ abbr, color, label }: { abbr: string, color: string, label: string }) {
  return (
    <div className="flex items-center gap-1">
      <span
        style={{
          display: 'inline-block',
          minWidth: abbr.length === 1 ? 14 : 18,
          height: 14,
          color,
          fontWeight: 700,
          fontSize: 11,
          textAlign: 'center',
          lineHeight: '14px',
          letterSpacing: abbr.length > 1 ? '-1px' : '0',
        }}
      >
        {abbr}
        {/* 
        // Old symbol code for easy revert:
        // {shape === 'star' ? <svg ... /> : shape === 'circle' ? <span ... /> : <span ... />}
        */}
      </span>
      <span className="text-xs text-gray-700">{label}</span>
    </div>
  );
}

// Symbol for last 3 holes
// Symbol for last 3 holes (letters version, with old symbol code commented)
function LastHoleSymbol({ score, par }: { score: number, par: number }) {
  let abbr = '';
  let color = '#a3a3a3'; // default par gray

  if (score === 1) {
    abbr = 'A'; color = '#a020f0'; // Ace
  } else if (score <= par - 2) {
    abbr = 'E'; color = '#2563eb'; // Eagle (blue)
  } else if (score === par - 1) {
    abbr = 'B'; color = '#22c55e'; // Birdie
  } else if (score === par) {
    abbr = 'P'; color = '#a3a3a3'; // Par
  } else if (score === par + 1) {
    abbr = 'Bo'; color = '#ef4444'; // Bogey
  } else if (score === par + 2) {
    abbr = 'Db'; color = '#f59e42'; // Double Bogey
  } else if (score >= par + 3) {
    abbr = 'Tb'; color = '#222'; // Triple+ Bogey
  }

  return (
    <span
      className="inline-flex items-center justify-center"
      style={{
        minWidth: abbr.length === 1 ? 14 : 18,
        height: 14,
        color,
        fontWeight: 700,
        fontSize: 11,
        textAlign: 'center',
        lineHeight: '14px',
        letterSpacing: abbr.length > 1 ? '-1px' : '0',
      }}
    >
      {abbr}
      {/* 
      // Old symbol code for easy revert:
      // {shape === 'star' ? <svg ... /> : shape === 'circle' ? <span ... /> : <span ... />}
      */}
    </span>
  );
}