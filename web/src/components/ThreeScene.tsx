import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

type Phase =
  | 'GREEN_A'
  | 'GREEN_B'
  | 'ALL_RED_A_to_B'
  | 'ALL_RED_B_to_A'
  | 'EMERGENCY'
  | 'MANUAL';

interface Props {
  phase: Phase | null;
  queueA: number;
  queueB: number;
  vehiclesInZone: string[];
}

interface TrafficLightHandles {
  group: THREE.Group;
  redLightMat: THREE.MeshBasicMaterial;
  greenLightMat: THREE.MeshBasicMaterial;
  redAura: THREE.Sprite;
  greenAura: THREE.Sprite;
}

interface CarHandle {
  group: THREE.Group;
  body: THREE.Mesh;
  wireframe: THREE.LineSegments;
  beam: THREE.Mesh;
}

interface ZoneCarHandle extends CarHandle {
  id: string;
  speed: number;
  direction: number;
}

const ROAD_LENGTH = 120;
const CAR_SPACING = 5;
const QUEUE_START_A = -14;
const QUEUE_START_B = 14;
const ZONE_X_MIN = -10;
const ZONE_X_MAX = 10;

function generateGlowTexture(color: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  const r = (color >> 16) & 255;
  const g = (color >> 8) & 255;
  const b = color & 255;
  const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.2, `rgba(${r}, ${g}, ${b}, 0.8)`);
  gradient.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 64);
  return canvas;
}

function createTrafficLight(xPos: number): TrafficLightHandles {
  const group = new THREE.Group();

  const poleMat = new THREE.MeshStandardMaterial({
    color: 0x2f3034,
    metalness: 0.8,
    roughness: 0.2,
  });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 6), poleMat);
  pole.position.y = 3;

  const boxMat = new THREE.MeshStandardMaterial({ color: 0x111316 });
  const box = new THREE.Mesh(new THREE.BoxGeometry(1.2, 3, 1.2), boxMat);
  box.position.y = 6;

  const redLightMat = new THREE.MeshBasicMaterial({ color: 0x330000 });
  const redLight = new THREE.Mesh(new THREE.CircleGeometry(0.35, 32), redLightMat);
  redLight.position.set(0, 6.8, 0.61);

  const greenLightMat = new THREE.MeshBasicMaterial({ color: 0x003300 });
  const greenLight = new THREE.Mesh(new THREE.CircleGeometry(0.35, 32), greenLightMat);
  greenLight.position.set(0, 5.2, 0.61);

  const redAuraMat = new THREE.SpriteMaterial({
    map: new THREE.CanvasTexture(generateGlowTexture(0xff0000)),
    color: 0xff0000,
    transparent: true,
    opacity: 0.8,
    blending: THREE.AdditiveBlending,
  });
  const redAura = new THREE.Sprite(redAuraMat);
  redAura.scale.set(3, 3, 1);
  redAura.position.set(0, 6.8, 0.7);
  redAura.visible = false;

  const greenAuraMat = new THREE.SpriteMaterial({
    map: new THREE.CanvasTexture(generateGlowTexture(0x00ff00)),
    color: 0x00ff00,
    transparent: true,
    opacity: 0.8,
    blending: THREE.AdditiveBlending,
  });
  const greenAura = new THREE.Sprite(greenAuraMat);
  greenAura.scale.set(3, 3, 1);
  greenAura.position.set(0, 5.2, 0.7);
  greenAura.visible = false;

  group.add(pole, box, redLight, greenLight, redAura, greenAura);
  group.position.set(xPos, 0, -7);
  group.rotation.y = -Math.PI / 8;

  return { group, redLightMat, greenLightMat, redAura, greenAura };
}

