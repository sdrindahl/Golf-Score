import SwiftUI

/// Lets the golfer pick (or search) a course before the round.
struct CoursePickerView: View {

    @ObservedObject var courseManager: CourseDataManager
    @State private var searchText = ""
    @State private var showUserIdEntry = false
    @State private var userIdDraft = ""

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
                    List {
                        // Sync banner if active round detected
                        if let active = courseManager.activeRound {
                            Section {
                                HStack {
                                    Image(systemName: "antenna.radiowaves.left.and.right")
                                        .foregroundStyle(.green)
                                    VStack(alignment: .leading, spacing: 2) {
                                        Text("Round in Progress")
                                            .font(.caption2)
                                            .foregroundStyle(.green)
                                        Text(active.courseName)
                                            .font(.caption)
                                    }
                                }
                                .listRowBackground(Color.green.opacity(0.15))
                            }
                        }

                        // Phone sync row
                        Section {
                            Button(action: {
                                userIdDraft = courseManager.userId ?? ""
                                showUserIdEntry = true
                            }) {
                                HStack {
                                    Image(systemName: "iphone.and.arrow.left.and.arrow.right")
                                        .font(.caption)
                                        .foregroundStyle(.blue)
                                    Text(courseManager.userId != nil ? "Synced with Phone" : "Sync with Phone")
                                        .font(.caption2)
                                }
                            }
                            .listRowBackground(Color.clear)
                        }

                        // Course list
                        ForEach(filtered) { course in
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
                    }
                    .searchable(text: $searchText, prompt: "Search")
                }
            }
            .navigationTitle("Select Course")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    if courseManager.isLoading {
                        ProgressView().scaleEffect(0.7)
                    } else {
                        Button(action: {
                            courseManager.fetchCourses()
                            courseManager.fetchActiveRound()
                        }) {
                            Image(systemName: "arrow.clockwise").font(.caption)
                        }
                    }
                }
            }
            .sheet(isPresented: $showUserIdEntry) {
                UserIdEntryView(userId: $userIdDraft) {
                    courseManager.userId = userIdDraft.isEmpty ? nil : userIdDraft
                    showUserIdEntry = false
                    courseManager.fetchActiveRound()
                }
            }
        }
    }

    private var emptyView: some View {
        VStack(spacing: 8) {
            if courseManager.isLoading {
                ProgressView()
                Text("Loading…").font(.caption2).foregroundStyle(.secondary)
            } else {
                Image(systemName: "flag.slash").font(.title2).foregroundStyle(.secondary)
                Text("No courses found").font(.caption2)
                Button("Retry") { courseManager.fetchCourses() }.font(.caption2)
            }
        }
    }

    private func errorView(message: String) -> some View {
        VStack(spacing: 8) {
            Image(systemName: "exclamationmark.triangle.fill").foregroundStyle(.orange)
            Text(message).font(.caption2).multilineTextAlignment(.center)
            Button("Retry") { courseManager.fetchCourses() }.font(.caption2)
        }
        .padding()
    }
}

/// Small sheet to enter the user ID from the web app
struct UserIdEntryView: View {
    @Binding var userId: String
    let onSave: () -> Void

    var body: some View {
        VStack(spacing: 10) {
            Text("Phone Sync")
                .font(.headline)
            Text("Enter your User ID from the Golf Score app (Settings page)")
                .font(.caption2)
                .multilineTextAlignment(.center)
                .foregroundStyle(.secondary)
            TextField("User ID", text: $userId)
                .textFieldStyle(.plain)
                .font(.caption)
                .padding(6)
                .background(Color.gray.opacity(0.2))
                .clipShape(RoundedRectangle(cornerRadius: 6))
            Button("Save & Sync", action: onSave)
                .buttonStyle(.borderedProminent)
                .font(.caption)
        }
        .padding()
    }
}
