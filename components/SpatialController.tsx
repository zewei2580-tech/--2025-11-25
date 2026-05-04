
import React, { useRef, useEffect, useState, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { SpatialConfig } from '../types';
import { CameraIcon, MaximizeIcon, EyeIcon, LayoutGridIcon, FocusIcon } from './Icons';

interface SpatialControllerProps {
  config: SpatialConfig;
  onChange: (config: SpatialConfig) => void;
  imageSrc?: string;
}

const PRESETS = {
  azimuth: [
    { label: '正面', value: 0 },
    { label: '45°', value: 45 },
    { label: '侧面', value: 90 },
    { label: '背面', value: 180 },
  ],
  elevation: [
    { label: '俯拍', value: 89 },
    { label: '高位', value: 45 },
    { label: '平视', value: 0 },
    { label: '仰拍', value: -20 },
  ],
  distance: [
    { label: '特写', value: 4 },
    { label: '中景', value: 10 },
    { label: '远景', value: 18 },
  ]
};

// Helper for shortest path interpolation on angles (radians)
const lerpAngle = (start: number, end: number, alpha: number) => {
  return start + (Math.atan2(Math.sin(end - start), Math.cos(end - start)) * alpha);
};

const SpatialController: React.FC<SpatialControllerProps> = ({ config, onChange, imageSrc }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  
  const imagePlaneRef = useRef<THREE.Mesh | null>(null);
  const verticalRingGroupRef = useRef<THREE.Group | null>(null);
  const cameraGizmoGroupRef = useRef<THREE.Group | null>(null);
  
  // State for internal logic
  const isDraggingRef = useRef<boolean>(false);
  const isInterpolatingRef = useRef<boolean>(false);
  const targetConfigRef = useRef<SpatialConfig>(config);

  const RING_RADIUS = 5;

  useEffect(() => {
    if (!containerRef.current) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x020202);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(config.fov || 45, 1, 0.1, 1000);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientWidth);
    renderer.setPixelRatio(window.devicePixelRatio);
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Ground Plane for Orientation
    const groundGeom = new THREE.CircleGeometry(20, 64);
    const groundMat = new THREE.MeshBasicMaterial({ color: 0x111111, transparent: true, opacity: 0.2, side: THREE.DoubleSide });
    const ground = new THREE.Mesh(groundGeom, groundMat);
    ground.rotation.x = -Math.PI / 2;
    scene.add(ground);

    const grid = new THREE.GridHelper(20, 20, 0x333333, 0x1a1a1a);
    scene.add(grid);

    // Subject Proxy
    const imageGeom = new THREE.PlaneGeometry(3, 4);
    const imageMat = new THREE.MeshBasicMaterial({ color: 0x222222, side: THREE.DoubleSide, transparent: true, opacity: 0.9 });
    const imagePlane = new THREE.Mesh(imageGeom, imageMat);
    imagePlane.position.y = 2; // Half height
    scene.add(imagePlane);
    imagePlaneRef.current = imagePlane;

    // Orbital Rings
    const horizRingGeom = new THREE.TorusGeometry(RING_RADIUS, 0.02, 16, 100);
    const horizRingMat = new THREE.MeshBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.2 });
    const horizRing = new THREE.Mesh(horizRingGeom, horizRingMat);
    horizRing.rotation.x = Math.PI / 2;
    scene.add(horizRing);

    const vertRingGroup = new THREE.Group();
    scene.add(vertRingGroup);
    verticalRingGroupRef.current = vertRingGroup;

    const vertRingGeom = new THREE.TorusGeometry(RING_RADIUS, 0.02, 16, 100, Math.PI);
    const vertRingMat = new THREE.MeshBasicMaterial({ color: 0xff00ff, transparent: true, opacity: 0.2 });
    const vertRing = new THREE.Mesh(vertRingGeom, vertRingMat);
    vertRing.rotation.y = Math.PI / 2;
    vertRing.rotation.z = Math.PI / 2;
    vertRingGroup.add(vertRing);

    // Camera Gizmo
    const camGroup = new THREE.Group();
    scene.add(camGroup);
    cameraGizmoGroupRef.current = camGroup;

    const body = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.4, 0.8), new THREE.MeshBasicMaterial({ color: 0x444444 }));
    camGroup.add(body);
    
    const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.4, 16), new THREE.MeshBasicMaterial({ color: 0xffcc00 }));
    lens.rotation.x = Math.PI / 2;
    lens.position.z = -0.5;
    camGroup.add(lens);

    const lineMat = new THREE.LineBasicMaterial({ color: 0xffcc00, transparent: true, opacity: 0.3 });
    const linePoints = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -RING_RADIUS)];
    const lineGeom = new THREE.BufferGeometry().setFromPoints(linePoints);
    const targetLine = new THREE.Line(lineGeom, lineMat);
    camGroup.add(targetLine);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.15;
    controls.rotateSpeed = 0.5;
    controls.enablePan = false;
    controls.minDistance = 1;
    controls.maxDistance = 25;
    // Lock vertical rotation to avoid gimbal lock madness
    controls.minPolarAngle = 0.01;
    controls.maxPolarAngle = Math.PI - 0.01;
    
    controls.addEventListener('start', () => { isDraggingRef.current = true; isInterpolatingRef.current = false; });
    controls.addEventListener('end', () => { isDraggingRef.current = false; });
    
    controlsRef.current = controls;

    // Initial positioning
    const phi = (90 - config.elevation) * (Math.PI / 180);
    const theta = (config.azimuth) * (Math.PI / 180);
    camera.position.setFromSphericalCoords(config.distance || 12, phi, theta);
    controls.update();

    let frameId: number;
    const animate = () => {
      frameId = requestAnimationFrame(animate);
      
      if (isInterpolatingRef.current) {
        const currentSpherical = new THREE.Spherical().setFromVector3(camera.position);
        const targetPhi = (90 - targetConfigRef.current.elevation) * (Math.PI / 180);
        const targetTheta = (targetConfigRef.current.azimuth) * (Math.PI / 180);
        const targetDist = targetConfigRef.current.distance;

        // Optimized interpolation with shortest path logic
        currentSpherical.phi = THREE.MathUtils.lerp(currentSpherical.phi, targetPhi, 0.08);
        currentSpherical.theta = lerpAngle(currentSpherical.theta, targetTheta, 0.08);
        currentSpherical.radius = THREE.MathUtils.lerp(currentSpherical.radius, targetDist, 0.08);

        camera.position.setFromSphericalCoords(currentSpherical.radius, currentSpherical.phi, currentSpherical.theta);
        
        if (Math.abs(currentSpherical.phi - targetPhi) < 0.001 && 
            Math.abs(currentSpherical.theta - targetTheta) < 0.001 &&
            Math.abs(currentSpherical.radius - targetDist) < 0.01) {
          isInterpolatingRef.current = false;
        }
      }

      controls.update();
      
      const camPos = camera.position;
      const spherical = new THREE.Spherical().setFromVector3(camPos);
      
      // Update Gizmos
      if (cameraGizmoGroupRef.current) {
          cameraGizmoGroupRef.current.position.copy(camPos).normalize().multiplyScalar(RING_RADIUS);
          cameraGizmoGroupRef.current.lookAt(0, 2, 0); 
      }
      if (verticalRingGroupRef.current) {
          verticalRingGroupRef.current.rotation.y = spherical.theta;
      }

      // Sync FOV
      camera.fov = config.fov || 45;
      camera.updateProjectionMatrix();

      // Dispatch changes to React only when user is actually interacting
      if (isDraggingRef.current && !isInterpolatingRef.current) {
          const rawAzi = (spherical.theta * 180 / Math.PI) % 360;
          const newAzi = rawAzi < 0 ? rawAzi + 360 : rawAzi;
          const newEle = 90 - (spherical.phi * 180 / Math.PI);
          const newDist = spherical.radius;

          if (
            Math.abs(newAzi - config.azimuth) > 0.1 || 
            Math.abs(newEle - config.elevation) > 0.1 ||
            Math.abs(newDist - config.distance) > 0.1
          ) {
            onChange({ ...config, azimuth: newAzi, elevation: newEle, distance: newDist });
          }
      }

      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(frameId);
      renderer.dispose();
      if (containerRef.current && renderer.domElement) containerRef.current.removeChild(renderer.domElement);
    };
  }, []);

  useEffect(() => {
    if (imageSrc && imagePlaneRef.current) {
        new THREE.TextureLoader().load(imageSrc, (tex) => {
            if (imagePlaneRef.current) {
                const mat = imagePlaneRef.current.material as THREE.MeshBasicMaterial;
                mat.map = tex;
                mat.color.set(0xffffff);
                mat.opacity = 1;
                mat.needsUpdate = true;
            }
        });
    }
  }, [imageSrc]);

  const applyPreset = (type: 'azimuth' | 'elevation' | 'distance', value: number) => {
    targetConfigRef.current = { ...config, [type]: value };
    isInterpolatingRef.current = true;
    onChange(targetConfigRef.current);
  };

  const isAziActive = (val: number) => Math.abs(config.azimuth - val) < 3 || (val === 0 && Math.abs(config.azimuth - 360) < 3);
  const isEleActive = (val: number) => Math.abs(config.elevation - val) < 3;
  const isDistActive = (val: number) => Math.abs(config.distance - val) < 0.5;

  return (
    <div className="flex flex-col gap-6">
      <div className="relative group overflow-hidden rounded-[32px] border border-white/10 shadow-[0_32px_64px_rgba(0,0,0,0.6)] bg-black ring-1 ring-white/5">
          <div ref={containerRef} className="w-full aspect-square bg-[#050505]" />
          
          <div className="absolute top-4 left-4 flex flex-col gap-2 pointer-events-none">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-black/60 backdrop-blur-md rounded-xl border border-white/5">
                  <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_10px_cyan]" />
                  <span className="text-[10px] font-black font-mono text-cyan-400 tracking-tighter">AZI: {Math.round(config.azimuth)}°</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 bg-black/60 backdrop-blur-md rounded-xl border border-white/5">
                  <div className="w-1.5 h-1.5 rounded-full bg-pink-500 shadow-[0_0_10px_magenta]" />
                  <span className="text-[10px] font-black font-mono text-pink-400 tracking-tighter">ELE: {Math.round(config.elevation)}°</span>
              </div>
          </div>

          <div className="absolute bottom-4 right-4 pointer-events-none opacity-40">
               <LayoutGridIcon className="w-5 h-5 text-zinc-600" />
          </div>
      </div>

      <div className="space-y-6 px-1">
        {/* Azimuth Presets */}
        <div className="space-y-3">
            <div className="flex items-center gap-2 text-[10px] font-black text-zinc-500 uppercase tracking-widest">
                <CameraIcon className="w-3.5 h-3.5" /> 方位角 (AZIMUTH)
            </div>
            <div className="grid grid-cols-4 gap-2">
                {PRESETS.azimuth.map(p => (
                    <button 
                        key={p.label} 
                        onClick={() => applyPreset('azimuth', p.value)}
                        className={`py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border ${isAziActive(p.value) ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30 shadow-[0_0_15px_rgba(6,182,212,0.15)]' : 'bg-zinc-900 text-zinc-500 border-white/5 hover:border-white/10'}`}
                    >
                        {p.label}
                    </button>
                ))}
            </div>
        </div>

        {/* Elevation Presets */}
        <div className="space-y-3">
            <div className="flex items-center gap-2 text-[10px] font-black text-zinc-500 uppercase tracking-widest">
                <FocusIcon className="w-3.5 h-3.5" /> 仰角 (ELEVATION)
            </div>
            <div className="grid grid-cols-4 gap-2">
                {PRESETS.elevation.map(p => (
                    <button 
                        key={p.label} 
                        onClick={() => applyPreset('elevation', p.value)}
                        className={`py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border ${isEleActive(p.value) ? 'bg-pink-500/20 text-pink-400 border-pink-500/30 shadow-[0_0_15px_rgba(236,72,153,0.15)]' : 'bg-zinc-900 text-zinc-500 border-white/5 hover:border-white/10'}`}
                    >
                        {p.label}
                    </button>
                ))}
            </div>
        </div>

        {/* Distance Presets */}
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-[10px] font-black text-zinc-500 uppercase tracking-widest">
                    <MaximizeIcon className="w-3.5 h-3.5" /> 焦距/距离 (DISTANCE)
                </div>
                <span className="text-orange-400 font-mono text-[10px] font-black">{config.distance.toFixed(1)}m</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
                {PRESETS.distance.map(p => (
                    <button 
                        key={p.label} 
                        onClick={() => applyPreset('distance', p.value)}
                        className={`py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border ${isDistActive(p.value) ? 'bg-orange-500/20 text-orange-400 border-orange-500/30 shadow-[0_0_15px_rgba(249,115,22,0.15)]' : 'bg-zinc-900 text-zinc-500 border-white/5 hover:border-white/10'}`}
                    >
                        {p.label}
                    </button>
                ))}
            </div>
        </div>
      </div>
    </div>
  );
};

export default SpatialController;
