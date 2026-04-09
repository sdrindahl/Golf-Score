# ⛳ Golf Score Tracker

A modern web app to track your golf scores, calculate your handicap, and find courses. Built with Next.js, TypeScript, and Tailwind CSS.

## Features

- 📊 **Score Tracking**: Record your scores for each round at any course
- 📈 **Handicap Calculation**: Automatically calculate your handicap based on your recent rounds
- 🔍 **Course Search**: Find and select from a database of golf courses
- 📱 **Responsive Design**: Works great on desktop, tablet, and mobile devices
- 💾 **Local Storage**: Saves all your data locally in your browser
- 📋 **Score History**: View your past rounds and statistics

## Getting Started

### Prerequisites
- Node.js 16+ 
- npm or yarn

### Installation

1. Clone or navigate to the repository:
```bash
cd Golf-Score
```

2. Install dependencies:
```bash
npm install
```

3. Run the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) with your browser to see the app

## How to Use

### Recording a Round
1. Click **"Record New Round"** on the dashboard
2. Use the **"Find Course"** button to search for and select your course from the Golf Course API
3. Enter your score for each hole
4. Click **"Save Round"** to log your score

### Finding a Course
1. Click **"Find Course"** from the home page
2. Search by course name, city, or state
3. Results from the Golf Course API appear instantly
4. Click on a course to view details
5. Click **"Record Score at this Course"** to start entering your scores

### Viewing Statistics
- Your current handicap is displayed prominently on the dashboard
- View recent rounds, best/worst scores, and average score
- See your score vs. par for each round

## Handicap Calculation

The app uses a simple handicap calculation based on your scoring performance:
- Calculated from your last 8 rounds
- Formula: Average of recent rounds minus your best score
- More rounds provide a more accurate handicap

## Available Courses

The app provides access to thousands of courses through the **Golf Course API**. Search for any course by:
- Course name (e.g., "Pebble Beach", "Augusta National", "St. Andrews")
- City (e.g., "Scottsdale", "Los Angeles", "Chicago")
- State (e.g., "CA", "FL", "NY")

No pre-loaded course list - search for the specific course you want to play!

## Technologies Used

- **Next.js 16** - React framework
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **LocalStorage API** - Data persistence
- **Golf Course API** - Access to thousands of golf courses

## Golf Course Data

The app uses the **Golf Course API** to provide access to thousands of golf courses worldwide:

- **Real-time course search** - Search by name, city, or state
- **Comprehensive database** - Access to courses across the US and internationally
- **Fast results** - Instant responses as you type
- **Accurate information** - Par, hole count, location, and more

When you search for a course:
1. Enter a course name, city, or state
2. The app queries the Golf Course API
3. Results appear instantly with complete course information
4. Select your course and start recording your scores

## Project Structure

```
Golf-Score/
├── app/
│   ├── layout.tsx          # Root layout
│   ├── page.tsx            # Home/dashboard page
│   ├── globals.css         # Global styles
│   ├── course-search/      # Course search page
│   └── new-round/          # New round entry page
├── components/
│   ├── ScoreHistory.tsx    # Recent rounds display
│   ├── HandicapDisplay.tsx # Handicap card
│   ├── CourseSearch.tsx    # Course search component
│   └── NewRound.tsx        # Score entry form
├── data/
│   └── courses.ts          # Local course database
├── lib/
│   └── golfApi.ts          # Golf Course API integration
├── types/
│   └── index.ts            # TypeScript type definitions
└── public/                 # Static assets
```

## Building for Production

```bash
npm run build
npm start
```

## Future Enhancements

- Integration with real golf course databases
- Player statistics and trends visualization
- Export scores to CSV
- Multiple player support
- Course ratings and difficulty tracking
- Leaderboard/competition features
- Mobile app versions (React Native)

## License

MIT

## Support

For questions or suggestions, please open an issue in the repository.