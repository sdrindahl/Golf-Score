"use client";
export const dynamic = "force-dynamic";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import PageWrapper from "@/components/PageWrapper";
import type { ChildCourse } from "@/types/api";


function CourseNinesPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const parentId = searchParams?.get("id");
  const [childCourses, setChildCourses] = useState<ChildCourse[]>([]);
  const [selectedChildIds, setSelectedChildIds] = useState<string[]>([]);
  const [showInProgressModal, setShowInProgressModal] = useState(false);
  const [inProgressRoundId, setInProgressRoundId] = useState<string | null>(null);

  useEffect(() => {
    if (!parentId) return;
    fetch(`/api/get-child-courses?parentId=${parentId}`)
      .then((res) => res.json())
      .then((data) => setChildCourses(data));
  }, [parentId]);

  return (
    <PageWrapper title="Select Nines">
      <div className="max-w-lg mx-auto mt-8 flex flex-col gap-6">
        <h2 className="text-xl font-bold mb-2 text-center">Select up to 2 Nines</h2>
        {childCourses.length === 0 ? (
          <div className="card text-center text-gray-500">No nines found for this course.</div>
        ) : (
          childCourses.map((child) => {
            const isSelected = selectedChildIds.includes(child.id);
            return (
              <div key={child.id} className={`flex items-center gap-2 card bg-green-100 hover:bg-green-200 transition-all p-2 mb-2`}>
                <div>
                  <h4 className="text-base font-semibold">{child.name}</h4>
                  <div className="mt-1 flex gap-4 text-xs">
                    <span>⛳ {child.holeCount} Holes</span>
                    {child.par && <span>📍 Par {child.par}</span>}
                  </div>
                </div>
                <button
                  className={`ml-auto px-3 py-1 rounded ${isSelected ? 'bg-red-400 text-white' : 'bg-blue-500 text-white'} disabled:opacity-50`}
                  onClick={() => {
                    if (isSelected) {
                      setSelectedChildIds(selectedChildIds.filter((id) => id !== child.id));
                    } else if (selectedChildIds.length < 2) {
                      setSelectedChildIds([...selectedChildIds, child.id]);
                    }
                  }}
                  disabled={!isSelected && selectedChildIds.length >= 2}
                  type="button"
                >
                  {isSelected ? "Deselect" : "Select"}
                </button>
              </div>
            );
          })
        )}
        <button
          className="btn btn-primary mt-2 w-full"
          disabled={selectedChildIds.length === 0}
          onClick={async () => {
            // Prevent starting a round if one is already in progress
            let currentUser = null;
            try {
              const userStr = localStorage.getItem('currentUser');
              if (userStr) currentUser = JSON.parse(userStr);
            } catch {}
            if (!currentUser) {
              alert('Please log in first.');
              router.push('/login');
              return;
            }
            let hasInProgress = false;
            try {
              const response = await fetch('/api/get-in-progress-rounds', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: currentUser.id })
              });
              const result = await response.json();
              hasInProgress = Array.isArray(result.rounds) && result.rounds.length > 0;
            } catch (err) {}
            // Check localStorage for in-progress round
            const savedRounds = localStorage.getItem('golfRounds');
            let localHasInProgress = false;
            if (savedRounds) {
              try {
                const rounds = JSON.parse(savedRounds);
                localHasInProgress = rounds.some((r: any) => r.userId === currentUser.id && r.in_progress);
              } catch {}
            }
            if (hasInProgress || localHasInProgress) {
              // Get the round ID for "Continue" option
              let roundId: string | null = null;
              if (hasInProgress) {
                try {
                  const response = await fetch('/api/get-in-progress-rounds', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId: currentUser.id })
                  });
                  const result = await response.json();
                  if (result.rounds && result.rounds.length > 0) {
                    roundId = result.rounds[0].id;
                  }
                } catch (err) {}
              } else if (localHasInProgress) {
                // If only in localStorage (round was auto-deleted), get the ID from there
                try {
                  const savedRounds = localStorage.getItem('golfRounds');
                  if (savedRounds) {
                    const rounds = JSON.parse(savedRounds);
                    const userRound = rounds.find((r: any) => r.userId === currentUser.id && r.in_progress);
                    if (userRound) {
                      roundId = userRound.id;
                    }
                  }
                } catch (err) {}
              }
              setInProgressRoundId(roundId);
              setShowInProgressModal(true);
              return;
            }
            const ninesParam = selectedChildIds.join(",");
            router.push(`/select-tee?nines=${ninesParam}`);
          }}
          type="button"
        >
          Start Round
        </button>
        <button
          className="mt-2 px-8 py-2 rounded-full bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold border border-gray-300 shadow transition-all"
          onClick={() => router.push("/courses")}
          type="button"
        >
          Back to Courses
        </button>
      </div>

      {/* Modal for in-progress round */}
      {showInProgressModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-sm mx-4 shadow-xl">
            <h2 className="text-xl font-bold mb-4">Round in Progress</h2>
            <p className="text-gray-700 mb-6">You already have a round in progress. What would you like to do?</p>
            <div className="flex flex-col gap-3">
              <button
                onClick={() => {
                  setShowInProgressModal(false);
                  if (inProgressRoundId) {
                    router.push(`/track-round?id=${inProgressRoundId}`);
                  }
                }}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded transition"
              >
                Continue Round
              </button>
              <button
                onClick={async () => {
                  if (inProgressRoundId) {
                    try {
                      const response = await fetch('/api/delete-round', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ roundId: inProgressRoundId })
                      });
                      // Clear from localStorage as well
                      const savedRounds = localStorage.getItem('golfRounds');
                      if (savedRounds) {
                        try {
                          let rounds = JSON.parse(savedRounds);
                          rounds = rounds.filter((r: any) => r.id !== inProgressRoundId);
                          localStorage.setItem('golfRounds', JSON.stringify(rounds));
                        } catch (err) {}
                      }
                      setShowInProgressModal(false);
                      // Start new round
                      const ninesParam = selectedChildIds.join(",");
                      router.push(`/select-tee?nines=${ninesParam}`);
                    } catch (err) {
                      console.error('Error ending round:', err);
                      alert('Failed to end the round. Please try again.');
                    }
                  }
                }}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded transition"
              >
                End Round
              </button>
              <button
                onClick={() => setShowInProgressModal(false)}
                className="px-4 py-2 bg-gray-300 hover:bg-gray-400 text-gray-700 font-semibold rounded transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </PageWrapper>
  );
}

export default function CourseNinesPage() {
  return (
    <Suspense>
      <CourseNinesPageInner />
    </Suspense>
  );
}
