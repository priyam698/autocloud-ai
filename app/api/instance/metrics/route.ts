import { NextResponse } from 'next/server';

export async function GET() {
  const simulatedMetrics = {
    cpu_usage: Math.floor(Math.random() * 18) + 5,
    memory_usage: Math.floor(Math.random() * 25) + 30,
    gpu_usage: Math.floor(Math.random() * 12) + 2,
    gpu_temp: Math.floor(Math.random() * 5) + 42,
    status: 'healthy',
  };

  return NextResponse.json(simulatedMetrics);
}