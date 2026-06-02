import SwiftUI

/// Swipe left/right (or use Digital Crown) to move between holes.
/// Auto-advances to the nearest hole when a GPS fix arrives.
struct HoleSwipeView: View {

    let course:          WatchCourse
    @ObservedObject var locationManager: LocationManager
    let onChangeCourse:  () -> Void

    @State private var currentIndex: Int = 0
    @State private var didAutoSelect = false

    var body: some View {
        TabView(selection: $currentIndex) {
            ForEach(Array(course.holes.enumerated()), id: \.offset) { idx, hole in
                HoleDistanceView(
                    hole:           hole,
                    courseName:     course.name,
                    locationManager: locationManager,
                    onChangeCourse: onChangeCourse
                )
                .tag(idx)
            }
        }
        .tabViewStyle(.page)
        .onAppear(perform: autoSelectHole)
        .onChange(of: locationManager.location) { _ in
            guard !didAutoSelect else { return }
            autoSelectHole()
        }
    }

    // MARK: - Helpers

    private func autoSelectHole() {
        guard let loc = locationManager.location else { return }
        let userLat = loc.coordinate.latitude
        let userLng = loc.coordinate.longitude

        var nearestIdx = 0
        var nearestDist = Double.infinity

        for (idx, hole) in course.holes.enumerated() {
            let d = LocationManager.haversineYards(
                lat1: userLat, lon1: userLng,
                lat2: hole.greenLat, lon2: hole.greenLng)
            if d < nearestDist {
                nearestDist = d
                nearestIdx  = idx
            }
        }

        // Only snap to nearest if we are actually on the course
        if nearestDist < 700 {
            currentIndex   = nearestIdx
            didAutoSelect  = true
        }
    }
}
