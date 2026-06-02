# Golf Distance – Apple Watch App

A standalone watchOS app that shows **live yardage to the pin** from wherever you're standing on the course.

## How It Works

1. The watch fetches course + green GPS data from your Golf Score app's API (`/api/watch-yardage`).
2. CoreLocation tracks your position continuously (updates every ~2 metres).
3. The Haversine formula converts GPS coordinates to yards.
4. Swipe left/right between holes. The app **auto-advances** to the nearest hole when you get a GPS fix on the course.

---

## Setup in Xcode

### Prerequisites
- Xcode 15 or later
- An Apple Watch paired to your iPhone (or watchOS Simulator)
- Your Golf Score app deployed to Vercel (or another host)

### Steps

1. **Open Xcode → New Project**
   - Choose *watchOS → App*
   - Product Name: `GolfDistance`
   - Interface: *SwiftUI*  
   - Life Cycle: *SwiftUI App*
   - Minimum Deployment: **watchOS 9.0**

2. **Add the source files**  
   Drag all `.swift` files from `watchos/Sources/GolfDistance/` into the Xcode project navigator.  
   Delete the auto-generated `ContentView.swift` and `GolfDistanceApp.swift` that Xcode created — ours replace them.

3. **Set your API URL**  
   Open `CourseDataManager.swift` and update this line:
   ```swift
   private let apiBaseURL = "https://YOUR_APP.vercel.app"
   ```
   Replace with your actual deployment URL, e.g. `https://my-caddie.vercel.app`.

4. **Add location permission**  
   In the Xcode project navigator, select your app target → *Info* tab → add:
   | Key | Value |
   |-----|-------|
   | `NSLocationWhenInUseUsageDescription` | `Golf Distance needs your location to calculate yardage to the pin.` |

5. **Build & run** on a paired Apple Watch or the watchOS Simulator.

---

## Usage on the Course

| Action | Result |
|--------|--------|
| Open app | Auto-fetches courses; selects nearest course if within ~500 yds of a green |
| Swipe left / right | Move to prev / next hole |
| Tap the map icon | Return to course picker |
| Tap refresh ↻ | Re-fetch latest course data |

### Distance colours
| Colour | Range |
|--------|-------|
| 🟢 Green | < 100 yds |
| 🟡 Yellow | 100–149 yds |
| 🟠 Orange | 150–199 yds |
| ⚪ White | 200+ yds |

---

## API Endpoint

`GET /api/watch-yardage` returns lightweight JSON:

```json
{
  "courses": [
    {
      "id": "20a",
      "name": "Inver Wood 20a",
      "holes": [
        { "holeNumber": 1, "par": 5, "greenLat": 44.841, "greenLng": -93.073, "yardage": 526 }
      ]
    }
  ]
}
```

Optional: `?courseId=20a` to fetch a single course (faster watch refresh).

---

## File Overview

| File | Purpose |
|------|---------|
| `GolfDistanceApp.swift` | `@main` entry point |
| `ContentView.swift` | Root view — shows picker or distance view |
| `HoleSwipeView.swift` | TabView that swipes between holes |
| `HoleDistanceView.swift` | Per-hole card with live yardage |
| `CoursePickerView.swift` | Course list / search screen |
| `LocationManager.swift` | CLLocationManager wrapper |
| `CourseDataManager.swift` | API fetch, caching, auto-detect course |
| `Models.swift` | Codable data models |
