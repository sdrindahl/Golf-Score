import React from 'react';

// Types for props
interface Hole {
  holeNumber: number;
  par: number;
  yardage?: number;
  [key: string]: any;
}

interface ScorecardTableProps {
  holes: Hole[];
  scores: number[];
  selectedTee?: string;
  showTotals?: boolean;
  onEdit?: () => void;
}

// Helper to chunk array
function chunkArray<T>(arr: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
}

const teeNames = ['men', 'women', 'senior', 'championship'] as const;
const isValidTee = (tee: string): tee is typeof teeNames[number] => teeNames.includes(tee as any);

export const ScorecardTable: React.FC<ScorecardTableProps> = ({ holes, scores, selectedTee = 'men', showTotals = true, onEdit }) => {
  if (!holes || holes.length === 0) return null;
  const sections = chunkArray(holes, 9);

  // Compute totals
  const parTotals = sections.map(section => section.reduce((sum, h) => sum + (h.par || 0), 0));
  const scoreTotals = sections.map((section, idx) => section.reduce((sum, h, i) => sum + (typeof scores[idx * 9 + i] === 'number' && scores[idx * 9 + i] > 0 ? scores[idx * 9 + i] : 0), 0));
  const yardageTotals = sections.map(section => section.reduce((sum, h) => isValidTee(selectedTee) ? sum + (h[selectedTee]?.yardage || 0) : sum, 0));
  const totalPar = parTotals.reduce((a, b) => a + b, 0);
  const totalScore = scoreTotals.reduce((a, b) => a + b, 0);
  const totalYardage = yardageTotals.reduce((a, b) => a + b, 0);

  return (
    <div className="rounded-xl border bg-white shadow p-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-lg font-bold">Holes Completed</h3>
        {onEdit && (
          <button className="text-blue-700 underline text-sm font-semibold hover:text-blue-900" onClick={onEdit}>Edit</button>
        )}
      </div>
      <div className="overflow-x-auto w-full">
        {sections.map((section, sectionIdx) => {
          const startIdx = sectionIdx * 9;
          const isFrontNine = sectionIdx === 0;
          const parTotal = parTotals[sectionIdx];
          const scoreTotal = scoreTotals[sectionIdx];
          const yardageTotal = yardageTotals[sectionIdx];
          const yardages = section.map(h => isValidTee(selectedTee) ? h[selectedTee]?.yardage ?? '-' : '-');
          return (
            <table key={sectionIdx} className="min-w-full border text-center text-xs mb-2">
              <thead>
                <tr>
                  <th className="px-1 py-1 font-bold">Hole</th>
                  {section.map((h, i) => (
                    <th key={i} className="px-1 py-1 font-bold">{h.holeNumber ?? startIdx + i + 1}</th>
                  ))}
                  <th className="px-1 py-1 font-bold">{isFrontNine ? 'Out' : 'In'}</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="px-1 py-1 font-semibold">Yardage</td>
                  {yardages.map((y, i) => (
                    <td key={i} className="px-1 py-1">{y}</td>
                  ))}
                  <td className="px-1 py-1 font-bold bg-gray-100">{yardageTotal > 0 ? yardageTotal : ''}</td>
                </tr>
                <tr>
                  <td className="px-1 py-1 font-semibold">Par</td>
                  {section.map((h, i) => (
                    <td key={i} className="px-1 py-1">{h.par ?? '-'}</td>
                  ))}
                  <td className="px-1 py-1 font-bold bg-gray-100">{parTotal}</td>
                </tr>
                <tr>
                  <td className="px-1 py-1 font-semibold">Score</td>
                  {section.map((h, i) => {
                    const score = scores[startIdx + i];
                    const par = h.par ?? 0;
                    let shape = '';
                    let bg = '';
                    let text = 'text-gray-900';
                    let border = '';
                    let label = '';
                    if (typeof score === 'number' && score > 0) {
                      const diff = score - par;
                      if (score === 1) {
                        shape = 'rounded-full';
                        bg = 'bg-yellow-400';
                        border = 'border-2 border-yellow-600';
                        label = 'Ace';
                      } else if (diff <= -2) {
                        shape = 'rounded-full';
                        bg = 'bg-blue-400';
                        border = 'border-2 border-blue-700';
                        label = 'Eagle';
                      } else if (diff === -1) {
                        shape = 'rounded-full';
                        bg = 'bg-green-400';
                        border = 'border-2 border-green-700';
                        label = 'Birdie';
                      } else if (diff === 0) {
                        shape = 'rounded-full';
                        bg = 'bg-gray-200';
                        border = 'border-2 border-gray-400';
                        label = 'Par';
                      } else if (diff === 1) {
                        shape = 'rounded-full';
                        bg = 'bg-orange-300';
                        border = 'border-2 border-orange-500';
                        label = 'Bogey';
                      } else if (diff === 2) {
                        shape = 'rounded-full';
                        bg = 'bg-red-300';
                        border = 'border-2 border-red-500';
                        label = 'Double';
                      } else if (diff > 2) {
                        shape = 'rounded-full';
                        bg = 'bg-red-500';
                        border = 'border-2 border-red-700';
                        label = 'Other';
                      }
                    }
                    return (
                      <td key={i} className={`px-1 py-1`} title={label}>
                        {typeof score === 'number' && score > 0 ? (
                          <span className={`inline-block w-6 h-6 ${shape} ${bg} ${border} text-base font-semibold flex items-center justify-center`}>
                            {score}
                          </span>
                        ) : ''}
                      </td>
                    );
                  })}
                  <td className="px-1 py-1 font-bold bg-gray-100">{scoreTotal > 0 ? scoreTotal : ''}</td>
                </tr>
              </tbody>
            </table>
          );
        })}
        {showTotals && holes.length === 18 && (
          <table className="min-w-full border text-center text-xs">
            <tbody>
              <tr>
                <td className="px-1 py-1 font-bold">Total</td>
                <td colSpan={9} className="px-1 py-1 font-bold bg-gray-200">{parTotals[0]}</td>
                <td colSpan={9} className="px-1 py-1 font-bold bg-gray-200">{parTotals[1]}</td>
                <td className="px-1 py-1 font-bold bg-yellow-100">{totalPar}</td>
              </tr>
              <tr>
                <td className="px-1 py-1 font-bold">Score</td>
                <td colSpan={9} className="px-1 py-1 font-bold bg-blue-100">{scoreTotals[0] || ''}</td>
                <td colSpan={9} className="px-1 py-1 font-bold bg-blue-100">{scoreTotals[1] || ''}</td>
                <td className="px-1 py-1 font-bold bg-yellow-100">{totalScore || ''}</td>
              </tr>
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
