'use client';

import { useEffect, useRef } from 'react';

export default function ThreeBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    // 3D Particles
    interface Particle {
      x: number;
      y: number;
      z: number;
      size: number;
      color: string;
      speed: number;
    }

    const particles: Particle[] = [];
    const colors = ['#f43f5e', '#fb7185', '#a855f7', '#818cf8', '#38bdf8', '#f59e0b'];
    const particleCount = 140;

    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: (Math.random() - 0.5) * width * 2,
        y: (Math.random() - 0.5) * height * 2,
        z: Math.random() * 1000,
        size: Math.random() * 2 + 1,
        color: colors[Math.floor(Math.random() * colors.length)],
        speed: Math.random() * 1.2 + 0.4,
      });
    }

    const handleResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };

    window.addEventListener('resize', handleResize);

    let offset = 0;

    const render = () => {
      // Clear canvas with dark aesthetic background
      ctx.fillStyle = '#0d0f12';
      ctx.fillRect(0, 0, width, height);

      const fov = 300;
      const cx = width / 2;
      const cy = height / 2;

      // Render 3D Depth Starfield/Particles
      particles.forEach((p) => {
        p.z -= p.speed;
        if (p.z <= 0) {
          p.z = 1000;
          p.x = (Math.random() - 0.5) * width * 2;
          p.y = (Math.random() - 0.5) * height * 2;
        }

        const scale = fov / (fov + p.z);
        const x3d = p.x * scale + cx;
        const y3d = p.y * scale + cy;

        if (x3d >= 0 && x3d <= width && y3d >= 0 && y3d <= height) {
          const alpha = Math.min(1, Math.max(0.1, (1000 - p.z) / 1000));
          ctx.beginPath();
          ctx.arc(x3d, y3d, p.size * scale * 3, 0, Math.PI * 2);
          ctx.fillStyle = p.color;
          ctx.globalAlpha = alpha;
          ctx.fill();
        }
      });

      // Render Perspective 3D Moving Floor Grid
      offset = (offset + 0.5) % 30;
      const horizon = cy + 80;
      
      ctx.strokeStyle = '#f43f5e';
      ctx.lineWidth = 1;

      // Perspective lines converging at horizon
      for (let x = -width; x < width * 2; x += 80) {
        ctx.globalAlpha = 0.12;
        ctx.beginPath();
        ctx.moveTo(cx, horizon);
        ctx.lineTo(x, height);
        ctx.stroke();
      }

      // Horizontal scanning lines
      for (let y = horizon; y < height; y += 18) {
        const lineY = y + offset;
        if (lineY < height) {
          const alpha = Math.min(0.2, (lineY - horizon) / (height - horizon));
          ctx.globalAlpha = alpha;
          ctx.beginPath();
          ctx.moveTo(0, lineY);
          ctx.lineTo(width, lineY);
          ctx.stroke();
        }
      }

      ctx.globalAlpha = 1;
      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0 opacity-70"
    />
  );
}