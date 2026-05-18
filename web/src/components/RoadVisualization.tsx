import { useRef, useEffect } from 'react';
import type { Phase, QueueState, MidzoneStatus } from '../lib/contracts';

interface Props {
  phase: Phase | null;
  queues: QueueState | null;
  midzone: MidzoneStatus | null;
}

interface AmbientCar {
  x: number;
  lane: number;
  speed: number;
  baseSpeed: number;
  direction: number;
  color: string;
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

    if (!carsRef.current) {
      const cars: AmbientCar[] = [];
      const colors = ['#60a5fa', '#38bdf8', '#818cf8', '#a78bfa', '#34d399', '#fbbf24'];
      // Reversible corridor: ONE lane, cars go one direction at a time
      // 3 cars going right (Side A → Side B), 3 going left (Side B → Side A)
      // All in the SAME lane (center), direction controlled by traffic light
      const configs = [
        // Group A: going right
        { x: 0.05, speed: 0.0012, dir: 1 },
        { x: 0.15, speed: 0.0012, dir: 1 },
        { x: 0.25, speed: 0.0012, dir: 1 },
        // Group B: going left
        { x: 0.95, speed: 0.0010, dir: -1 },
        { x: 0.85, speed: 0.0010, dir: -1 },
        { x: 0.75, speed: 0.0010, dir: -1 },
      ];
      configs.forEach((cfg, i) => {
        cars.push({
          x: cfg.x,
          lane: 0, // all same lane (the reversible one)
          speed: cfg.speed,
          baseSpeed: cfg.speed,
          direction: cfg.dir,
          color: colors[i],
        });
      });
      carsRef.current = cars;
    }

    function resize() {
      const dpr = window.devicePixelRatio || 1;
      const w = container!.clientWidth;
      const h = container!.clientHeight;
      canvas!.width = w * dpr;
      canvas!.height = h * dpr;
      canvas!.style.width = w + 'px';
      canvas!.style.height = h + 'px';
    }
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(container);

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

    const { phase, queues, midzone } = propsRef.current;
    const W = canvas.width;
    const H = canvas.height;
    const t = timeRef.current;

    const isAGreen = phase === 'GREEN_A';
    const isBGreen = phase === 'GREEN_B';

    ctx.clearRect(0, 0, W, H);

    // All coordinates in normalized [0,1] then scaled
    const margin = W * 0.03;
    const roadLeft = margin;
    const roadRight = W - margin;
    const roadW = roadRight - roadLeft;
    const roadTop = H * 0.3;
    const roadBot = H * 0.75;
    const roadH = roadBot - roadTop;
    const roadMid = (roadTop + roadBot) / 2;
    const laneH = roadH / 2;

    // Road surface
    ctx.fillStyle = '#252a30';
    ctx.beginPath();
    ctx.roundRect(roadLeft, roadTop, roadW, roadH, 10);
    ctx.fill();

    // Road edge markings
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(roadLeft + 10, roadTop);
    ctx.lineTo(roadRight - 10, roadTop);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(roadLeft + 10, roadBot);
    ctx.lineTo(roadRight - 10, roadBot);
    ctx.stroke();

    // Center dashed line (direction indicator)
    ctx.setLineDash([W * 0.015, W * 0.01]);
    ctx.strokeStyle = isAGreen ? '#10B981' : isBGreen ? '#3B82F6' : '#EF4444';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(roadLeft + 20, roadMid);
    ctx.lineTo(roadRight - 20, roadMid);
    ctx.stroke();
    ctx.setLineDash([]);

    // Repair zone
    const zoneLeft = roadLeft + roadW * 0.3;
    const zoneRight = roadLeft + roadW * 0.7;
    const zoneW = zoneRight - zoneLeft;

    ctx.fillStyle = 'rgba(245, 158, 11, 0.06)';
    ctx.fillRect(zoneLeft, roadTop, zoneW, roadH);

