'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import PageWrapper from '@/components/PageWrapper'
import { Course } from '@/types'
import { COURSES_DATABASE } from '@/data/courses'

export default function CoursesPage() {
  const router = useRouter()
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null)
  const [selectedTee, setSelectedTee] = useState<'men' | 'women' | 'senior' | 'championship'>('men')
  const [displayedCourses, setDisplayedCourses] = useState<Course[]>([])
  const [allCourses, setAllCourses] = useState<Course[]>([])
  const [favorites, setFavorites] = useState<string[]>([])
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false)

  useEffect(() => {
    // Load courses from localStorage
    const savedCourses = localStorage.getItem('golfCourses')
    if (savedCourses) {
      setAllCourses(JSON.parse(savedCourses))
    } else {
      // Use default courses if nothing in localStorage
      setAllCourses(COURSES_DATABASE)
      localStorage.setItem('golfCourses', JSON.stringify(COURSES_DATABASE))
    }

    // Load favorites from localStorage
    const savedFavorites = localStorage.getItem('favoriteCourses')
    if (savedFavorites) {
      setFavorites(JSON.parse(savedFavorites))
    }
  }, [])

  useEffect(() => {
    // Show all courses if no search term, otherwise filter
    let coversToShow = allCourses
    
    if (!searchTerm.trim()) {
      coversToShow = allCourses
    } else {
      coversToShow = allCourses.filter(course =>
        course.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        course.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
        course.state.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    // Apply favorites filter
    if (showFavoritesOnly) {
      coversToShow = coversToShow.filter(course => favorites.includes(course.id))
    }

    setDisplayedCourses(coversToShow)
  }, [searchTerm, allCourses, showFavoritesOnly, favorites])

  const getTotalYardage = (course: Course, tee: 'men' | 'women' | 'senior' | 'championship') => {
    return course.holes.reduce((total, hole) => {
      return total + hole[tee].yardage
    }, 0)
  }

  const getTeeLabel = (tee: string) => {
    const labels: Record<string, string> = {
      men: 'Men',
      women: 'Women',
      senior: 'Senior',
      championship: 'Championship'
    }
    return labels[tee] || tee
  }

  const toggleFavorite = (courseId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const newFavorites = favorites.includes(courseId)
      ? favorites.filter(id => id !== courseId)
      : [...favorites, courseId]
    setFavorites(newFavorites)
    localStorage.setItem('favoriteCourses', JSON.stringify(newFavorites))
  }

  const isFavorite = (courseId: string) => favorites.includes(courseId)

  return (
    <PageWrapper title="Courses" userName="">
      <div className="space-y-4">
        {/* Search Bar */}
        <div className="mb-6">
          <input
            type="text"
            placeholder="Search courses..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>

        {/* Favorites Filter */}
        <div className="flex gap-3 mb-4 items-center">
          <button
            onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
            className={`px-3 py-1.5 rounded-md font-medium text-xs transition-colors border-2 ${
              showFavoritesOnly
                ? 'bg-green-600 text-white border-green-700'
                : 'bg-gray-200 text-gray-700 border-gray-400 hover:bg-gray-300'
            }`}
          >
            {showFavoritesOnly ? 'All Courses' : '⛳ Favorites'}
          </button>
          <p className="text-gray-600 text-xs">Tap the flag icon to favorite</p>
        </div>

        {/* Courses List */}
        {displayedCourses.map((course) => (
          <div key={course.id}>
            {/* Course Card */}
            <div
              onClick={() => selectedCourse?.id === course.id ? setSelectedCourse(null) : setSelectedCourse(course)}
              className="card cursor-pointer hover:shadow-lg transition-all flex items-center justify-between"
            >
              <div className="flex items-center gap-4 flex-1">
                {/* Course Icon - Clickable Favorite */}
                <button
                  onClick={(e) => toggleFavorite(course.id, e)}
                  className={`w-16 h-16 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${
                    isFavorite(course.id)
                      ? 'bg-green-500 border-2 border-green-600'
                      : 'bg-white border-2 border-gray-300 hover:border-green-500'
                  }`}
                  title={isFavorite(course.id) ? 'Remove from favorites' : 'Add to favorites'}
                >
                  <span className={`text-2xl transition-colors ${isFavorite(course.id) ? 'text-white' : 'text-gray-600'}`}>
                    ⛳
                  </span>
                </button>

                {/* Course Info */}
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-gray-900 line-clamp-1">{course.name}</h3>
                  <p className="text-gray-600 text-xs">{course.location}, {course.state}</p>
                  <p className="text-gray-600 text-xs mt-1">
                    {course.holeCount} holes • Par {course.par} • {getTotalYardage(course, 'men').toLocaleString()} yds
                  </p>
                </div>
              </div>

              {/* Arrow Icon */}
              <div className="flex-shrink-0">
                <span className={`text-2xl transition-transform ${selectedCourse?.id === course.id ? 'transform rotate-180' : ''}`}>
                  ▼
                </span>
              </div>
            </div>

            {/* Expanded Course Details */}
            {selectedCourse?.id === course.id && (
              <div className="card rounded-t-none border-t-0 space-y-4">
                {/* Full Course Name */}
                <div className="mb-4 pb-4 border-b border-gray-200">
                  <h2 className="text-2xl font-bold text-gray-900">{course.name}</h2>
                  <p className="text-gray-600 text-sm mt-1">{course.location}, {course.state}</p>
                </div>

                {/* Tee Selection */}
                <div className="flex gap-2 mb-4 flex-wrap">
                  {(['men', 'women', 'senior', 'championship'] as const).map((tee) => (
                    <button
                      key={tee}
                      onClick={() => setSelectedTee(tee)}
                      className={`px-3 py-2 rounded-lg font-medium text-sm transition-colors ${
                        selectedTee === tee
                          ? 'bg-green-600 text-white'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                    >
                      {getTeeLabel(tee)}
                    </button>
                  ))}
                </div>

                {/* Scorecard */}
                <div className="overflow-x-auto text-sm">
                  <table className="w-full">
                    <tbody>
                      {/* FRONT 9 */}
                      <tr className="border-b border-gray-200">
                        <td colSpan={10} className="font-bold text-gray-900 py-2 text-xs uppercase">
                          FRONT 9
                        </td>
                      </tr>
                      <tr className="border-b border-gray-200">
                        <td className="font-semibold text-gray-600 py-2 px-2 text-xs">Hole</td>
                        {course.holes.slice(0, 9).map((hole) => (
                          <td key={hole.holeNumber} className="text-center font-semibold px-1 py-2 text-xs">
                            {hole.holeNumber}
                          </td>
                        ))}
                      </tr>
                      <tr className="border-b border-gray-200">
                        <td className="font-semibold text-gray-600 py-2 px-2 text-xs">Par</td>
                        {course.holes.slice(0, 9).map((hole) => (
                          <td key={`par-${hole.holeNumber}`} className="text-center px-1 py-2 text-xs">
                            {hole.par}
                          </td>
                        ))}
                      </tr>
                      <tr className="border-b border-gray-200">
                        <td className="font-semibold text-gray-600 py-2 px-2 text-xs">Yds</td>
                        {course.holes.slice(0, 9).map((hole) => (
                          <td key={`yds-${hole.holeNumber}`} className="text-center px-1 py-2 text-xs">
                            {hole[selectedTee].yardage}
                          </td>
                        ))}
                      </tr>
                      <tr className="border-b border-gray-200">
                        <td className="font-semibold text-gray-600 py-2 px-2 text-xs">Hcp</td>
                        {course.holes.slice(0, 9).map((hole) => (
                          <td key={`hcp-${hole.holeNumber}`} className="text-center px-1 py-2 text-xs">
                            {hole.handicap}
                          </td>
                        ))}
                      </tr>

                      {/* BACK 9 */}
                      <tr className="border-t-2 border-gray-300 border-b border-gray-200">
                        <td colSpan={10} className="font-bold text-gray-900 py-2 text-xs uppercase">
                          BACK 9
                        </td>
                      </tr>
                      <tr className="border-b border-gray-200">
                        <td className="font-semibold text-gray-600 py-2 px-2 text-xs">Hole</td>
                        {course.holes.slice(9, 18).map((hole) => (
                          <td key={hole.holeNumber} className="text-center font-semibold px-1 py-2 text-xs">
                            {hole.holeNumber}
                          </td>
                        ))}
                      </tr>
                      <tr className="border-b border-gray-200">
                        <td className="font-semibold text-gray-600 py-2 px-2 text-xs">Par</td>
                        {course.holes.slice(9, 18).map((hole) => (
                          <td key={`par-${hole.holeNumber}`} className="text-center px-1 py-2 text-xs">
                            {hole.par}
                          </td>
                        ))}
                      </tr>
                      <tr className="border-b border-gray-200">
                        <td className="font-semibold text-gray-600 py-2 px-2 text-xs">Yds</td>
                        {course.holes.slice(9, 18).map((hole) => (
                          <td key={`yds-${hole.holeNumber}`} className="text-center px-1 py-2 text-xs">
                            {hole[selectedTee].yardage}
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td className="font-semibold text-gray-600 py-2 px-2 text-xs">Hcp</td>
                        {course.holes.slice(9, 18).map((hole) => (
                          <td key={`hcp-${hole.holeNumber}`} className="text-center px-1 py-2 text-xs">
                            {hole.handicap}
                          </td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Start Round Button */}
                <button
                  onClick={() => {
                    try {
                      localStorage.setItem('selectedCourse', JSON.stringify(course))
                      router.push('/new-round')
                    } catch (error) {
                      console.error('Error starting round:', error)
                      alert('Error starting round. Please try again.')
                    }
                  }}
                  className="btn-primary w-full mt-4"
                >
                  Start Round
                </button>
              </div>
            )}
          </div>
        ))}

        {displayedCourses.length === 0 && allCourses.length > 0 && (
          <div className="card text-center text-gray-500">
            No courses match your search.
          </div>
        )}

        {allCourses.length === 0 && (
          <div className="card text-center text-gray-500">
            No courses added yet.
          </div>
        )}
      </div>
    </PageWrapper>
  )
}
