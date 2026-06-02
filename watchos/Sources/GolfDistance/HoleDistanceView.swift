import SwiftUI

/// Single hole card: shows the live GPS distance to the centre of the green.
struct HoleDistanceView: View {

    let hole:            WatchHole
    let courseName:      String
    @ObservedObject var locationManager: LocationManager
    let onChangeCourse:  () -> Void

    // Live distance (yards) from watch to green
    private var distanceYards: Double? {
        locationManager.yardsToGreen(greenLat: hole.greenLat, greenLng: hole.greenLng)
    }

    var body: some View {
        VStack(spacing: 3) {
            // Course name (compact)
            Text(courseName)
                .font(.system(size: 10))
                .foregroundStyle(.secondary)
                .lineLimit(1)
                .minimumScaleFactor(0.7)

            // Hole + par row
            HStack {
                Text(hole.label)
                    .font(.headline)
                    .fontWeight(.semibold)
                Spacer()
                Text(hole.parLabel)
                    .font(.subheadline)
                    .foregroundStyle(.green)
            }

            Divider()

            // ── DISTANCE ──────────────────────────────────
            if let yards = distanceYards {
                VStack(spacing: 1) {
                    Text("\(Int(yards.rounded()))")
                        .font(.system(size: 46, weight: .bold, design: .rounded))
                        .foregroundStyle(color(for: yards))
                        .monospacedDigit()
                        .contentTransition(.numericText())
                        .animation(.easeOut(duration: 0.25), value: Int(yards.rounded()))

                    Text("yds to pin")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
            } else {
                VStack(spacing: 4) {
                    Image(systemName: "location.slash.fill")
                        .font(.title2)
                        .foregroundStyle(.orange)
                    Text("Acquiring GPS…")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
                .padding(.vertical, 4)
            }

            Divider()

            // Scorecard yardage hint + change course
            HStack {
                Text("Card: \(hole.yardage) yds")
                    .font(.system(size: 10))
                    .foregroundStyle(.tertiary)
                Spacer()
                Button(action: onChangeCourse) {
                    Image(systemName: "map")
                        .font(.caption)
                }
                .buttonStyle(.plain)
                .foregroundStyle(.blue)
            }
        }
        .padding(.horizontal, 6)
    }

    // Colour-codes the distance: green close, yellow mid, orange/white far
    private func color(for yards: Double) -> Color {
        switch yards {
        case ..<100:  return .green
        case ..<150:  return Color(red: 0.9, green: 0.85, blue: 0.1)  // yellow
        case ..<200:  return .orange
        default:      return .white
        }
    }
}
