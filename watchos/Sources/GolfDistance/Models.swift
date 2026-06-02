import Foundation

// MARK: - API response models (must match /api/watch-yardage)

struct WatchAPIResponse: Codable {
    let courses: [WatchCourse]
}

struct WatchCourse: Codable, Identifiable, Hashable {
    let id: String
    let name: String
    let holes: [WatchHole]
}

struct WatchHole: Codable, Identifiable, Hashable {
    let holeNumber: Int
    let par: Int
    let greenLat: Double
    let greenLng: Double
    /// Men's tee yardage from the scorecard (static reference)
    let yardage: Int

    var id: Int { holeNumber }

    /// Human-readable label, e.g. "Hole 7"
    var label: String { "Hole \(holeNumber)" }

    /// Par label, e.g. "Par 4"
    var parLabel: String { "Par \(par)" }
}
