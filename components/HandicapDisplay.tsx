interface HandicapDisplayProps {
  handicap: number
  totalRounds: number
}

export default function HandicapDisplay({ handicap, totalRounds }: HandicapDisplayProps) {
  return (
    <div className="card">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg md:text-xl font-bold">Your Handicap</h1>
          <p className="text-green-600 font-semibold text-xs mt-1">Track your stats</p>
        </div>
        <div className="flex gap-6 text-right">
          <div>
            <p className="text-xs text-gray-600">Handicap</p>
            <p className="text-xl font-bold text-green-600">{handicap.toFixed(1)}</p>
            {totalRounds < 8 && (
              <p className="text-xs text-yellow-700 mt-1">
                ⚠️ Need {8 - totalRounds} more
              </p>
            )}
          </div>
          <div>
            <p className="text-xs text-gray-600">Rounds</p>
            <p className="text-xl font-bold">{totalRounds}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
