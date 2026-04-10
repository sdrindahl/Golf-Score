interface HandicapDisplayProps {
  handicap: number
  totalRounds: number
}

export default function HandicapDisplay({ handicap, totalRounds }: HandicapDisplayProps) {
  return (
    <div className="card bg-green-50 border-2 border-green-500 p-4">
      <div className="flex items-start justify-between mb-2">
        <h3 className="text-xs font-semibold text-gray-600">YOUR HANDICAP</h3>
        <div className="group relative">
          <span className="text-gray-400 text-sm cursor-help">ℹ️</span>
          <div className="hidden group-hover:block absolute right-0 z-10 w-56 bg-gray-800 text-white text-xs rounded p-3 whitespace-wrap">
            <p className="font-semibold mb-1">USGA Handicap Calculation:</p>
            <p>(Score - Course Rating) × 113 / Slope Rating</p>
            <p className="mt-1 text-gray-300">Uses best 8 of last 20 rounds</p>
          </div>
        </div>
      </div>
      <div className="text-3xl font-bold text-green-700 mb-2">
        {handicap.toFixed(1)}
      </div>
      <p className="text-xs text-gray-600">
        Based on {totalRounds} round{totalRounds !== 1 ? 's' : ''}
      </p>
      {totalRounds < 8 && (
        <p className="text-xs text-yellow-700 mt-2 bg-yellow-50 p-1 rounded">
          ⚠️ Need {8 - totalRounds} more round{8 - totalRounds !== 1 ? 's' : ''} for accurate handicap
        </p>
      )}
    </div>
  )
}