function setLightState(light: TrafficLightHandles, state: 'red' | 'green' | 'off') {
  if (state === 'red') {
    light.redLightMat.color.setHex(0xff0000);
    light.greenLightMat.color.setHex(0x003300);
    light.redAura.visible = true;
    light.greenAura.visible = false;
  } else if (state === 'green') {
    light.redLightMat.color.setHex(0x330000);
    light.greenLightMat.color.setHex(0x00ff00);
    light.redAura.visible = false;
    light.greenAura.visible = true;
  } else {
    light.redLightMat.color.setHex(0x330000);
    light.greenLightMat.color.setHex(0x003300);
    light.redAura.visible = false;
    light.greenAura.visible = false;
  }
}

function phaseToLights(phase: Phase | null): { a: 'red' | 'green' | 'off'; b: 'red' | 'green' | 'off' } {
  switch (phase) {
    case 'GREEN_A':
      return { a: 'green', b: 'red' };
    case 'GREEN_B':
      return { a: 'red', b: 'green' };
    case 'ALL_RED_A_to_B':
    case 'ALL_RED_B_to_A':
    case 'EMERGENCY':
    case 'MANUAL':
      return { a: 'red', b: 'red' };
    default:
      return { a: 'red', b: 'red' };
  }
}

function createCar(carGeo: THREE.BoxGeometry, edgesGeo: THREE.EdgesGeometry, beamGeo: THREE.ConeGeometry): CarHandle {
  const group = new THREE.Group();

  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0x0c0e11,
    roughness: 0.1,
    metalness: 0.9,
    transparent: true,
    opacity: 0.9,
  });
  const body = new THREE.Mesh(carGeo, bodyMat);

  const wireframeMat = new THREE.LineBasicMaterial({
    color: 0x26fedc,
    transparent: true,
    opacity: 0.8,
  });
  const wireframe = new THREE.LineSegments(edgesGeo, wireframeMat);

  const hlMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const hl1 = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.2), hlMat);
  hl1.position.set(-1.26, 0, 0.4);
  hl1.rotation.y = -Math.PI / 2;
  const hl2 = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.2), hlMat);
  hl2.position.set(-1.26, 0, -0.4);
  hl2.rotation.y = -Math.PI / 2;

  const beamMat = new THREE.MeshBasicMaterial({
    color: 0xadc7ff,
    transparent: true,
    opacity: 0.05,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
  const beam = new THREE.Mesh(beamGeo, beamMat);

  group.add(body, wireframe, hl1, hl2, beam);
  return { group, body, wireframe, beam };
}

function disposeCar(car: CarHandle, scene: THREE.Scene) {
  scene.remove(car.group);
  (car.body.material as THREE.Material).dispose();
  (car.wireframe.material as THREE.Material).dispose();
  (car.beam.material as THREE.Material).dispose();
  car.group.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      if (obj.geometry && obj.geometry !== car.body.geometry && obj.geometry !== car.beam.geometry) {
        obj.geometry.dispose();
      }
      if (obj.material && obj.material !== car.body.material && obj.material !== car.beam.material) {
        const mat = obj.material as THREE.Material | THREE.Material[];
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
        else mat.dispose();
      }
    }
  });
}

