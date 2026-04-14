'use client'

import Link from 'next/link'

interface PageWrapperProps {
  title: string
  userName?: string
  children: React.ReactNode
}

export default function PageWrapper({ title, userName, children }: PageWrapperProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-600 via-green-600 to-teal-600 pb-12">
      {/* Header with Account Link */}
      <div className="px-6 py-8 text-white relative">
        <div className="absolute top-6 right-6">
          <Link href="/settings">
            <button className="text-white/80 hover:text-white text-sm font-medium underline transition-colors">
              Account
            </button>
          </Link>
        </div>
        <h1 className="text-4xl font-bold tracking-tight">{title}</h1>
        {userName && <p className="text-base opacity-80 mt-2">{userName}</p>}
      </div>

      {/* Content Area */}
      <div className="px-4">
        {children}
      </div>
    </div>
  )
}
