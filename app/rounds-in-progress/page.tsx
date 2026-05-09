"use client";
import { useEffect, useState, useRef } from 'react';
import { getRoundsInProgress, subscribeToRoundsInProgress } from '@/lib/roundsInProgress';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/useAuth';
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
          <div key={parentName} className="bg-white rounded-2xl shadow-lg p-0 overflow-hidden border border-green-200 w-full">
            <div className="bg-green-800 text-white text-base font-semibold px-3 py-2">{parentName}</div>
            <div className="overflow-x-auto w-full">
              <table className="w-full text-sm min-w-max">
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
                  const playerName = round.user_name || round.userName || '';
                  const isSelected = selectedPlayers?.has(playerName) ?? false;
                  
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
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onTogglePlayer?.(playerName);
                            }}
                            className="flex-shrink-0 hover:scale-125 transition-transform"
                            title={isSelected ? 'Unselect player' : 'Select player'}
                          >
                            {isSelected ? (
                              <span className="text-lg">⭐</span>
                            ) : (
                              <span className="text-lg opacity-40">☆</span>
                            )}
                          </button>
                          <span className="min-w-0 truncate">{playerName}</span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenComments?.(round.id);
                            }}
                            className="flex items-center gap-1 hover:opacity-70 transition-opacity flex-shrink-0"
                            title="View comments"
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
  const [selectedPlayers, setSelectedPlayers] = useState<Set<string>>(new Set());
  const [showAllPlayers, setShowAllPlayers] = useState(true);
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
    // Get current user to filter by their ID (FIX: prevent cross-user access bug)
    const user = auth.getCurrentUser();
    const userId = user?.id;
    
    getRoundsInProgress(userId).then(data => {
      const hydratedData = hydrateRoundsWithHoles(data || []);
      setRounds(hydratedData);
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

  if (loading) return <div className="p-8 text-center">Loading...</div>;

  // Filter rounds based on selected players
  let displayedRounds = rounds;
  if (!showAllPlayers && selectedPlayers.size > 0) {
    displayedRounds = rounds.filter((r: any) => {
      const playerName = r.user_name || r.userName;
      return selectedPlayers.has(playerName);
    });
  }

  // Navigation handlers for bottom nav
  const handleViewRounds = () => router.push('/')
  const handleViewCourses = () => router.push('/courses')
  const handleViewGolfers = () => router.push('/players')
  const handleSettings = () => router.push('/settings')

  return (
    <div className="min-h-screen flex flex-col pb-24" style={{ background: 'var(--green-bg)' }}>
      <div className="max-w-xl mx-auto px-2 sm:px-4 py-4">
        <h1 className="text-3xl sm:text-4xl font-bold text-white mb-4 drop-shadow-lg text-center">Rounds in Progress</h1>
        
        {/* View All Players / View Selected Toggle Button */}
        <div className="mb-4 flex justify-center gap-3 flex-wrap">
          <button
            onClick={() => setShowAllPlayers(true)}
            className={`font-semibold py-1 px-4 rounded-full shadow transition-all duration-150 text-sm ${
              showAllPlayers
                ? 'bg-blue-600 hover:bg-blue-700 text-white'
                : 'bg-gray-400 hover:bg-gray-500 text-white'
            }`}
          >
            All Players
          </button>
          <button
            onClick={() => setShowAllPlayers(false)}
            className={`font-semibold py-1 px-4 rounded-full shadow transition-all duration-150 text-sm ${
              !showAllPlayers
                ? 'bg-blue-600 hover:bg-blue-700 text-white'
                : 'bg-gray-400 hover:bg-gray-500 text-white'
            }`}
          >
            Favorites
          </button>
        </div>
        
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
        {displayedRounds.length === 0 && (
          <div className="bg-white/90 rounded-xl shadow-md p-6 text-center">
            <p className="text-gray-500 font-semibold">
              {rounds.length === 0 ? 'No rounds in progress.' : 'No rounds match selected players.'}
            </p>
          </div>
        )}
        {/* Leaderboard Table Cards by Parent Course */}
        {isClient && displayedRounds.length > 0 && (
          <>
            <LeaderboardByCourse rounds={displayedRounds} currentUserId={currentUser?.id} currentUserName={currentUser?.name} onOpenComments={setOpenCommentsModal} commentCounts={commentCounts} selectedPlayers={selectedPlayers} onTogglePlayer={togglePlayer} />
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