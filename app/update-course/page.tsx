'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

export default function UpdateCourseData() {
  const [status, setStatus] = useState('Click "Update Course" to populate Emerald Greens with scorecard data')
  const [success, setSuccess] = useState(false)
  const [coursesList, setCoursesList] = useState<string[]>([])
  const [courseCount, setCourseCount] = useState(0)

  const handleUpdateCourse = () => {
    // Emerald Greens Golf Club - Gold Course
    const emeraldGreensGold = {
      name: 'Emerald Greens Gold',
      location: 'Emerald Greens Golf Club',
      state: 'MN',
      holeCount: 18,
      par: 72,
      holes: [
        { holeNumber: 1, par: 5, handicap: 13, yardage: 520 },
        { holeNumber: 2, par: 4, handicap: 7, yardage: 385 },
        { holeNumber: 3, par: 4, handicap: 9, yardage: 410 },
        { holeNumber: 4, par: 3, handicap: 15, yardage: 165 },
        { holeNumber: 5, par: 5, handicap: 17, yardage: 545 },
        { holeNumber: 6, par: 4, handicap: 3, yardage: 430 },
        { holeNumber: 7, par: 3, handicap: 11, yardage: 185 },
        { holeNumber: 8, par: 4, handicap: 1, yardage: 455 },
        { holeNumber: 9, par: 4, handicap: 5, yardage: 420 },
        { holeNumber: 10, par: 4, handicap: 6, yardage: 395 },
        { holeNumber: 11, par: 5, handicap: 16, yardage: 550 },
        { holeNumber: 12, par: 3, handicap: 18, yardage: 155 },
        { holeNumber: 13, par: 5, handicap: 14, yardage: 530 },
        { holeNumber: 14, par: 3, handicap: 12, yardage: 175 },
        { holeNumber: 15, par: 3, handicap: 8, yardage: 160 },
        { holeNumber: 16, par: 5, handicap: 10, yardage: 560 },
        { holeNumber: 17, par: 4, handicap: 4, yardage: 440 },
        { holeNumber: 18, par: 4, handicap: 2, yardage: 465 },
      ]
    }

    // Emerald Greens Silver Course - separate course
    const emeraldGreensSilver = {
      name: 'Emerald Greens Silver',
      location: 'Emerald Greens Golf Club',
      state: 'MN',
      holeCount: 18,
      par: 72,
      holes: [
        { holeNumber: 1, par: 4, handicap: 9, yardage: 380 },
        { holeNumber: 2, par: 3, handicap: 17, yardage: 157 },
        { holeNumber: 3, par: 4, handicap: 3, yardage: 422 },
        { holeNumber: 4, par: 4, handicap: 7, yardage: 373 },
        { holeNumber: 5, par: 4, handicap: 15, yardage: 347 },
        { holeNumber: 6, par: 3, handicap: 13, yardage: 168 },
        { holeNumber: 7, par: 5, handicap: 5, yardage: 576 },
        { holeNumber: 8, par: 5, handicap: 11, yardage: 503 },
        { holeNumber: 9, par: 4, handicap: 1, yardage: 404 },
        { holeNumber: 10, par: 4, handicap: 10, yardage: 358 },
        { holeNumber: 11, par: 4, handicap: 2, yardage: 437 },
        { holeNumber: 12, par: 4, handicap: 6, yardage: 404 },
        { holeNumber: 13, par: 3, handicap: 16, yardage: 185 },
        { holeNumber: 14, par: 5, handicap: 8, yardage: 530 },
        { holeNumber: 15, par: 3, handicap: 18, yardage: 120 },
        { holeNumber: 16, par: 4, handicap: 12, yardage: 368 },
        { holeNumber: 17, par: 4, handicap: 4, yardage: 435 },
        { holeNumber: 18, par: 5, handicap: 14, yardage: 532 },
      ]
    }

    // Valleywood Golf Course - Purple tees
    const valleywoodGolf = {
      name: 'Valleywood Golf Course',
      location: 'Valleywood',
      state: 'MN',
      holeCount: 18,
      par: 72,
      holes: [
        { holeNumber: 1, par: 4, handicap: 4, yardage: 330 },
        { holeNumber: 2, par: 3, handicap: 14, yardage: 136 },
        { holeNumber: 3, par: 4, handicap: 8, yardage: 372 },
        { holeNumber: 4, par: 5, handicap: 18, yardage: 463 },
        { holeNumber: 5, par: 4, handicap: 16, yardage: 308 },
        { holeNumber: 6, par: 4, handicap: 10, yardage: 302 },
        { holeNumber: 7, par: 3, handicap: 12, yardage: 160 },
        { holeNumber: 8, par: 4, handicap: 6, yardage: 420 },
        { holeNumber: 9, par: 5, handicap: 2, yardage: 460 },
        { holeNumber: 10, par: 4, handicap: 7, yardage: 376 },
        { holeNumber: 11, par: 3, handicap: 17, yardage: 133 },
        { holeNumber: 12, par: 5, handicap: 15, yardage: 470 },
        { holeNumber: 13, par: 3, handicap: 13, yardage: 165 },
        { holeNumber: 14, par: 4, handicap: 11, yardage: 337 },
        { holeNumber: 15, par: 5, handicap: 9, yardage: 472 },
        { holeNumber: 16, par: 4, handicap: 1, yardage: 380 },
        { holeNumber: 17, par: 4, handicap: 3, yardage: 402 },
        { holeNumber: 18, par: 4, handicap: 5, yardage: 367 },
      ]
    }

    // Lost Spur Golf Course - White tees (9 holes)
    const lostSpurGolf = {
      name: 'Lost Spur Golf Course',
      location: 'Lost Spur',
      state: 'MN',
      holeCount: 9,
      par: 34,
      holes: [
        { holeNumber: 1, par: 4, handicap: 1, yardage: 346 },
        { holeNumber: 2, par: 4, handicap: 15, yardage: 253 },
        { holeNumber: 3, par: 3, handicap: 9, yardage: 157 },
        { holeNumber: 4, par: 4, handicap: 11, yardage: 290 },
        { holeNumber: 5, par: 4, handicap: 13, yardage: 302 },
        { holeNumber: 6, par: 3, handicap: 8, yardage: 212 },
        { holeNumber: 7, par: 5, handicap: 5, yardage: 425 },
        { holeNumber: 8, par: 3, handicap: 12, yardage: 145 },
        { holeNumber: 9, par: 4, handicap: 17, yardage: 230 },
      ]
    }

    // Birnamwood Golf Course - Blue tees (9 holes, all par 3s)
    const birnamwoodGolf = {
      name: 'Birnamwood Golf Course 12424 Parkwood Dr, Burnsville, MN',
      location: 'Burnsville',
      state: 'MN',
      holeCount: 9,
      par: 27,
      holes: [
        { holeNumber: 1, par: 3, handicap: 15, yardage: 122 },
        { holeNumber: 2, par: 3, handicap: 13, yardage: 123 },
        { holeNumber: 3, par: 3, handicap: 1, yardage: 171 },
        { holeNumber: 4, par: 3, handicap: 3, yardage: 139 },
        { holeNumber: 5, par: 3, handicap: 17, yardage: 109 },
        { holeNumber: 6, par: 3, handicap: 9, yardage: 139 },
        { holeNumber: 7, par: 3, handicap: 5, yardage: 165 },
        { holeNumber: 8, par: 3, handicap: 11, yardage: 142 },
        { holeNumber: 9, par: 3, handicap: 7, yardage: 157 },
      ]
    }

    try {
      // Get existing courses
      const savedCourses = localStorage.getItem('golfCourses')
      const courses = savedCourses ? JSON.parse(savedCourses) : []
      
      setCourseCount(courses.length)
      const courseNames = courses.map((c: any) => c.name)
      setCoursesList(courseNames)

      if (courses.length === 0) {
        setStatus('❌ No courses found in localStorage. Please add the Emerald Greens courses first.')
        setSuccess(false)
        return
      }

      // Update Emerald Greens GOLD course
      let goldIndex = courses.findIndex(
        (c: any) => c.name && c.name.toLowerCase().includes('gold')
      )
      
      // Update Emerald Greens SILVER course 
      let silverIndex = courses.findIndex(
        (c: any) => c.name && c.name.toLowerCase().includes('silver') && c.name.toLowerCase().includes('emerald')
      )

      // Update Valleywood course
      let valleywoodIndex = courses.findIndex(
        (c: any) => c.name && c.name.toLowerCase().includes('valleywood')
      )

      // Update Lost Spur course
      let lostSpurIndex = courses.findIndex(
        (c: any) => c.name && c.name.toLowerCase().includes('lost spur')
      )

      // Update Birnamwood course
      let birnamwoodIndex = courses.findIndex(
        (c: any) => c.name && c.name.toLowerCase().includes('birnamwood')
      )

      let updatedCount = 0
      const results = []

      // Update Gold
      if (goldIndex >= 0) {
        const goldName = courses[goldIndex].name
        courses[goldIndex].holes = emeraldGreensGold.holes
        courses[goldIndex].par = emeraldGreensGold.par
        results.push(`✓ ${goldName} (6536 yards, Par 72)`)
        updatedCount++
      } else {
        results.push('❌ Emerald Greens Gold course not found')
      }

      // Update Silver
      if (silverIndex >= 0) {
        const silverName = courses[silverIndex].name
        courses[silverIndex].holes = emeraldGreensSilver.holes
        courses[silverIndex].par = emeraldGreensSilver.par
        results.push(`✓ ${silverName} (6699 yards, Par 72)`)
        updatedCount++
      } else {
        results.push('❌ Emerald Greens Silver course not found')
      }

      // Update Valleywood
      if (valleywoodIndex >= 0) {
        const valleywoodName = courses[valleywoodIndex].name
        courses[valleywoodIndex].holes = valleywoodGolf.holes
        courses[valleywoodIndex].par = valleywoodGolf.par
        results.push(`✓ ${valleywoodName} (6053 yards, Par 72)`)
        updatedCount++
      } else {
        results.push('❌ Valleywood course not found')
      }

      // Update Lost Spur
      if (lostSpurIndex >= 0) {
        const lostSpurName = courses[lostSpurIndex].name
        courses[lostSpurIndex].holes = lostSpurGolf.holes
        courses[lostSpurIndex].par = lostSpurGolf.par
        results.push(`✓ ${lostSpurName} (2360 yards, Par 34, 9 holes)`)
        updatedCount++
      } else {
        results.push('❌ Lost Spur course not found')
      }

      // Update Birnamwood
      if (birnamwoodIndex >= 0) {
        const birnamwoodName = courses[birnamwoodIndex].name
        courses[birnamwoodIndex].holes = birnamwoodGolf.holes
        courses[birnamwoodIndex].par = birnamwoodGolf.par
        results.push(`✓ ${birnamwoodName} (1267 yards, Par 27, 9 holes)`)
        updatedCount++
      } else {
        results.push('❌ Birnamwood course not found')
      }

      if (updatedCount > 0) {
        localStorage.setItem('golfCourses', JSON.stringify(courses))
        setStatus(`✅ Updated ${updatedCount} course(s) successfully!`)
        setSuccess(true)
      } else {
        setStatus(`❌ Could not find any courses to update. Found: ${courseNames.join(', ')}`)
        setSuccess(false)
      }
    } catch (error) {
      setStatus('❌ Error updating courses: ' + (error as Error).message)
      setSuccess(false)
    }
  }

  useEffect(() => {
    // Just load the course list on page load
    try {
      const savedCourses = localStorage.getItem('golfCourses')
      const courses = savedCourses ? JSON.parse(savedCourses) : []
      
      setCourseCount(courses.length)
      const courseNames = courses.map((c: any) => c.name)
      setCoursesList(courseNames)
    } catch (error) {
      console.error('Error loading courses:', error)
    }
  }, [])

  return (
    <div className="max-w-2xl mx-auto py-6">
      <div className="card text-center">
        <h2 className="text-2xl font-bold mb-4">Update Course Data</h2>
        <p className="text-lg mb-6">{status}</p>

        {courseCount > 0 && (
          <div className="bg-blue-100 text-blue-800 p-4 rounded mb-6 text-left">
            <p className="font-semibold mb-2">Courses in your system ({courseCount}):</p>
            <ul className="text-sm space-y-1">
              {coursesList.map((name, idx) => (
                <li key={idx}>• {name}</li>
              ))}
            </ul>
          </div>
        )}

        {success && (
          <div className="bg-green-100 text-green-700 p-4 rounded mb-6">
            <p className="font-semibold mb-2">✅ Courses Updated Successfully!</p>
            <ul className="text-sm text-left space-y-1">
              <li>✓ <strong>Emerald Greens Gold:</strong> 18 holes, Par 72, 6536 yards</li>
              <li>✓ <strong>Emerald Greens Silver:</strong> 18 holes, Par 72, 6699 yards</li>
              <li>✓ <strong>Valleywood Golf Course:</strong> 18 holes, Par 72, 6053 yards</li>
              <li>✓ <strong>Lost Spur Golf Course:</strong> 9 holes, Par 34, 2360 yards</li>
              <li>✓ <strong>Birnamwood Golf Course:</strong> 9 holes, Par 27, 1267 yards</li>
              <li>✓ All handicap indices and yardages set</li>
            </ul>
          </div>
        )}

        <button 
          onClick={handleUpdateCourse}
          className="btn-primary mb-4 text-lg py-2 px-6"
        >
          🔄 Update Course Now
        </button>

        <div className="flex gap-4 justify-center">
          <Link href="/manage-courses">
            <button className="btn-primary">View My Courses</button>
          </Link>
          <Link href="/">
            <button className="btn-secondary">Back to Dashboard</button>
          </Link>
        </div>
      </div>
    </div>
  )
}
