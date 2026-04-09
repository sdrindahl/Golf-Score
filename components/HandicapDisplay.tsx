interface HandicapDisplayProps {
  handicap: number
  totalRounds: number
}

export default function HandicapDisplay({ handicap, totalRounds }: HandicapDisplayProps) {
  return (
    <div className="card bg-green-50 border-2 border-green-500">
      <h3 className="text-sm text-gray-600 mb-2">YOUR HANDICAP</h3>
      <div className="text-5xl font-bold text-green-700 mb-4">
        {handicap.toFixed(1)}
      </div>
      <p className="text-sm text-gray-600">
        Based on {totalRounds} round{totalRounds !== 1 ? 's' : ''}
      </p>
      {totalRounds < 8 && (
        <p className="text-xs text-yellow-700 mt-2 bg-yellow-50 p-2 rounded">
          ⚠️ Need {8 - totalRounds} more round{8 - totalRounds !== 1 ? 's' : ''} for accurate handicap
        </p>
      )}
    </div>
  )
}
