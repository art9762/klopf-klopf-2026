import { useRef, useEffect } from 'react';
import type { Phase, QueueState, MidzoneStatus } from '../lib/contracts';

interface Props {
  phase: Phase | null;
  queues: QueueState | null;
  midzone: MidzoneStatus | null;
}

export function RoadCanvas({ phase, queues, midzone }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const observer = new ResizeObserver(() => {
      canvas.width = container.clientWidth;
      canvas.height = 200;
      draw();
    });
    observer.observe(container);
    draw();
    return () => observer.disconnect();
  });

  function draw() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const W = canvas.width;
    const H = canvas.height;

    ctx.clearRect(0, 0, W, H);

    // Road background
    ctx.fillStyle = '#374151';
    ctx.fillRect(0, H / 2 - 30, W, 60);

    // Center lane divider
    ctx.setLineDash([10, 8]);
    ctx.strokeStyle = '#9ca3af';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, H / 2);
    ctx.lineTo(W, H / 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Construction zone
    const zoneX = W * 0.3;
    const zoneW = W * 0.4;
    ctx.fillStyle = '#1f2937';
    ctx.fillRect(zoneX, H / 2 - 30, zoneW, 60);
    ctx.setLineDash([6, 4]);
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 2;
    ctx.strokeRect(zoneX, H / 2 - 30, zoneW, 60);
    ctx.setLineDash([]);

    // Traffic lights
    drawLight(ctx, 60, H / 2 - 50, phase === 'GREEN_A');
    drawLight(ctx, W - 60, H / 2 - 50, phase === 'GREEN_B');

    // Queue A (left side)
    const qA = queues?.queue_A ?? 0;
    for (let i = 0; i < Math.min(qA, 15); i++) {
      ctx.fillStyle = '#60a5fa';
      ctx.fillRect(80 + i * 14, H / 2 - 10, 10, 8);
      ctx.fillRect(80 + i * 14, H / 2 + 2, 10, 8);
    }

    // Queue B (right side)
    const qB = queues?.queue_B ?? 0;
    for (let i = 0; i < Math.min(qB, 15); i++) {
      ctx.fillStyle = '#60a5fa';
      ctx.fillRect(W - 90 - i * 14, H / 2 - 10, 10, 8);
      ctx.fillRect(W - 90 - i * 14, H / 2 + 2, 10, 8);
    }

    // Vehicles in zone
    const vehicles = midzone?.vehicles_in_zone ?? [];
    const stuck = new Set(midzone?.stuck_ids ?? []);
    vehicles.forEach((id, i) => {
      const x = zoneX + 20 + (i * (zoneW - 40)) / Math.max(vehicles.length, 1);
      const y = H / 2 - 5 + (i % 2 === 0 ? -10 : 10);
      ctx.fillStyle = stuck.has(id) ? '#ef4444' : '#34d399';
      ctx.fillRect(x, y, 12, 8);
    });

    // Labels
    ctx.fillStyle = '#9ca3af';
    ctx.font = '12px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('Side A', 60, H - 10);
    ctx.fillText('Side B', W - 60, H - 10);
    ctx.fillText('REPAIR ZONE', W / 2, H - 10);

    if (qA > 0) {
      ctx.fillStyle = '#60a5fa';
      ctx.fillText(`${qA} vehicles`, 140, H / 2 + 40);
    }
    if (qB > 0) {
      ctx.fillStyle = '#60a5fa';
      ctx.fillText(`${qB} vehicles`, W - 140, H / 2 + 40);
    }
  }

  return (
    <div ref={containerRef} className="w-full rounded-lg border border-gray-700 bg-gray-900 p-2">
      <canvas ref={canvasRef} height={200} />
    </div>
  );
}

function drawLight(ctx: CanvasRenderingContext2D, x: number, y: number, isGreen: boolean) {
  ctx.fillStyle = '#111827';
  ctx.fillRect(x - 12, y, 24, 50);
  // Red
  ctx.beginPath();
  ctx.arc(x, y + 14, 8, 0, Math.PI * 2);
  ctx.fillStyle = isGreen ? '#4b1c1c' : '#ef4444';
  ctx.fill();
  // Green
  ctx.beginPath();
  ctx.arc(x, y + 36, 8, 0, Math.PI * 2);
  ctx.fillStyle = isGreen ? '#22c55e' : '#14352a';
  ctx.fill();
}
