import SwiftUI

/// Root view: shows a course picker until a course is selected,
/// then shows the per-hole distance swiper.
struct ContentView: View {

    @StateObject private var locationManager  = LocationManager()
    @StateObject private var courseManager    = CourseDataManager()

    var body: some View {
        Group {
            if courseManager.isLoading && courseManager.courses.isEmpty {
                loadingView
            } else if let course = courseManager.selectedCourse {
                HoleSwipeView(
                    course:          course,
                    locationManager: locationManager,
                    onChangeCourse:  { courseManager.clearCourseSelection() }
                )
            } else {
                CoursePickerView(courseManager: courseManager)
            }
        }
        .onAppear {
            courseManager.fetchCourses()
            courseManager.fetchActiveRound()
        }
        // Once GPS and courses are ready, try to auto-select the nearest course
        .onChange(of: locationManager.location) { loc in
            guard courseManager.selectedCourse == nil,
                  let loc else { return }
            courseManager.autoSelectNearestCourse(
                userLat: loc.coordinate.latitude,
                userLng: loc.coordinate.longitude
            )
        }
    }

    private var loadingView: some View {
        VStack(spacing: 8) {
            ProgressView()
            Text("Loading courses…")
                .font(.caption2)
                .foregroundStyle(.secondary)
        }
    }
}