export function ThreeScene({ phase, queueA, queueB, vehiclesInZone }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const phaseRef = useRef<Phase | null>(phase);
  const lightARef = useRef<TrafficLightHandles | null>(null);
  const lightBRef = useRef<TrafficLightHandles | null>(null);
  const queueCarsARef = useRef<CarHandle[]>([]);
  const queueCarsBRef = useRef<CarHandle[]>([]);
  const zoneCarsRef = useRef<Map<string, ZoneCarHandle>>(new Map());
  const carGeoRef = useRef<THREE.BoxGeometry | null>(null);
  const carEdgesGeoRef = useRef<THREE.EdgesGeometry | null>(null);
  const carBeamGeoRef = useRef<THREE.ConeGeometry | null>(null);
  const repairZoneMatRef = useRef<THREE.LineBasicMaterial | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#0d1117');
    scene.fog = new THREE.FogExp2('#0d1117', 0.008);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(
      45,
      container.clientWidth / container.clientHeight || 1,
      0.1,
      1000,
    );
    camera.position.set(-25, 15, 25);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.8;
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.3;

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const mainLight = new THREE.DirectionalLight(0xadc7ff, 1.2);
    mainLight.position.set(-20, 30, 20);
    scene.add(mainLight);

    const accentLight = new THREE.PointLight(0x26fedc, 2, 60);
    accentLight.position.set(0, 5, 5);
    scene.add(accentLight);

    const fillLight = new THREE.PointLight(0xadc7ff, 0.5, 80);
    fillLight.position.set(20, 10, -15);
    scene.add(fillLight);

    const gridHelper = new THREE.GridHelper(200, 100, 0x2a2d33, 0x1a1d21);
    gridHelper.position.y = -0.1;
    scene.add(gridHelper);

    const roadGeometry = new THREE.PlaneGeometry(ROAD_LENGTH, 12);
    const roadMaterial = new THREE.MeshStandardMaterial({
      color: '#2a2d33',
      roughness: 0.5,
      metalness: 0.2,
    });
    const road = new THREE.Mesh(roadGeometry, roadMaterial);
    road.rotation.x = -Math.PI / 2;
    scene.add(road);

    const lineGeometry = new THREE.PlaneGeometry(ROAD_LENGTH, 0.15);
    const lineMaterial = new THREE.MeshBasicMaterial({
      color: '#6b7280',
      transparent: true,
      opacity: 0.9,
    });
    const centerLine = new THREE.Mesh(lineGeometry, lineMaterial);
    centerLine.rotation.x = -Math.PI / 2;
    centerLine.position.y = 0.02;
    scene.add(centerLine);

    const repairGroup = new THREE.Group();
    const repairZoneGeo = new THREE.BoxGeometry(20, 4, 12);
    const repairZoneEdges = new THREE.EdgesGeometry(repairZoneGeo);
    const repairZoneMat = new THREE.LineBasicMaterial({
      color: 0xf59e0b,
      transparent: true,
      opacity: 0.6,
    });
    const repairZone = new THREE.LineSegments(repairZoneEdges, repairZoneMat);
    repairZone.position.set(0, 2, 0);
    repairZoneMatRef.current = repairZoneMat;

    const floorGlowGeo = new THREE.PlaneGeometry(20, 12);
    const floorGlowMat = new THREE.MeshBasicMaterial({
      color: 0xf59e0b,
      transparent: true,
      opacity: 0.15,
      side: THREE.DoubleSide,
    });
    const floorGlow = new THREE.Mesh(floorGlowGeo, floorGlowMat);
    floorGlow.rotation.x = -Math.PI / 2;
    floorGlow.position.set(0, 0.03, 0);

    repairGroup.add(repairZone, floorGlow);
    scene.add(repairGroup);
    repairZoneGeo.dispose();

    const lightA = createTrafficLight(-25);
    const lightB = createTrafficLight(25);
    scene.add(lightA.group);
    scene.add(lightB.group);
    lightARef.current = lightA;
    lightBRef.current = lightB;

    const carGeo = new THREE.BoxGeometry(2.5, 0.8, 1.2);
    const edgesGeo = new THREE.EdgesGeometry(carGeo);
    const beamGeo = new THREE.ConeGeometry(2, 8, 16);
    beamGeo.rotateX(Math.PI / 2);
    beamGeo.rotateY(Math.PI / 2);
    beamGeo.translate(-4, 0, 0);
    carGeoRef.current = carGeo;
    carEdgesGeoRef.current = edgesGeo;
    carBeamGeoRef.current = beamGeo;

    // Ambient cars — always visible for visual effect
    const ambientCars: { group: THREE.Group; speed: number; baseSpeed: number; startX: number; endX: number; direction: number; stopX: number }[] = [];
    for (let i = 0; i < 6; i++) {
      const car = createCar(carGeo, edgesGeo, beamGeo);
      const goesRight = i % 2 === 0;
      const lane = goesRight ? 2 : -2;
      const startX = -50 + i * 18;
      car.group.position.set(startX, 0.4, lane);
      // Car model faces -X by default (headlights at -1.26x), so:
      // going right (+X) needs rotation PI to flip it
      // going left (-X) needs no rotation
      if (goesRight) car.group.rotation.y = Math.PI;
      scene.add(car.group);
      const baseSpeed = 0.05 + (i % 3) * 0.012;
      ambientCars.push({
        group: car.group,
        speed: baseSpeed,
        baseSpeed,
        startX: goesRight ? -55 : 55,
        endX: goesRight ? 55 : -55,
        direction: goesRight ? 1 : -1,
        stopX: goesRight ? -12 : 12,
      });
    }

    let running = true;
    let frameId = 0;
    let time = 0;
    function animate() {
      if (!running) return;
      frameId = requestAnimationFrame(animate);
      time += 0.01;

      controls.update();

      if (repairZoneMatRef.current) {
        repairZoneMatRef.current.opacity = 0.2 + Math.sin(time * 5) * 0.1;
      }

      // Animate cars in the zone (slowly drifting through)
      zoneCarsRef.current.forEach((car) => {
        car.group.position.x += car.speed * car.direction;
        if (car.direction > 0 && car.group.position.x > ZONE_X_MAX) {
          car.group.position.x = ZONE_X_MIN;
        } else if (car.direction < 0 && car.group.position.x < ZONE_X_MIN) {
          car.group.position.x = ZONE_X_MAX;
        }
      });

      // Animate ambient cars (react to traffic lights)
      const currentPhase = phaseRef.current;
      const lights = phaseToLights(currentPhase);
      ambientCars.forEach((car) => {
        const isGreen = car.direction > 0 ? lights.a === 'green' : lights.b === 'green';
        const pos = car.group.position.x;
        const approachingZone = car.direction > 0
          ? (pos >= car.stopX - 3 && pos <= car.stopX + 1)
          : (pos <= car.stopX + 3 && pos >= car.stopX - 1);

        if (!isGreen && approachingZone) {
          car.speed = Math.max(0, car.speed - 0.003);
        } else {
          car.speed = Math.min(car.baseSpeed, car.speed + 0.002);
        }

        car.group.position.x += car.speed * car.direction;

        if (car.direction > 0 && car.group.position.x > car.endX) {
          car.group.position.x = car.startX;
        } else if (car.direction < 0 && car.group.position.x < car.endX) {
          car.group.position.x = car.startX;
        }
      });

      renderer.render(scene, camera);
    }
    animate();

    const resizeObserver = new ResizeObserver(() => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w === 0 || h === 0) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    });
    resizeObserver.observe(container);

    return () => {
      running = false;
      cancelAnimationFrame(frameId);
      resizeObserver.disconnect();

      // Dispose queued cars
      queueCarsARef.current.forEach((car) => disposeCar(car, scene));
      queueCarsBRef.current.forEach((car) => disposeCar(car, scene));
      zoneCarsRef.current.forEach((car) => disposeCar(car, scene));
      queueCarsARef.current = [];
      queueCarsBRef.current = [];
      zoneCarsRef.current.clear();

      // Dispose shared geometries
      carGeo.dispose();
      edgesGeo.dispose();
      beamGeo.dispose();
      roadGeometry.dispose();
      roadMaterial.dispose();
      lineGeometry.dispose();
      lineMaterial.dispose();
      repairZoneEdges.dispose();
      repairZoneMat.dispose();
      floorGlowGeo.dispose();
      floorGlowMat.dispose();
      gridHelper.geometry.dispose();
      (gridHelper.material as THREE.Material).dispose();

      // Dispose traffic lights
      [lightA, lightB].forEach((light) => {
        light.group.traverse((obj) => {
          if (obj instanceof THREE.Mesh) {
            obj.geometry.dispose();
            const mat = obj.material as THREE.Material | THREE.Material[];
            if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
            else mat.dispose();
          }
        });
        if (light.redAura.material.map) light.redAura.material.map.dispose();
        if (light.greenAura.material.map) light.greenAura.material.map.dispose();
        light.redAura.material.dispose();
        light.greenAura.material.dispose();
      });

      controls.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
      sceneRef.current = null;
    };
  }, []);

  // Update phase -> traffic lights
  useEffect(() => {
    phaseRef.current = phase;
    if (!lightARef.current || !lightBRef.current) return;
    const { a, b } = phaseToLights(phase);
    setLightState(lightARef.current, a);
    setLightState(lightBRef.current, b);
  }, [phase]);

  // Update queue A cars
  useEffect(() => {
    const scene = sceneRef.current;
    const carGeo = carGeoRef.current;
    const edgesGeo = carEdgesGeoRef.current;
    const beamGeo = carBeamGeoRef.current;
    if (!scene || !carGeo || !edgesGeo || !beamGeo) return;

    const visibleCount = Math.min(queueA, 12);
    const cars = queueCarsARef.current;

    while (cars.length < visibleCount) {
      const car = createCar(carGeo, edgesGeo, beamGeo);
      const idx = cars.length;
      car.group.position.set(QUEUE_START_A - idx * CAR_SPACING - CAR_SPACING, 0.4, 2);
      car.group.rotation.y = Math.PI; // faces right (+X)
      scene.add(car.group);
      cars.push(car);
    }
    while (cars.length > visibleCount) {
      const car = cars.pop();
      if (car) disposeCar(car, scene);
    }
  }, [queueA]);

  // Update queue B cars
  useEffect(() => {
    const scene = sceneRef.current;
    const carGeo = carGeoRef.current;
    const edgesGeo = carEdgesGeoRef.current;
    const beamGeo = carBeamGeoRef.current;
    if (!scene || !carGeo || !edgesGeo || !beamGeo) return;

    const visibleCount = Math.min(queueB, 12);
    const cars = queueCarsBRef.current;

    while (cars.length < visibleCount) {
      const car = createCar(carGeo, edgesGeo, beamGeo);
      const idx = cars.length;
      car.group.position.set(QUEUE_START_B + idx * CAR_SPACING + CAR_SPACING, 0.4, -2);
      // faces left (-X), no rotation needed
      scene.add(car.group);
      cars.push(car);
    }
    while (cars.length > visibleCount) {
      const car = cars.pop();
      if (car) disposeCar(car, scene);
    }
  }, [queueB]);

  // Update vehicles in zone
  useEffect(() => {
    const scene = sceneRef.current;
    const carGeo = carGeoRef.current;
    const edgesGeo = carEdgesGeoRef.current;
    const beamGeo = carBeamGeoRef.current;
    if (!scene || !carGeo || !edgesGeo || !beamGeo) return;

    const present = new Set(vehiclesInZone);
    const tracked = zoneCarsRef.current;

    // Remove cars no longer in zone
    tracked.forEach((car, id) => {
      if (!present.has(id)) {
        disposeCar(car, scene);
        tracked.delete(id);
      }
    });

    // Add new cars
    vehiclesInZone.forEach((id, idx) => {
      if (tracked.has(id)) return;
      const handle = createCar(carGeo, edgesGeo, beamGeo);
      const direction = idx % 2 === 0 ? 1 : -1;
      const startX = direction > 0 ? ZONE_X_MIN : ZONE_X_MAX;
      const lane = direction > 0 ? 2 : -2;
      handle.group.position.set(startX, 0.4, lane);
      if (direction > 0) handle.group.rotation.y = Math.PI;
      scene.add(handle.group);
      tracked.set(id, {
        ...handle,
        id,
        speed: 0.03 + Math.random() * 0.02,
        direction,
      });
    });
  }, [vehiclesInZone]);

  return (
    <div
      ref={containerRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        zIndex: 0,
      }}
    />
  );
}
