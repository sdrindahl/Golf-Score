import { NextRequest, NextResponse } from 'next/server'
import { syncDataFromSupabase } from '@/lib/dataSync.server'

export async function POST(req: NextRequest) {
  try {
    await syncDataFromSupabase()
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 })
  }
}