    const dashOff = (t * 50) % 24;
    ctx.setLineDash([14, 10]);
    ctx.lineDashOffset = -dashOff;
    ctx.strokeStyle = `rgba(245, 158, 11, ${0.6 + Math.sin(t * 2) * 0.2})`;
    ctx.lineWidth = 3;
    ctx.strokeRect(zoneLeft, roadTop + 3, zoneW, roadH - 6);
    ctx.setLineDash([]);
    ctx.lineDashOffset = 0;

    // Zone label
    ctx.font = `bold ${H * 0.06}px system-ui`;
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(245, 158, 11, 0.3)';
    ctx.fillText('REPAIR ZONE', (zoneLeft + zoneRight) / 2, roadMid + H * 0.02);

    // Stop lines
    const stopA = zoneLeft - 4;
    const stopB = zoneRight + 4;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(stopA, roadTop + 4);
    ctx.lineTo(stopA, roadBot - 4);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(stopB, roadTop + 4);
    ctx.lineTo(stopB, roadBot - 4);
    ctx.stroke();

    // Traffic lights
    drawLight(ctx, stopA, roadTop - H * 0.02, H * 0.18, isAGreen, t);
    drawLight(ctx, stopB, roadTop - H * 0.02, H * 0.18, isBGreen, t);

    // Ambient cars — reversible corridor: one lane, one direction at a time
    const cars = carsRef.current!;
    const stopANorm = (stopA - roadLeft) / roadW;
    const stopBNorm = (stopB - roadLeft) / roadW;

    cars.forEach((car, idx) => {
      const isMyTurn = car.direction > 0 ? isAGreen : isBGreen;
      const groupIdx = car.direction > 0 ? idx : idx - 3;

      if (!isMyTurn) {
        // Not my turn: park in queue before stop line
        car.speed = 0;
        if (car.direction > 0) {
          car.x = stopANorm - 0.04 - groupIdx * 0.06;
        } else {
          car.x = stopBNorm + 0.04 + groupIdx * 0.06;
        }
      } else {
        // My turn: drive through
        car.speed = Math.min(car.baseSpeed, car.speed + 0.00008);
        car.x += car.speed * car.direction;

        // Wrap: exited the other side, come back to queue start
        if (car.direction > 0 && car.x > 1.05) {
          car.x = stopANorm - 0.04 - groupIdx * 0.06;
        }
        if (car.direction < 0 && car.x < -0.05) {
          car.x = stopBNorm + 0.04 + groupIdx * 0.06;
        }
      }

      // Draw
      const cx = roadLeft + car.x * roadW;
      const cy = roadMid;
      drawCar(ctx, cx, cy, car.color, H * 0.08, car.direction);
    });

    // Queue cars
    const qA = queues?.queue_A ?? 0;
    for (let i = 0; i < Math.min(qA, 8); i++) {
      const cx = stopA - (i + 1) * H * 0.09;
      const cy = roadMid + laneH * 0.5;
      drawCar(ctx, cx, cy, '#60a5fa', H * 0.065, 1);
    }
    const qB = queues?.queue_B ?? 0;
    for (let i = 0; i < Math.min(qB, 8); i++) {
      const cx = stopB + (i + 1) * H * 0.09;
      const cy = roadMid - laneH * 0.5;
      drawCar(ctx, cx, cy, '#60a5fa', H * 0.065, -1);
    }

