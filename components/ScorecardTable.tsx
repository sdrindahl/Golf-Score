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
  sectionLabels?: string[];
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

export const ScorecardTable: React.FC<ScorecardTableProps> = ({ holes, scores, selectedTee = 'men', showTotals = true, onEdit, sectionLabels = [] }) => {
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
    <div className="rounded-2xl shadow-lg p-4" style={{ background: 'rgba(20,30,20,0.82)' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-base font-extrabold tracking-widest uppercase text-green-400">Holes Completed</h3>
        {onEdit && (
          <button className="text-gray-300 text-sm font-semibold hover:text-white" onClick={onEdit}>Edit</button>
        )}
      </div>

      {/* Per-nine tables */}
      <div className="overflow-x-auto w-full">
        {sections.map((section, sectionIdx) => {
          const startIdx = sectionIdx * 9;
          const isFrontNine = sectionIdx === 0;
          const sectionLabel = sectionLabels[sectionIdx] || '';
          const parTotal = parTotals[sectionIdx];
          const scoreTotal = scoreTotals[sectionIdx];
          const yardageTotal = yardageTotals[sectionIdx];
          return (
            <table key={sectionIdx} className="min-w-full text-center text-xs mb-3" style={{ borderCollapse: 'collapse' }}>
              <thead>
                {sectionLabel && (
                  <tr>
                    <th colSpan={section.length + 2} className="py-1 text-xs font-semibold text-gray-300 text-center">
                      {sectionLabel}
                    </th>
                  </tr>
                )}
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.15)' }}>
                  <th className="px-1 py-1 font-bold text-white text-left">Hole</th>
                  {section.map((h, i) => (
                    <th key={i} className="px-1 py-1 font-bold text-white">{h.holeNumber ?? startIdx + i + 1}</th>
                  ))}
                  <th className="px-1 py-1 font-bold text-gray-400">{isFrontNine ? 'Out' : 'In'}</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                  <td className="px-1 py-1 text-gray-400 text-left text-[10px]">Yardage</td>
                  {section.map((h, i) => {
                    let yard = '-';
                    if (isValidTee(selectedTee) && h[selectedTee] && typeof h[selectedTee].yardage === 'number') {
                      yard = h[selectedTee].yardage.toString();
                    } else if (typeof h.yardage === 'number') {
                      yard = h.yardage.toString();
                    }
                    return <td key={i} className="px-1 py-1 text-[10px] text-gray-300">{yard}</td>;
                  })}
                  <td className="px-1 py-1 text-[10px] text-gray-300 font-bold">{yardageTotal > 0 ? yardageTotal : ''}</td>
                </tr>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                  <td className="px-1 py-1 text-gray-400 text-left text-[10px]">Par</td>
                  {section.map((h, i) => (
                    <td key={i} className="px-1 py-1 text-white">{h.par ?? '-'}</td>
                  ))}
                  <td className="px-1 py-1 text-white font-bold">{parTotal}</td>
                </tr>
                <tr>
                  <td className="px-1 py-1 text-gray-400 text-left text-[10px]">Score</td>
                  {section.map((h, i) => {
                    const score = scores[startIdx + i];
                    const par = h.par ?? 0;
                    let bg = '';
                    let border = '';
                    let label = '';
                    if (typeof score === 'number' && score > 0) {
                      const diff = score - par;
                      if (score === 1)       { bg = 'bg-yellow-400'; border = 'border-2 border-yellow-600'; label = 'Ace'; }
                      else if (diff <= -2)   { bg = 'bg-blue-400';   border = 'border-2 border-blue-700';   label = 'Eagle'; }
                      else if (diff === -1)  { bg = 'bg-green-400';  border = 'border-2 border-green-700';  label = 'Birdie'; }
                      else if (diff === 0)   { bg = 'bg-gray-300';   border = 'border-2 border-gray-500';   label = 'Par'; }
                      else if (diff === 1)   { bg = 'bg-orange-300'; border = 'border-2 border-orange-500'; label = 'Bogey'; }
                      else if (diff === 2)   { bg = 'bg-red-300';    border = 'border-2 border-red-500';    label = 'Double'; }
                      else                   { bg = 'bg-red-500';    border = 'border-2 border-red-700';    label = 'Other'; }
                    }
                    return (
                      <td key={i} className="px-1 py-1" title={label}>
                        {typeof score === 'number' && score > 0 ? (
                          <span className={`inline-flex w-5 h-5 rounded-full ${bg} ${border} text-xs font-semibold items-center justify-center text-gray-900`}>
                            {score}
                          </span>
                        ) : ''}
                      </td>
                    );
                  })}
                  <td className="px-1 py-1 font-bold text-white">{scoreTotal > 0 ? scoreTotal : ''}</td>
                </tr>
              </tbody>
            </table>
          );
        })}
      </div>

      {/* Summary cards: Front 9 / Back 9 / Total */}
      {showTotals && holes.length === 18 && (
        <div className="flex gap-2 mt-2">
          <div className="flex-1 rounded-xl border-2 border-yellow-500 bg-black/30 px-3 py-2">
            <div className="text-xs font-bold text-white">{sectionLabels[0] || 'Front 9'}:</div>
            <div className="text-sm font-extrabold text-white">{scoreTotals[0] || 0} <span className="text-xs font-normal text-gray-400">/ Par {parTotals[0]}</span></div>
          </div>
          <div className="flex-1 rounded-xl border-2 border-blue-500 bg-black/30 px-3 py-2">
            <div className="text-xs font-bold text-white">{sectionLabels[1] || 'Back 9'}:</div>
            <div className="text-sm font-extrabold text-white">{scoreTotals[1] || 0} <span className="text-xs font-normal text-gray-400">/ Par {parTotals[1]}</span></div>
          </div>
          <div className="flex-1 rounded-xl border-2 border-green-500 bg-black/30 px-3 py-2">
            <div className="text-xs font-bold text-white">Total:</div>
            <div className="text-sm font-extrabold text-yellow-300">{totalScore || 0} <span className="text-xs font-normal text-gray-400">/ Par {totalPar}</span></div>
          </div>
        </div>
      )}
      {/* 9-hole single summary */}
      {showTotals && holes.length === 9 && (
        <div className="flex gap-2 mt-2">
          <div className="flex-1 rounded-xl border-2 border-green-500 bg-black/30 px-3 py-2">
            <div className="text-xs font-bold text-white">Total:</div>
            <div className="text-sm font-extrabold text-yellow-300">{scoreTotals[0] || 0} <span className="text-xs font-normal text-gray-400">/ Par {parTotals[0]}</span></div>
          </div>
        </div>
      )}
    </div>
  );
};
