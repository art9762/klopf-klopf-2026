import { useRef, useEffect } from 'react';
import type { Phase, QueueState, MidzoneStatus } from '../lib/contracts';

interface Props {
  phase: Phase | null;
  queues: QueueState | null;
  midzone: MidzoneStatus | null;
}

const PHASE_COLORS: Record<string, string> = {
  GREEN_A: '#10B981',
  GREEN_B: '#3B82F6',
  ALL_RED_A_to_B: '#EF4444',
  ALL_RED_B_to_A: '#EF4444',
  EMERGENCY: '#F59E0B',
  MANUAL: '#A855F7',
};

export function RoadVisualization({ phase, queues, midzone }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef(0);
  const timeRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const observer = new ResizeObserver(() => {
      canvas.width = container.clientWidth * window.devicePixelRatio;
      canvas.height = container.clientHeight * window.devicePixelRatio;
      canvas.style.width = container.clientWidth + 'px';
      canvas.style.height = container.clientHeight + 'px';
    });
    observer.observe(container);
    canvas.width = container.clientWidth * window.devicePixelRatio;
    canvas.height = container.clientHeight * window.devicePixelRatio;
    canvas.style.width = container.clientWidth + 'px';
    canvas.style.height = container.clientHeight + 'px';

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
    const dpr = window.devicePixelRatio;

    ctx.clearRect(0, 0, W, H);
    ctx.save();
    ctx.scale(dpr, dpr);
    const w = W / dpr;
    const h = H / dpr;

    const roadY = h / 2;
    const roadH = 70;

    // Road
    const roadGrad = ctx.createLinearGradient(0, roadY - roadH / 2, 0, roadY + roadH / 2);
    roadGrad.addColorStop(0, '#2a2d33');
    roadGrad.addColorStop(0.5, '#3a3d44');
    roadGrad.addColorStop(1, '#2a2d33');
    ctx.fillStyle = roadGrad;
    ctx.beginPath();
    ctx.roundRect(20, roadY - roadH / 2, w - 40, roadH, 8);
    ctx.fill();

    // Road edges
    ctx.strokeStyle = '#4b5563';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(20, roadY - roadH / 2, w - 40, roadH, 8);
    ctx.stroke();

    // Center dashed line
    ctx.setLineDash([14, 10]);
    ctx.strokeStyle = '#6b7280';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(30, roadY);
    ctx.lineTo(w - 30, roadY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Repair zone
    const zoneX = w * 0.3;
    const zoneW = w * 0.4;
    const zoneGrad = ctx.createLinearGradient(zoneX, 0, zoneX + zoneW, 0);
    zoneGrad.addColorStop(0, 'rgba(245, 158, 11, 0.08)');
    zoneGrad.addColorStop(0.5, 'rgba(245, 158, 11, 0.15)');
    zoneGrad.addColorStop(1, 'rgba(245, 158, 11, 0.08)');
    ctx.fillStyle = zoneGrad;
    ctx.fillRect(zoneX, roadY - roadH / 2, zoneW, roadH);

    // Animated dashed border
    const dashOffset = (t * 30) % 14;
    ctx.setLineDash([8, 6]);
    ctx.lineDashOffset = -dashOffset;
    ctx.strokeStyle = '#F59E0B';
    ctx.lineWidth = 2;
    ctx.strokeRect(zoneX, roadY - roadH / 2, zoneW, roadH);
    ctx.setLineDash([]);
    ctx.lineDashOffset = 0;

    // Traffic lights
    drawTrafficLight(ctx, 55, roadY - roadH / 2 - 10, phase === 'GREEN_A', t);
    drawTrafficLight(ctx, w - 55, roadY - roadH / 2 - 10, phase === 'GREEN_B', t);

    // Queue A cars (left side)
    const qA = queues?.queue_A ?? 0;
    for (let i = 0; i < Math.min(qA, 12); i++) {
      const x = 80 + i * 22;
      const y = roadY + 8;
      drawCar(ctx, x, y, '#60a5fa', t, i);
    }

    // Queue B cars (right side)
    const qB = queues?.queue_B ?? 0;
    for (let i = 0; i < Math.min(qB, 12); i++) {
      const x = w - 80 - i * 22;
      const y = roadY - 16;
      drawCar(ctx, x, y, '#60a5fa', t, i + 20);
    }

    // Vehicles in zone
    const vehicles = midzone?.vehicles_in_zone ?? [];
    const stuck = new Set(midzone?.stuck_ids ?? []);
    vehicles.forEach((id, i) => {
      const progress = ((t * 0.15 + i * 0.25) % 1);
      const x = zoneX + 15 + progress * (zoneW - 30);
      const y = roadY + (i % 2 === 0 ? -18 : 10);
      const isStuck = stuck.has(id);
      const color = isStuck ? '#EF4444' : '#10B981';
      drawCar(ctx, x, y, color, t, i + 40);
      if (isStuck) {
        const pulse = Math.sin(t * 5) * 0.3 + 0.5;
        ctx.globalAlpha = pulse;
        ctx.fillStyle = '#EF4444';
        ctx.beginPath();
        ctx.arc(x + 8, y + 4, 14, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    });

    // Labels
    ctx.font = '11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#9ca3af';
    ctx.fillText('Side A', 55, h - 10);
    ctx.fillText('Side B', w - 55, h - 10);
    ctx.fillStyle = '#F59E0B';
    ctx.fillText('REPAIR ZONE', w / 2, h - 10);

    // Phase indicator
    if (phase) {
      const color = PHASE_COLORS[phase] ?? '#EF4444';
      ctx.fillStyle = color;
      ctx.font = 'bold 12px system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(phase.replace(/_/g, ' '), 30, 20);
    }

    ctx.restore();
  }

  return (
    <div ref={containerRef} className="glass-panel rounded-2xl p-2 w-full h-[220px]">
      <canvas ref={canvasRef} className="w-full h-full rounded-xl" />
    </div>
  );
}

function drawTrafficLight(ctx: CanvasRenderingContext2D, x: number, y: number, isGreen: boolean, t: number) {
  // Housing
  ctx.fillStyle = '#1a1d21';
  ctx.beginPath();
  ctx.roundRect(x - 14, y - 50, 28, 52, 6);
  ctx.fill();
  ctx.strokeStyle = '#3a3d44';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Red light
  const redOn = !isGreen;
  ctx.beginPath();
  ctx.arc(x, y - 34, 8, 0, Math.PI * 2);
  if (redOn) {
    const pulse = Math.sin(t * 3) * 0.1 + 0.9;
    ctx.fillStyle = `rgba(239, 68, 68, ${pulse})`;
    ctx.fill();
    ctx.shadowColor = '#EF4444';
    ctx.shadowBlur = 12;
    ctx.fill();
    ctx.shadowBlur = 0;
  } else {
    ctx.fillStyle = '#3b1111';
    ctx.fill();
  }

  // Green light
  ctx.beginPath();
  ctx.arc(x, y - 14, 8, 0, Math.PI * 2);
  if (isGreen) {
    const pulse = Math.sin(t * 2) * 0.1 + 0.9;
    ctx.fillStyle = `rgba(16, 185, 129, ${pulse})`;
    ctx.fill();
    ctx.shadowColor = '#10B981';
    ctx.shadowBlur = 12;
    ctx.fill();
    ctx.shadowBlur = 0;
  } else {
    ctx.fillStyle = '#0f2922';
    ctx.fill();
  }
}

function drawCar(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, t: number, seed: number) {
  const wobble = Math.sin(t * 1.5 + seed * 0.7) * 0.5;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(x, y + wobble, 16, 8, 3);
  ctx.fill();
  // Windshield
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.fillRect(x + 10, y + wobble + 1, 4, 6);
}
