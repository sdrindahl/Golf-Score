import SwiftUI

/// Lets the golfer pick (or search) a course before the round.
struct CoursePickerView: View {

    @ObservedObject var courseManager: CourseDataManager
    @State private var searchText = ""

    private var filtered: [WatchCourse] {
        if searchText.isEmpty { return courseManager.courses }
        return courseManager.courses.filter {
            $0.name.localizedCaseInsensitiveContains(searchText)
        }
    }

    var body: some View {
        NavigationStack {
            Group {
                if let error = courseManager.errorMessage {
                    errorView(message: error)
                } else if courseManager.courses.isEmpty {
                    emptyView
                } else {
                    List(filtered) { course in
                        Button(action: { courseManager.selectCourse(course) }) {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(course.name)
                                    .font(.caption)
                                    .lineLimit(2)
                                Text("\(course.holes.count) holes")
                                    .font(.caption2)
                                    .foregroundStyle(.secondary)
                            }
                        }
                        .listRowBackground(Color.clear)
                    }
                    .searchable(text: $searchText, prompt: "Search")
                }
            }
            .navigationTitle("Select Course")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    if courseManager.isLoading {
                        ProgressView()
                            .scaleEffect(0.7)
                    } else {
                        Button(action: { courseManager.fetchCourses() }) {
                            Image(systemName: "arrow.clockwise")
                                .font(.caption)
                        }
                    }
                }
            }
        }
    }

    private var emptyView: some View {
        VStack(spacing: 8) {
            if courseManager.isLoading {
                ProgressView()
                Text("Loading…")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            } else {
                Image(systemName: "flag.slash")
                    .font(.title2)
                    .foregroundStyle(.secondary)
                Text("No courses found")
                    .font(.caption2)
                Button("Retry") { courseManager.fetchCourses() }
                    .font(.caption2)
            }
        }
    }

    private func errorView(message: String) -> some View {
        VStack(spacing: 8) {
            Image(systemName: "exclamationmark.triangle.fill")
                .foregroundStyle(.orange)
            Text(message)
                .font(.caption2)
                .multilineTextAlignment(.center)
            Button("Retry") { courseManager.fetchCourses() }
                .font(.caption2)
        }
        .padding()
    }
}
