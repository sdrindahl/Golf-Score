'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Course } from '@/types'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'

export default function AddCourse() {
  const router = useRouter()
  const [courseName, setCourseName] = useState('')
  const [location, setLocation] = useState('')
  const [state, setState] = useState('')
  const [holeCount, setHoleCount] = useState(18)
  const [courseRating, setCourseRating] = useState(72.0)
  const [slopeRating, setSlopeRating] = useState(113)
  const [holes, setHoles] = useState<any[]>([])

  // Initialize holes array on component mount
  useEffect(() => {
    const newHoles = Array.from({ length: holeCount }, (_, i) => ({
      holeNumber: i + 1,
      par: 4,
      handicap: i + 1,
    }))
    setHoles(newHoles)
  }, [])

  // Initialize holes array when holeCount changes
  const handleHoleCountChange = (count: number) => {
    setHoleCount(count)
    // Set appropriate default course rating based on hole count
    const defaultRating = count === 9 ? 36.0 : 72.0
    setCourseRating(defaultRating)
    
    const newHoles = Array.from({ length: count }, (_, i) => ({
      holeNumber: i + 1,
      par: 4,
      handicap: i + 1,
    }))
    setHoles(newHoles)
  }

  const handleHoleChange = (holeNumber: number, field: 'par' | 'handicap', value: number) => {
    const newHoles = [...holes]
    const holeIndex = newHoles.findIndex(h => h.holeNumber === holeNumber)
    if (holeIndex >= 0) {
      newHoles[holeIndex][field] = value
      setHoles(newHoles)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!courseName.trim() || !location.trim() || !state.trim()) {
      alert('Please fill in all course details')
      return
    }

    if (holes.some(h => h.par === 0)) {
      alert('Please set par for all holes')
      return
    }

    const newCourse: Course = {
      id: Date.now().toString(),
      name: courseName,
      location,
      state,
      holeCount,
      par: holes.reduce((sum, h) => sum + h.par, 0),
      holes,
    }

    // Save to localStorage
    const savedCourses = localStorage.getItem('golfCourses')
    const courses = savedCourses ? JSON.parse(savedCourses) : []
    courses.push(newCourse)
    localStorage.setItem('golfCourses', JSON.stringify(courses))
    console.log('💾 Course saved to localStorage. Total courses:', courses.length)

    // Save to Supabase if configured
    if (isSupabaseConfigured() && supabase) {
      try {
        console.log('📤 Saving course to Supabase:', newCourse.name)
        const { data, error } = await supabase
          .from('courses')
          .insert([
            {
              id: newCourse.id,
              name: newCourse.name,
              hole_count: newCourse.holeCount,
              par: newCourse.par,
              holes: newCourse.holes,
            },
          ])
          .select()

        if (error) {
          console.error('❌ Error saving course to Supabase:', error.message)
        } else {
          console.log('✅ Course saved to Supabase successfully:', data)
        }
      } catch (error) {
        console.error('❌ Exception saving course to Supabase:', error)
      }
    } else {
      console.log('⚠️ Supabase not configured - course only saved locally')
    }

    // Redirect after a delay to allow data to sync
    setTimeout(() => {
      console.log('🔄 Redirecting to manage-courses...')
      router.push('/manage-courses')
    }, 1000)
  }

  return (
    <div className="max-w-4xl mx-auto py-6">
      <form onSubmit={handleSubmit}>
        {/* Course Details */}
        <div className="card mb-6">
          <h2 className="text-2xl font-bold mb-6">Add New Golf Course</h2>
          
          <div className="space-y-4">
            <div>
              <label className="label">Course Name</label>
              <input
                type="text"
                value={courseName}
                onChange={(e) => setCourseName(e.target.value)}
                placeholder="e.g., Pebble Beach Golf Links"
                className="input-field"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Location/City</label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g., Pebble Beach"
                  className="input-field"
                />
              </div>
              <div>
                <label className="label">State/Region</label>
                <input
                  type="text"
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  placeholder="e.g., CA"
                  className="input-field"
                />
              </div>
            </div>

            <div>
              <label className="label">Number of Holes</label>
              <select
                value={holeCount}
                onChange={(e) => handleHoleCountChange(parseInt(e.target.value))}
                className="input-field"
              >
                <option value={9}>9 Holes</option>
                <option value={18}>18 Holes</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Course Rating</label>
                <input
                  type="number"
                  value={courseRating}
                  onChange={(e) => setCourseRating(parseFloat(e.target.value))}
                  placeholder="e.g., 72.4"
                  step="0.1"
                  className="input-field"
                />
              </div>
              <div>
                <label className="label">Slope Rating</label>
                <input
                  type="number"
                  value={slopeRating}
                  onChange={(e) => setSlopeRating(parseInt(e.target.value))}
                  placeholder="e.g., 135"
                  className="input-field"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Hole Details */}
        {holes.length > 0 && (
          <div className="card mb-6">
            <h3 className="text-xl font-bold mb-6">Set Par and Handicap for Each Hole</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {holes.map((hole) => (
                <div key={hole.holeNumber} className="bg-green-900 bg-opacity-40 border-2 border-green-600 p-4 rounded-lg">
                  <h4 className="font-bold mb-4 text-lg text-white">Hole {hole.holeNumber}</h4>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-bold block mb-2 text-white">Par</label>
                      <select
                        value={hole.par}
                        onChange={(e) => handleHoleChange(hole.holeNumber, 'par', parseInt(e.target.value))}
                        className="input-field mt-1 font-semibold"
                      >
                        <option value={3}>Par 3</option>
                        <option value={4}>Par 4</option>
                        <option value={5}>Par 5</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-sm font-bold block mb-2 text-white">Handicap Index</label>
                      <input
                        type="number"
                        value={hole.handicap}
                        onChange={(e) => handleHoleChange(hole.holeNumber, 'handicap', parseInt(e.target.value))}
                        min="1"
                        max={holeCount}
                        className="input-field mt-1 font-semibold"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Summary */}
            <div className="mt-6 pt-6 border-t">
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <p className="text-gray-600 text-sm">Total Par</p>
                  <p className="text-2xl font-bold">{holes.reduce((sum, h) => sum + h.par, 0)}</p>
                </div>
                <div className="text-center">
                  <p className="text-gray-600 text-sm">Holes</p>
                  <p className="text-2xl font-bold">{holes.length}</p>
                </div>
                <div className="text-center">
                  <p className="text-gray-600 text-sm">Average Par</p>
                  <p className="text-2xl font-bold">{holes.length > 0 ? (holes.reduce((sum, h) => sum + h.par, 0) / holes.length).toFixed(1) : '—'}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-4">
          <button type="submit" className="btn-primary flex-1">
            💾 Save Course
          </button>
          <Link href="/" className="flex-1">
            <button type="button" className="btn-primary w-full">
              Cancel
            </button>
          </Link>
        </div>
      </form>
    </div>
  )
}
