import Foundation
import Combine

// ─────────────────────────────────────────────────────────────────
// ⚙️  CONFIGURATION
//  Replace this URL with your deployed Vercel app URL before building.
// ─────────────────────────────────────────────────────────────────
private let apiBaseURL = "https://golf-score-sigma.vercel.app"

// ─────────────────────────────────────────────────────────────────

final class CourseDataManager: ObservableObject {

    @Published var courses: [WatchCourse] = []
    @Published var selectedCourse: WatchCourse?
    @Published var isLoading = false
    @Published var errorMessage: String?

    private let cacheKey          = "gd_watchCourseData_v1"
    private let courseSelectionKey = "gd_selectedCourseId"

    init() {
        loadCachedCourses()
    }

    // MARK: - Fetch

    func fetchCourses() {
        isLoading     = true
        errorMessage  = nil

        guard let url = URL(string: "\(apiBaseURL)/api/watch-yardage") else {
            errorMessage = "Invalid API URL. Set apiBaseURL in CourseDataManager.swift."
            isLoading    = false
            return
        }

        var request = URLRequest(url: url, cachePolicy: .returnCacheDataElseLoad,
                                 timeoutInterval: 15)
        request.setValue("application/json", forHTTPHeaderField: "Accept")

        URLSession.shared.dataTask(with: request) { [weak self] data, _, error in
            DispatchQueue.main.async {
                guard let self else { return }
                self.isLoading = false

                if let error {
                    self.errorMessage = error.localizedDescription
                    return
                }
                guard let data else {
                    self.errorMessage = "No data received from server."
                    return
                }
                do {
                    let response = try JSONDecoder().decode(WatchAPIResponse.self, from: data)
                    self.courses = response.courses
                    self.cacheRawData(data)
                    self.restoreCourseSelection()
                } catch {
                    self.errorMessage = "Decode error: \(error.localizedDescription)"
                }
            }
        }.resume()
    }

    // MARK: - Selection

    func selectCourse(_ course: WatchCourse) {
        selectedCourse = course
        UserDefaults.standard.set(course.id, forKey: courseSelectionKey)
    }

    func clearCourseSelection() {
        selectedCourse = nil
        UserDefaults.standard.removeObject(forKey: courseSelectionKey)
    }

    // MARK: - Auto-detect nearest course

    /// Compares the user's GPS position against all known greens.
    /// Selects the course that has at least one green within `thresholdYards`.
    func autoSelectNearestCourse(userLat: Double, userLng: Double,
                                 thresholdYards: Double = 500) {
        guard !courses.isEmpty else { return }

        var best: (course: WatchCourse, distance: Double)?

        for course in courses {
            for hole in course.holes {
                let d = LocationManager.haversineYards(
                    lat1: userLat, lon1: userLng,
                    lat2: hole.greenLat, lon2: hole.greenLng)
                if d < thresholdYards {
                    if best == nil || d < best!.distance {
                        best = (course, d)
                    }
                    break   // nearest green found for this course
                }
            }
        }

        if let nearest = best {
            selectCourse(nearest.course)
        }
    }

    // MARK: - Persistence

    private func loadCachedCourses() {
        guard let data = UserDefaults.standard.data(forKey: cacheKey) else { return }
        if let response = try? JSONDecoder().decode(WatchAPIResponse.self, from: data) {
            courses = response.courses
            restoreCourseSelection()
        }
    }

    private func cacheRawData(_ data: Data) {
        UserDefaults.standard.set(data, forKey: cacheKey)
    }

    private func restoreCourseSelection() {
        guard let savedId = UserDefaults.standard.string(forKey: courseSelectionKey) else { return }
        selectedCourse = courses.first { $0.id == savedId }
    }
}
