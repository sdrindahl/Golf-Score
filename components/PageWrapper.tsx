'use client'

import Link from 'next/link'

interface PageWrapperProps {
  title: string
  userName?: string
  children: React.ReactNode
}

export default function PageWrapper({ title, userName, children }: PageWrapperProps) {
  return (
    <div className="min-h-screen pb-32">
      {/* Header */}
      {title && (
        <div className="px-6 pt-8 pb-4 text-white">
          <h1 className="text-4xl font-bold tracking-tight text-center">{title}</h1>
          {userName && <p className="text-base opacity-80 mt-2 text-center">{userName}</p>}
          <hr className="mt-4 border-t-2 border-black w-3/4 mx-auto" />
        </div>
      )}

      {/* Content Area */}
      <div className="px-4">
        {children}
      </div>
    </div>
  )
}
