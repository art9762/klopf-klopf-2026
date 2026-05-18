import { useRef, useEffect } from 'react';
import type { Phase, QueueState, MidzoneStatus } from '../lib/contracts';

interface Props {
  phase: Phase | null;
  queues: QueueState | null;
  midzone: MidzoneStatus | null;
}

interface AmbientCar {
  x: number;
  y: number;
  speed: number;
  baseSpeed: number;
  direction: number;
  color: string;
  size: number;
}

export function RoadVisualization({ phase, queues, midzone }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef(0);
  const timeRef = useRef(0);
  const carsRef = useRef<AmbientCar[] | null>(null);
  const propsRef = useRef({ phase, queues, midzone });
  propsRef.current = { phase, queues, midzone };

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    // Init ambient cars ONCE
    if (!carsRef.current) {
      const cars: AmbientCar[] = [];
      for (let i = 0; i < 8; i++) {
        const goesRight = i % 2 === 0;
        cars.push({
          x: (i * 120) + 50,
          y: goesRight ? 0.62 : 0.38,
          speed: 0.4 + (i % 3) * 0.15,
          baseSpeed: 0.4 + (i % 3) * 0.15,
          direction: goesRight ? 1 : -1,
          color: ['#60a5fa', '#38bdf8', '#818cf8', '#a78bfa', '#34d399'][i % 5],
          size: 14 + (i % 3) * 3,
        });
      }
      carsRef.current = cars;
    }

    const observer = new ResizeObserver(() => {
      canvas.width = container.clientWidth * 2;
      canvas.height = container.clientHeight * 2;
      canvas.style.width = container.clientWidth + 'px';
      canvas.style.height = container.clientHeight + 'px';
    });
    observer.observe(container);
    canvas.width = container.clientWidth * 2;
    canvas.height = container.clientHeight * 2;
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
  }, []);

  function draw() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const W = canvas.width;
    const H = canvas.height;
    const t = timeRef.current;
    const { phase, queues, midzone } = propsRef.current;

    ctx.clearRect(0, 0, W, H);

    const w = W;
    const h = H;
    const roadY = h * 0.5;
    const roadH = h * 0.4;
    const roadTop = roadY - roadH / 2;
    const roadBot = roadY + roadH / 2;

    // Background gradient
    const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
    bgGrad.addColorStop(0, '#0f1218');
    bgGrad.addColorStop(1, '#0a0c10');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    // Road surface
    const roadGrad = ctx.createLinearGradient(0, roadTop, 0, roadBot);
    roadGrad.addColorStop(0, '#1e2228');
    roadGrad.addColorStop(0.3, '#2a2f38');
    roadGrad.addColorStop(0.5, '#323840');
    roadGrad.addColorStop(0.7, '#2a2f38');
    roadGrad.addColorStop(1, '#1e2228');
    ctx.fillStyle = roadGrad;
    ctx.beginPath();
    ctx.roundRect(40, roadTop, w - 80, roadH, 12);
    ctx.fill();

    // Road edge lines
    ctx.strokeStyle = '#4b5563';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(50, roadTop);
    ctx.lineTo(w - 50, roadTop);
    ctx.moveTo(50, roadBot);
    ctx.lineTo(w - 50, roadBot);
    ctx.stroke();

    // Center dashed line
    ctx.setLineDash([20, 14]);
    ctx.strokeStyle = '#6b7280';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(50, roadY);
    ctx.lineTo(w - 50, roadY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Repair zone
    const zoneX = w * 0.32;
    const zoneW = w * 0.36;
    const zoneGrad = ctx.createLinearGradient(zoneX, roadTop, zoneX, roadBot);
    zoneGrad.addColorStop(0, 'rgba(245, 158, 11, 0.03)');
    zoneGrad.addColorStop(0.5, 'rgba(245, 158, 11, 0.08)');
    zoneGrad.addColorStop(1, 'rgba(245, 158, 11, 0.03)');
    ctx.fillStyle = zoneGrad;
    ctx.fillRect(zoneX, roadTop, zoneW, roadH);

    // Animated zone border
    const dashOffset = (t * 40) % 20;
    ctx.setLineDash([12, 8]);
    ctx.lineDashOffset = -dashOffset;
    ctx.strokeStyle = `rgba(245, 158, 11, ${0.5 + Math.sin(t * 2) * 0.2})`;
    ctx.lineWidth = 3;
    ctx.strokeRect(zoneX, roadTop + 4, zoneW, roadH - 8);
    ctx.setLineDash([]);
    ctx.lineDashOffset = 0;

    // Zone label
    ctx.font = `bold ${h * 0.05}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(245, 158, 11, 0.4)';
    ctx.fillText('REPAIR ZONE', w / 2, roadY + 4);

    // Traffic lights
    const lightAGreen = phase === 'GREEN_A';
    const lightBGreen = phase === 'GREEN_B';
    drawTrafficLight(ctx, 90, roadTop - 20, lightAGreen, t, h);
    drawTrafficLight(ctx, w - 90, roadTop - 20, lightBGreen, t, h);

    // Ambient cars (always moving)
    const isAGreen = phase === 'GREEN_A';
    const isBGreen = phase === 'GREEN_B';
    const cars = carsRef.current;
    const stopLineA = zoneX - 30;
    const stopLineB = zoneX + zoneW + 30;

    cars.forEach((car) => {
      const isGreen = car.direction > 0 ? isAGreen : isBGreen;
      const nearStop = car.direction > 0
        ? (car.x > stopLineA - 40 && car.x < stopLineA + 10)
        : (car.x < stopLineB + 40 && car.x > stopLineB - 10);

      if (!isGreen && nearStop) {
        car.speed = Math.max(0, car.speed - 0.02);
      } else {
        car.speed = Math.min(car.baseSpeed, car.speed + 0.01);
      }

      car.x += car.speed * car.direction;

      if (car.direction > 0 && car.x > w + 20) car.x = -20;
      if (car.direction < 0 && car.x < -20) car.x = w + 20;

      const cy = roadTop + car.y * roadH;
      drawCar2D(ctx, car.x, cy, car.color, car.size, car.direction, t);
    });

    // Queue cars
    const qA = queues?.queue_A ?? 0;
    for (let i = 0; i < Math.min(qA, 10); i++) {
      const x = stopLineA - i * 28 - 20;
      drawCar2D(ctx, x, roadTop + 0.62 * roadH, '#60a5fa', 16, 1, t);
    }
    const qB = queues?.queue_B ?? 0;
    for (let i = 0; i < Math.min(qB, 10); i++) {
      const x = stopLineB + i * 28 + 20;
      drawCar2D(ctx, x, roadTop + 0.38 * roadH, '#60a5fa', 16, -1, t);
    }

    // Vehicles in zone
    const vehicles = midzone?.vehicles_in_zone ?? [];
    const stuck = new Set(midzone?.stuck_ids ?? []);
    vehicles.forEach((id, i) => {
      const progress = ((t * 0.1 + i * 0.2) % 1);
      const x = zoneX + 20 + progress * (zoneW - 40);
      const y = roadTop + (i % 2 === 0 ? 0.35 : 0.65) * roadH;
      const isStuck = stuck.has(id);
      const color = isStuck ? '#EF4444' : '#10B981';
      drawCar2D(ctx, x, y, color, 18, 1, t);
      if (isStuck) {
        ctx.globalAlpha = 0.3 + Math.sin(t * 5) * 0.2;
        ctx.fillStyle = '#EF4444';
        ctx.beginPath();
        ctx.arc(x + 9, y + 5, 18, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    });

    // Side labels
    ctx.font = `${h * 0.045}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#6b7280';
    ctx.fillText('Side A', 90, h - 12);
    ctx.fillText('Side B', w - 90, h - 12);

    // Queue counts
    if (qA > 0) {
      ctx.fillStyle = '#60a5fa';
      ctx.font = `bold ${h * 0.05}px system-ui, sans-serif`;
      ctx.fillText(`${qA}`, stopLineA - 60, roadBot + h * 0.08);
    }
    if (qB > 0) {
      ctx.fillStyle = '#60a5fa';
      ctx.font = `bold ${h * 0.05}px system-ui, sans-serif`;
      ctx.fillText(`${qB}`, stopLineB + 60, roadBot + h * 0.08);
    }
  }

  return (
    <div ref={containerRef} className="glass-panel rounded-2xl p-3 w-full" style={{ height: '240px' }}>
      <canvas ref={canvasRef} className="w-full h-full rounded-xl" />
    </div>
  );
}