    // Vehicles in zone
    const vehicles = midzone?.vehicles_in_zone ?? [];
    const stuck = new Set(midzone?.stuck_ids ?? []);
    vehicles.forEach((id, i) => {
      const progress = ((t * 0.08 + i * 0.2) % 1);
      const cx = zoneLeft + 20 + progress * (zoneW - 40);
      const cy = i % 2 === 0 ? roadMid + laneH * 0.5 : roadMid - laneH * 0.5;
      const isStuck = stuck.has(id);
      drawCar(ctx, cx, cy, isStuck ? '#EF4444' : '#10B981', H * 0.07, 1);
      if (isStuck) {
        ctx.globalAlpha = 0.3 + Math.sin(t * 5) * 0.15;
        ctx.beginPath();
        ctx.arc(cx, cy, H * 0.05, 0, Math.PI * 2);
        ctx.fillStyle = '#EF4444';
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    });

    // Labels
    ctx.font = `${H * 0.055}px system-ui`;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#9ca3af';
    ctx.fillText('Side A', roadLeft + roadW * 0.1, H * 0.93);
    ctx.fillText('Side B', roadLeft + roadW * 0.9, H * 0.93);
  }

  return (
    <div ref={containerRef} className="glass-panel rounded-2xl p-3 w-full" style={{ height: '320px' }}>
      <canvas ref={canvasRef} className="w-full h-full rounded-xl" />
    </div>
  );
}

function drawLight(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, isGreen: boolean, t: number) {
  const w = size * 0.35;
  const h = size;

  // Housing
  ctx.fillStyle = '#111827';
  ctx.beginPath();
  ctx.roundRect(x - w / 2, y - h, w, h, 6);
  ctx.fill();
  ctx.strokeStyle = '#4b5563';
  ctx.lineWidth = 2;
  ctx.stroke();

  const r = w * 0.32;
  const redY = y - h + r + h * 0.18;
  const greenY = y - r - h * 0.18;

  // Red
  ctx.beginPath();
  ctx.arc(x, redY, r, 0, Math.PI * 2);
  if (!isGreen) {
    const p = 0.85 + Math.sin(t * 3) * 0.15;
    ctx.fillStyle = `rgba(239, 68, 68, ${p})`;
    ctx.fill();
    ctx.shadowColor = '#EF4444';
    ctx.shadowBlur = 20;
    ctx.fill();
    ctx.shadowBlur = 0;
  } else {
    ctx.fillStyle = '#3b1111';
    ctx.fill();
  }

  // Green
  ctx.beginPath();
  ctx.arc(x, greenY, r, 0, Math.PI * 2);
  if (isGreen) {
    const p = 0.85 + Math.sin(t * 2) * 0.15;
    ctx.fillStyle = `rgba(16, 185, 129, ${p})`;
    ctx.fill();
    ctx.shadowColor = '#10B981';
    ctx.shadowBlur = 20;
    ctx.fill();
    ctx.shadowBlur = 0;
  } else {
    ctx.fillStyle = '#0f2922';
    ctx.fill();
  }
}

function drawCar(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, size: number, direction: number) {
  const w = size * 1.8;
  const h = size * 0.8;

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(x, y + h * 0.6, w * 0.45, h * 0.2, 0, 0, Math.PI * 2);
  ctx.fill();

  // Body
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(x - w / 2, y - h / 2, w, h, h * 0.25);
  ctx.fill();

  // Roof/windshield
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  const roofX = direction > 0 ? x - w * 0.05 : x - w * 0.3;
  ctx.beginPath();
  ctx.roundRect(roofX, y - h * 0.35, w * 0.4, h * 0.7, h * 0.15);
  ctx.fill();

  // Headlights
  ctx.fillStyle = '#ffffff';
  const hlX = direction > 0 ? x + w / 2 - 3 : x - w / 2;
  ctx.shadowColor = '#ffffff';
  ctx.shadowBlur = 6;
  ctx.fillRect(hlX, y - h * 0.25, 3, h * 0.15);
  ctx.fillRect(hlX, y + h * 0.1, 3, h * 0.15);
  ctx.shadowBlur = 0;

  // Taillights
  ctx.fillStyle = '#EF4444';
  const tlX = direction > 0 ? x - w / 2 : x + w / 2 - 3;
  ctx.fillRect(tlX, y - h * 0.25, 3, h * 0.15);
  ctx.fillRect(tlX, y + h * 0.1, 3, h * 0.15);
}
