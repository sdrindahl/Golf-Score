import CoreLocation
import Combine

/// Wraps CLLocationManager for SwiftUI observation on watchOS.
/// Requests "when in use" authorization and streams GPS updates every 2 m.
final class LocationManager: NSObject, ObservableObject {

    private let manager = CLLocationManager()

    @Published var location: CLLocation?
    @Published var authorizationStatus: CLAuthorizationStatus = .notDetermined

    override init() {
        super.init()
        manager.delegate = self
        manager.desiredAccuracy = kCLLocationAccuracyBest
        manager.distanceFilter = 2.0     // update every ~2 metres
        manager.requestWhenInUseAuthorization()
    }

    // MARK: - Distance helpers

    /// Returns the straight-line distance in yards from the current GPS fix
    /// to the centre of the green.  Returns nil when no GPS fix exists.
    func yardsToGreen(greenLat: Double, greenLng: Double) -> Double? {
        guard let location else { return nil }
        let green = CLLocation(latitude: greenLat, longitude: greenLng)
        return location.distance(from: green) * 1.09361  // m → yards
    }

    // MARK: - Haversine (no CLLocation dependency)

    /// Great-circle distance in yards between two coordinates.
    /// Used without requiring a live GPS fix (e.g. course auto-detection).
    static func haversineYards(
        lat1: Double, lon1: Double,
        lat2: Double, lon2: Double
    ) -> Double {
        let R = 6_371_000.0
        let dLat = (lat2 - lat1) * .pi / 180
        let dLon = (lon2 - lon1) * .pi / 180
        let a = sin(dLat / 2) * sin(dLat / 2)
            + cos(lat1 * .pi / 180) * cos(lat2 * .pi / 180)
            * sin(dLon / 2) * sin(dLon / 2)
        let c = 2 * atan2(sqrt(a), sqrt(1 - a))
        return R * c * 1.09361
    }
}

// MARK: - CLLocationManagerDelegate

extension LocationManager: CLLocationManagerDelegate {

    func locationManager(_ manager: CLLocationManager,
                         didUpdateLocations locations: [CLLocation]) {
        location = locations.last
    }

    func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        authorizationStatus = manager.authorizationStatus
        if authorizationStatus == .authorizedWhenInUse
            || authorizationStatus == .authorizedAlways {
            manager.startUpdatingLocation()
        }
    }

    func locationManager(_ manager: CLLocationManager,
                         didFailWithError error: Error) {
        // Silently ignore transient GPS errors; `location` retains last good fix
    }
}