function drawTrafficLight(ctx: CanvasRenderingContext2D, x: number, y: number, isGreen: boolean, t: number, h: number) {
  const scale = h * 0.001;
  const boxW = 28 * scale;
  const boxH = 56 * scale;

  // Pole
  ctx.fillStyle = '#374151';
  ctx.fillRect(x - 3 * scale, y, 6 * scale, boxH + 20 * scale);

  // Housing
  ctx.fillStyle = '#111827';
  ctx.beginPath();
  ctx.roundRect(x - boxW / 2, y - boxH, boxW, boxH, 6 * scale);
  ctx.fill();
  ctx.strokeStyle = '#374151';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  const r = 9 * scale;

  // Red
  ctx.beginPath();
  ctx.arc(x, y - boxH + r + 8 * scale, r, 0, Math.PI * 2);
  if (!isGreen) {
    const pulse = 0.85 + Math.sin(t * 3) * 0.15;
    ctx.fillStyle = `rgba(239, 68, 68, ${pulse})`;
    ctx.fill();
    ctx.shadowColor = '#EF4444';
    ctx.shadowBlur = 16 * scale;
    ctx.fill();
    ctx.shadowBlur = 0;
  } else {
    ctx.fillStyle = '#3b1111';
    ctx.fill();
  }

  // Green
  ctx.beginPath();
  ctx.arc(x, y - 8 * scale - r, r, 0, Math.PI * 2);
  if (isGreen) {
    const pulse = 0.85 + Math.sin(t * 2) * 0.15;
    ctx.fillStyle = `rgba(16, 185, 129, ${pulse})`;
    ctx.fill();
    ctx.shadowColor = '#10B981';
    ctx.shadowBlur = 16 * scale;
    ctx.fill();
    ctx.shadowBlur = 0;
  } else {
    ctx.fillStyle = '#0f2922';
    ctx.fill();
  }
}

function drawCar2D(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, size: number, direction: number, _t: number) {
  // Body
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(x, y - size * 0.3, size, size * 0.6, 3);
  ctx.fill();

  // Roof
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  const roofX = direction > 0 ? x + size * 0.35 : x + size * 0.15;
  ctx.beginPath();
  ctx.roundRect(roofX, y - size * 0.2, size * 0.45, size * 0.4, 2);
  ctx.fill();

  // Headlights
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  const hlX = direction > 0 ? x + size - 2 : x;
  ctx.fillRect(hlX, y - size * 0.15, 2, 3);
  ctx.fillRect(hlX, y + size * 0.05, 2, 3);

  // Taillights
  ctx.fillStyle = 'rgba(239, 68, 68, 0.6)';
  const tlX = direction > 0 ? x : x + size - 2;
  ctx.fillRect(tlX, y - size * 0.15, 2, 3);
  ctx.fillRect(tlX, y + size * 0.05, 2, 3);
}
