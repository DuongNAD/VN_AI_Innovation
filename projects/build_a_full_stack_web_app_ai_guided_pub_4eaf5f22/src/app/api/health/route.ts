import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const startTime = Date.now();
    
    // Thực hiện truy vấn nhẹ để đánh thức database (Neon)
    await prisma.$queryRaw`SELECT 1`;
    
    const latency = Date.now() - startTime;

    return NextResponse.json(
      { 
        status: 'ok', 
        message: 'Database and backend are awake',
        latencyMs: latency
      }, 
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Keep-alive ping failed:', error);
    return NextResponse.json(
      { 
        status: 'error', 
        message: 'Database connection failed',
        error: error?.message || 'Unknown error'
      }, 
      { status: 500 }
    );
  }
}
