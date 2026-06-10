"use client";
import { useCallback, useEffect, useState, useRef } from 'react';
import { subscribeToRoundsInProgress } from '@/lib/roundsInProgress';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/useAuth';
import CommentsModal from '@/components/CommentsModal';

// LeaderboardByCourse component renders leaderboard tables grouped by parent course
// Type definitions for leaderboard
type Round = {
  id: string;
  user_name?: string;
  userName?: string;
  date?: string;
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

const COURSE_PREVIEW_IMAGES = [
  '/hole1.png',
  '/hole3.png',
  '/hole4.png',
  '/hole5.png',
  '/hole6.png',
  '/hole7.png',
  '/hole8.png',
  '/hole9.png',
];

function getPreviewImage(seed: string, index: number) {
  const total = `${seed}${index}`.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return COURSE_PREVIEW_IMAGES[total % COURSE_PREVIEW_IMAGES.length];
}

function getPlayerBadgeStyle(name: string) {
  const palettes = [
    'from-lime-600 to-green-700',
    'from-blue-600 to-indigo-700',
    'from-fuchsia-600 to-violet-700',
    'from-amber-500 to-orange-700',
    'from-cyan-600 to-teal-700',
    'from-sky-500 to-blue-700',
  ];
  const total = name.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return palettes[total % palettes.length];
}

function getInitials(name: string) {
  const parts = name.split(' ').filter(Boolean);
  return parts.slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'G';
}

function formatLeaderboardValue(value: number) {
  if (value === 0) return 'E';
  return value > 0 ? `+${value}` : `${value}`;
}

function getScoreColor(value: number) {
  if (value < 0) return 'text-lime-400';
  if (value > 0) return 'text-red-400';
  return 'text-white';
}

function formatRoundDate(date?: string) {
  if (!date) return 'Today';
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return 'Today';
  const today = new Date();
  const sameDay =
    parsed.getFullYear() === today.getFullYear() &&
    parsed.getMonth() === today.getMonth() &&
    parsed.getDate() === today.getDate();
  if (sameDay) return 'Today';
  return parsed.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function LeaderboardByCourse({ rounds, currentUserId, currentUserName, onOpenComments, commentCounts, selectedPlayers, onTogglePlayer }: { rounds: Round[]; currentUserId?: string; currentUserName?: string; onOpenComments?: (roundId: string) => void; commentCounts?: { [roundId: string]: number }; selectedPlayers?: Set<string>; onTogglePlayer?: (playerName: string) => void }) {
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
    <div className="flex flex-col gap-6 mt-6">
      {Object.entries(grouped).map(([parentName, group]: [string, Round[]], groupIndex: number) => {
        // Sort by toPar ascending, then by holes completed descending
        const sorted = [...group].sort((a: Round, b: Round) => {
          const aToPar = getToPar(a);
          const bToPar = getToPar(b);
          if (aToPar !== bToPar) return aToPar - bToPar;
          const aHoles = a.scores?.filter((s: number) => s > 0).length || 0;
          const bHoles = b.scores?.filter((s: number) => s > 0).length || 0;
          return bHoles - aHoles;
        });

        const rankLabels = sorted.map((round: Round, idx: number) => {
          const currentToPar = getToPar(round);
          const currentHoles = round.scores?.filter((s: number) => s > 0).length || 0;
          const firstIndex = sorted.findIndex((candidate: Round) => {
            const candidateToPar = getToPar(candidate);
            const candidateHoles = candidate.scores?.filter((s: number) => s > 0).length || 0;
            return candidateToPar === currentToPar && candidateHoles === currentHoles;
          });
          const matches = sorted.filter((candidate: Round) => {
            const candidateToPar = getToPar(candidate);
            const candidateHoles = candidate.scores?.filter((s: number) => s > 0).length || 0;
            return candidateToPar === currentToPar && candidateHoles === currentHoles;
          }).length;
          const baseRank = firstIndex + 1;
          return matches > 1 ? `T${baseRank}` : `${baseRank}`;
        });

        return (
          <div
            key={parentName}
            className="bg-[linear-gradient(180deg,rgba(8,24,18,0.92),rgba(10,28,20,0.84))] rounded-[22px] shadow-2xl border border-green-400/35 overflow-hidden backdrop-blur-md mx-4 sm:mx-0"
            style={{ boxShadow: '0 14px 28px rgba(0,0,0,0.35), inset 0 0 0 1px rgba(134,239,172,0.08)' }}
          >
            <div className="grid grid-cols-[56px_minmax(0,1fr)_52px] sm:grid-cols-[72px_minmax(0,1fr)_64px] gap-3 px-4 py-3 bg-[linear-gradient(180deg,rgba(12,48,31,0.95),rgba(10,37,24,0.92))] border-b border-green-400/18">
              <img
                src={getPreviewImage(parentName, groupIndex)}
                alt={parentName}
                className="w-14 h-14 sm:w-[72px] sm:h-[72px] rounded-[16px] object-cover border border-white/10"
              />
              <div className="min-w-0 flex flex-col justify-center">
                <h2 className="text-[15px] sm:text-[20px] font-bold text-white leading-tight truncate">{parentName}</h2>
                <div className="mt-1 flex items-center gap-2 flex-wrap text-[10px] sm:text-[11px] text-white/70">
                  <span className="inline-flex items-center gap-1">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
                    18 Holes
                  </span>
                  <span>•</span>
                  <span>Stroke Play</span>
                  <span>•</span>
                  <span>{formatRoundDate(sorted[0]?.date as string | undefined)}</span>
                </div>
              </div>
              <div className="flex flex-col items-end justify-center text-right">
                <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-lime-400/90">Round</span>
                <span className="text-[22px] sm:text-[28px] font-bold text-white leading-none">{sorted.length}</span>
              </div>
            </div>
            <div className="grid grid-cols-[24px_minmax(0,1fr)_36px_44px_44px_18px] sm:grid-cols-[40px_minmax(0,1fr)_52px_58px_58px_26px] gap-x-2 px-3 sm:px-4 py-3 border-b border-green-400/15 text-[9px] sm:text-[11px] font-semibold uppercase tracking-[0.12em] text-white/65 bg-black/10">
              <div>Pos</div>
              <div>Player</div>
              <div className="text-center">Thru</div>
              <div className="text-center">Last</div>
              <div className="text-center">Total</div>
              <div></div>
            </div>
            <div>
              {sorted.map((round: Round, idx: number) => {
                const holesCompleted = Array.isArray(round.scores) ? round.scores.filter((s: number) => s > 0).length : 0;
                const thru = round.in_progress === false ? 'F' : holesCompleted;
                const toPar = getToPar(round);
                const playerName = round.user_name || round.userName || '';
                const isSelected = selectedPlayers?.has(playerName) ?? false;
                const runningTotal = Array.isArray(round.scores)
                  ? round.scores.reduce((sum: number, score: number) => sum + (score > 0 ? score : 0), 0)
                  : 0;

                let last3: { score: number, par: number }[] = [];
                if (Array.isArray(round.scores) && Array.isArray(round.holes)) {
                  const played = round.scores
                    .map((score, i) => ({ score, par: round.holes?.[i]?.par ?? 0 }))
                    .filter((h) => h.score > 0 && h.par > 0);
                  last3 = played.slice(-3);
                }
                const lastCompletedHole = last3.length > 0 ? last3[last3.length - 1] : null;

                const childSummary = round.childNames && round.childNames.length > 0
                  ? round.childNames.join(', ')
                  : '';

                return (
                  <div
                    key={round.id}
                    className={`grid grid-cols-[24px_minmax(0,1fr)_36px_44px_44px_18px] sm:grid-cols-[40px_minmax(0,1fr)_52px_58px_58px_26px] gap-x-2 px-3 sm:px-4 py-3 sm:py-4 border-b border-white/8 ${idx === 0 ? 'bg-lime-400/14' : 'bg-transparent'}`}
                  >
                    <div className="flex items-center justify-center text-[14px] sm:text-2xl font-bold text-white">
                      {rankLabels[idx]}
                    </div>
                    <div className="min-w-0 flex items-center gap-2">
                      <div className={`inline-flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gradient-to-br ${getPlayerBadgeStyle(playerName)} text-white text-[11px] sm:text-sm font-bold shrink-0 shadow-lg`}>
                        {getInitials(playerName)}
                      </div>
                      <div className="min-w-0 flex-1 flex items-center gap-1.5 sm:gap-2">
                        <h3 className="text-[13px] sm:text-[16px] font-bold text-white truncate">{playerName}</h3>
                        {childSummary && (
                          <span className="hidden sm:inline text-[12px] text-white/60 truncate">{childSummary}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center justify-center text-[14px] sm:text-2xl font-bold text-white">{thru}</div>
                    <div className="flex items-center justify-center text-[14px] sm:text-2xl font-bold text-white">
                      {lastCompletedHole ? (
                        <LastHoleSymbol score={lastCompletedHole.score} par={lastCompletedHole.par} />
                      ) : (
                        <span className="text-[10px] sm:text-sm text-white/40">-</span>
                      )}
                    </div>
                    <div className="flex items-center justify-center text-[14px] sm:text-2xl font-bold text-white">{runningTotal}</div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onTogglePlayer?.(playerName);
                      }}
                      className={`flex items-center justify-center text-[16px] sm:text-2xl hover:scale-110 transition-transform ${isSelected ? 'text-lime-400' : 'text-white/60'}`}
                      title={isSelected ? 'Unselect player' : 'Select player'}
                    >
                      {isSelected ? '★' : '☆'}
                    </button>
                  </div>
                );
              })}
            </div>
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
    const courseIds = courseId.split(',').map((id: string) => id.trim()).filter(Boolean);
    const childCourses = courseIds
      .map((id: string) => courses.find((c: any) => c.id === id))
      .filter(Boolean);
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
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [isClient, setIsClient] = useState(false);
  const [openCommentsModal, setOpenCommentsModal] = useState<string | null>(null);
  const [commentCounts, setCommentCounts] = useState<{ [roundId: string]: number }>({});
  const [selectedPlayers, setSelectedPlayers] = useState<Set<string>>(new Set());
  const [showAllPlayers, setShowAllPlayers] = useState(true);
  const [pullRefreshing, setPullRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const pullStartYRef = useRef<number | null>(null);
  const PULL_THRESHOLD = 70;
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

  // Hydrate rounds with holes from localStorage
  function hydrateRoundsWithHoles(rounds: any[]): any[] {
    if (typeof window === 'undefined') return rounds;
    const savedCourses = localStorage.getItem('golfCourses');
    if (!savedCourses) return rounds;
    const courses = JSON.parse(savedCourses);
    return rounds.map((round) => {
      const courseIds = (round.course_id || round.courseId || '').split(',').map((id: string) => id.trim()).filter(Boolean);
      const foundCourses = courseIds
        .map((id: string) => courses.find((c: any) => c.id === id))
        .filter(Boolean);
      let holes: any[] = [];
      if (foundCourses.length > 0) {
        holes = foundCourses.flatMap((c: any) => Array.isArray(c.holes) ? c.holes : []);
      }
      return { ...round, holes };
    });
  }

  // Fetch and hydrate rounds
  const fetchAndHydrateRounds = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const response = await fetch('/api/admin-rounds-in-progress', {
        method: 'GET',
        cache: 'no-store',
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to load rounds in progress.');
      }
      const hydratedData = hydrateRoundsWithHoles(payload.rounds || []);
      setRounds(hydratedData);
    } catch (err) {
      setLoading(false);
      setRounds([]);
      setFetchError(err instanceof Error ? err.message : 'Failed to load rounds in progress.');
      console.error(err);
      return;
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Toggle player selection
  const togglePlayer = (playerName: string) => {
    const newSelected = new Set(selectedPlayers);
    if (newSelected.has(playerName)) {
      newSelected.delete(playerName);
    } else {
      newSelected.add(playerName);
    }
    setSelectedPlayers(newSelected);
  };

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
  }, [fetchAndHydrateRounds, isClient]);

  useEffect(() => {
    const handleTouchStart = (e: TouchEvent) => {
      if (window.scrollY === 0) {
        pullStartYRef.current = e.touches[0].clientY;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (pullStartYRef.current === null) return;
      const dist = e.touches[0].clientY - pullStartYRef.current;
      if (dist > 0) {
        setPullDistance(Math.min(dist, PULL_THRESHOLD * 1.5));
      }
    };

    const handleTouchEnd = async () => {
      if (pullDistance >= PULL_THRESHOLD) {
        setPullRefreshing(true);
        await fetchAndHydrateRounds();
        setPullRefreshing(false);
      }
      setPullDistance(0);
      pullStartYRef.current = null;
    };

    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchmove', handleTouchMove, { passive: true });
    document.addEventListener('touchend', handleTouchEnd);
    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [fetchAndHydrateRounds, pullDistance]);

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

  if (loading) return <div className="p-8 text-center">Loading...</div>;

  // Filter rounds based on selected players
  let displayedRounds = rounds;
  if (!showAllPlayers && selectedPlayers.size > 0) {
    displayedRounds = rounds.filter((r: any) => {
      const playerName = r.user_name || r.userName;
      return selectedPlayers.has(playerName);
    });
  }

  return (
    <div className="min-h-screen pb-32 bg-[#07110d] text-white">
      {(pullDistance > 10 || pullRefreshing) && (
        <div
          className="fixed top-0 left-0 w-full flex justify-center z-[999] pointer-events-none transition-all"
          style={{ transform: `translateY(${pullRefreshing ? 56 : Math.min(pullDistance * 0.6, 56)}px)` }}
        >
          <div className="flex items-center gap-2 bg-black/70 text-green-300 text-sm font-bold px-4 py-2 rounded-full shadow-lg">
            {pullRefreshing ? (
              <>
                <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                Refreshing leaderboard...
              </>
            ) : (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12l7 7 7-7"/></svg>
                {pullDistance >= PULL_THRESHOLD ? 'Release to refresh' : 'Pull to refresh leaderboard'}
              </>
            )}
          </div>
        </div>
      )}
      <div className="relative overflow-hidden rounded-b-[28px] border-b border-white/10 bg-black min-h-[210px] sm:min-h-[260px]">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: "url('/hole1.png')" }}
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(6,13,11,0.18),rgba(6,13,11,0.72)_55%,rgba(6,13,11,0.94))]" />
        <div className="relative max-w-xl mx-auto px-4 pt-[calc(env(safe-area-inset-top)+18px)] sm:pt-8 pb-4">
          <div className="mb-1">
            <h1 className="text-[28px] sm:text-[40px] font-bold tracking-tight leading-none text-white">Rounds in Progress</h1>
            <div className="mt-2 text-green-400 text-[19px] sm:text-[22px] font-semibold tracking-tight">Live Leaderboard</div>
          </div>

          <div className="mt-5 mb-1 flex items-center gap-3 px-0">
            <div className="flex-1 bg-black/35 rounded-2xl border border-white/15 p-1 backdrop-blur-md shadow-lg min-w-0">
              <div className="grid grid-cols-2 gap-1">
                <button
                  onClick={() => setShowAllPlayers(true)}
                  className={`font-semibold py-2.5 px-4 rounded-[14px] transition-all duration-150 text-[15px] flex items-center justify-center gap-2 ${
                    showAllPlayers
                      ? 'bg-lime-400 text-[#112212] shadow-[0_10px_20px_rgba(132,204,22,0.25)]'
                      : 'text-white/80'
                  }`}
                >
                  <span className="text-base">👥</span>
                  <span>All Players</span>
                </button>
                <button
                  onClick={() => setShowAllPlayers(false)}
                  className={`font-semibold py-2.5 px-4 rounded-[14px] transition-all duration-150 text-[15px] flex items-center justify-center gap-2 ${
                    !showAllPlayers
                      ? 'bg-lime-400 text-[#112212] shadow-[0_10px_20px_rgba(132,204,22,0.25)]'
                      : 'text-white/80'
                  }`}
                >
                  <span className="text-base">☆</span>
                  <span>Favorites</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="bg-[#07110d]">
        <div className="max-w-xl mx-auto px-0 sm:px-4 py-4">
        {fetchError && (
          <div className="bg-black/45 rounded-2xl shadow-2xl border border-red-500/40 p-6 text-center backdrop-blur-md mx-4 sm:mx-0" style={{ boxShadow: '0 2px 16px 0 rgba(0,0,0,0.5)' }}>
            <p className="text-red-200 font-semibold">{fetchError}</p>
          </div>
        )}
        {!fetchError && displayedRounds.length === 0 && (
          <div className="bg-black/45 rounded-2xl shadow-2xl border border-white/10 p-6 text-center backdrop-blur-md" style={{ boxShadow: '0 2px 16px 0 rgba(0,0,0,0.5)' }}>
            <p className="text-white/65 font-semibold">
              {rounds.length === 0 ? 'No rounds in progress.' : 'No rounds match selected players.'}
            </p>
          </div>
        )}
        {/* Leaderboard Table Cards by Parent Course */}
        {isClient && displayedRounds.length > 0 && (
          <>
            <LeaderboardByCourse rounds={displayedRounds} currentUserId={currentUser?.id} currentUserName={currentUser?.name} onOpenComments={setOpenCommentsModal} commentCounts={commentCounts} selectedPlayers={selectedPlayers} onTogglePlayer={togglePlayer} />
          </>
        )}
      </div>
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
    abbr = 'Tb'; color = '#f87171'; // Triple+ Bogey
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