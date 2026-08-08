import { NextResponse } from 'next/server';

export async function GET() {
  // Simulates realistic server telemetry (CPU, RAM, GPU utilization)
  const simulatedMetrics = {
    cpu_usage: Math.floor(Math.random() * 18) + 5, // 5% - 23%
    memory_usage: Math.floor(Math.random() * 25) + 30, // 30% - 55%
    gpu_usage: Math.floor(Math.random() * 12) + 2, // 2% - 14%
    gpu_temp: Math.floor(Math.random() * 5) + 42, // 42°C - 47°C
    status: 'healthy',
  };

  return NextResponse.json(simulatedMetrics);
}