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
  const frameRef = useRef<number>(0);
  const timeRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const observer = new ResizeObserver(() => {
      canvas.width = container.clientWidth;
      canvas.height = 200;
    });
    observer.observe(container);
    canvas.width = container.clientWidth;
    canvas.height = 200;

    let running = true;
    function animate() {
      if (!running) return;
      timeRef.current = performance.now() / 1000;
      draw();
      frameRef.current = requestAnimationFrame(animate);
    }
    animate();

    return () => {
      running = false;
      cancelAnimationFrame(frameRef.current);
      observer.disconnect();
    };
  });

  function draw() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const W = canvas.width;
    const H = canvas.height;
    const t = timeRef.current;

    ctx.clearRect(0, 0, W, H);

    const roadGrad = ctx.createLinearGradient(0, H / 2 - 35, 0, H / 2 + 35);
    roadGrad.addColorStop(0, '#374151');
    roadGrad.addColorStop(0.5, '#4b5563');
    roadGrad.addColorStop(1, '#374151');
    ctx.fillStyle = roadGrad;
    ctx.fillRect(0, H / 2 - 35, W, 70);

    ctx.strokeStyle = '#1f2937';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, H / 2 - 35);
    ctx.lineTo(W, H / 2 - 35);
    ctx.moveTo(0, H / 2 + 35);
    ctx.lineTo(W, H / 2 + 35);
    ctx.stroke();

    ctx.setLineDash([12, 10]);
    ctx.strokeStyle = '#9ca3af';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, H / 2);
    ctx.lineTo(W, H / 2);
    ctx.stroke();
    ctx.setLineDash([]);

    const zoneX = W * 0.3;
    const zoneW = W * 0.4;
    const zoneGrad = ctx.createLinearGradient(zoneX, 0, zoneX + zoneW, 0);
    zoneGrad.addColorStop(0, 'rgba(245, 158, 11, 0.05)');
    zoneGrad.addColorStop(0.5, 'rgba(245, 158, 11, 0.1)');
    zoneGrad.addColorStop(1, 'rgba(245, 158, 11, 0.05)');
    ctx.fillStyle = zoneGrad;
    ctx.fillRect(zoneX, H / 2 - 35, zoneW, 70);

    const dashOffset = (t * 20) % 10;
    ctx.setLineDash([6, 4]);
    ctx.lineDashOffset = -dashOffset;
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 2;
    ctx.strokeRect(zoneX, H / 2 - 35, zoneW, 70);
    ctx.setLineDash([]);
    ctx.lineDashOffset = 0;

    drawLight(ctx, 60, H / 2 - 55, phase === 'GREEN_A', t);
    drawLight(ctx, W - 60, H / 2 - 55, phase === 'GREEN_B', t);

    const qA = queues?.queue_A ?? 0;
    for (let i = 0; i < Math.min(qA, 15); i++) {
      const wobble = Math.sin(t * 2 + i * 0.5) * 1;
      drawVehicle(ctx, 85 + i * 16, H / 2 - 8 + wobble, '#60a5fa', false);
    }

    const qB = queues?.queue_B ?? 0;
    for (let i = 0; i < Math.min(qB, 15); i++) {
      const wobble = Math.sin(t * 2 + i * 0.7) * 1;
      drawVehicle(ctx, W - 95 - i * 16, H / 2 - 8 + wobble, '#60a5fa', false);
    }

    const vehicles = midzone?.vehicles_in_zone ?? [];
    const stuck = new Set(midzone?.stuck_ids ?? []);
    vehicles.forEach((id, i) => {
      const progress = ((t * 0.3 + i * 0.3) % 1);
      const x = zoneX + 20 + progress * (zoneW - 50);
      const y = H / 2 - 5 + (i % 2 === 0 ? -12 : 12);
      const isStuck = stuck.has(id);
      const color = isStuck ? '#ef4444' : '#34d399';
      drawVehicle(ctx, x, y, color, isStuck);
      if (isStuck) {
        const pulse = Math.sin(t * 4) * 0.3 + 0.7;
        ctx.globalAlpha = pulse * 0.3;
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(x + 6, y + 4, 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    });

    ctx.fillStyle = '#6b7280';
    ctx.font = '11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Side A', 60, H - 12);
    ctx.fillText('Side B', W - 60, H - 12);

    ctx.fillStyle = '#f59e0b80';
    ctx.font = '10px system-ui, sans-serif';
    ctx.fillText('REPAIR ZONE', W / 2, H - 12);

    if (qA > 0) {
      ctx.fillStyle = '#60a5fa';
      ctx.font = 'bold 11px system-ui, sans-serif';
      ctx.fillText(`${qA}`, 140, H / 2 + 50);
    }
    if (qB > 0) {
      ctx.fillStyle = '#60a5fa';
      ctx.font = 'bold 11px system-ui, sans-serif';
      ctx.fillText(`${qB}`, W - 140, H / 2 + 50);
    }
  }

  return (
    <div ref={containerRef} className="card w-full p-3">
      <canvas ref={canvasRef} height={200} className="w-full" />
    </div>
  );
}

function drawVehicle(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, highlight: boolean) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(x, y, 12, 8, 2);
  ctx.fill();
  if (highlight) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

function drawLight(ctx: CanvasRenderingContext2D, x: number, y: number, isGreen: boolean, t: number) {
  ctx.fillStyle = '#111827';
  ctx.beginPath();
  ctx.roundRect(x - 14, y, 28, 55, 4);
  ctx.fill();
  ctx.strokeStyle = '#374151';
  ctx.lineWidth = 1;
  ctx.stroke();

  const pulse = isGreen ? 1 : (Math.sin(t * 3) * 0.15 + 0.85);

  ctx.beginPath();
  ctx.arc(x, y + 16, 9, 0, Math.PI * 2);
  if (!isGreen) {
    ctx.fillStyle = `rgba(239, 68, 68, ${pulse})`;
    ctx.fill();
    ctx.shadowColor = '#ef4444';
    ctx.shadowBlur = 8;
    ctx.fill();
    ctx.shadowBlur = 0;
  } else {
    ctx.fillStyle = '#4b1c1c';
    ctx.fill();
  }

  ctx.beginPath();
  ctx.arc(x, y + 39, 9, 0, Math.PI * 2);
  if (isGreen) {
    const gPulse = Math.sin(t * 2) * 0.1 + 0.9;
    ctx.fillStyle = `rgba(34, 197, 94, ${gPulse})`;
    ctx.fill();
    ctx.shadowColor = '#22c55e';
    ctx.shadowBlur = 10;
    ctx.fill();
    ctx.shadowBlur = 0;
  } else {
    ctx.fillStyle = '#14352a';
    ctx.fill();
  }
}
