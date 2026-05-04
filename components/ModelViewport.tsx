
import { useRef, useEffect, useState, useMemo, memo } from 'react';
import React from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { SpatialConfig, PartCMF } from '../types';

interface ModelViewportProps {
  url: string;
  viewAngle?: 'front' | 'top' | 'side' | 'perspective' | string;
  cameraMode?: 'perspective' | 'orthographic';
  explodeFactor?: number;
  knollingFactor?: number;
  activePartId?: string;
  highlightedPartIds?: string[];
  hiddenPartIds?: string[];
  colorSeed?: number;
  partColorMap?: Record<string, string>;
  partCMFMap?: Record<string, PartCMF>;
  wireframeMode?: boolean;
  showExplodeTrails?: boolean;
  onPartSelect?: (partId: string) => void;
  onPartHUD?: (partId: string, screenPos: { x: number, y: number }) => void;
  onProjectedPoints?: (points: { id: string, name: string, x: number, y: number, z: number }[]) => void;
  onCameraChange?: (spatial: SpatialConfig) => void;
  onLoadParts?: (parts: string[]) => void;
  width: number;
  height: number;
  spatialConfig?: SpatialConfig;
}

const lerpAngle = (start: number, end: number, alpha: number) => {
  return start + (Math.atan2(Math.sin(end - start), Math.cos(end - start)) * alpha);
};

const ModelViewport: React.FC<ModelViewportProps> = memo(({ 
  url, viewAngle = 'perspective', cameraMode, explodeFactor = 0, knollingFactor = 0, activePartId, highlightedPartIds = [], hiddenPartIds = [], colorSeed = 0, 
  partColorMap = {}, partCMFMap = {}, wireframeMode = false, showExplodeTrails = false,
  onPartSelect, onPartHUD, onProjectedPoints, onCameraChange, onLoadParts, width, height, spatialConfig
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  
  const perspectiveCameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const orthoCameraRef = useRef<THREE.OrthographicCamera | null>(null);
  const activeCameraRef = useRef<THREE.Camera | null>(null);

  const groupRef = useRef<THREE.Group | null>(null);
  const lineArtGroupRef = useRef<THREE.Group | null>(null);
  const trailsGroupRef = useRef<THREE.Group | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const modelBoxRef = useRef<THREE.Box3>(new THREE.Box3());

  const initialPositions = useRef<Map<string, THREE.Vector3>>(new Map());
  const relativeExplodeVectors = useRef<Map<string, THREE.Vector3>>(new Map());
  const knollingPositions = useRef<Map<string, THREE.Vector3>>(new Map());
  const partMaterials = useRef<Map<string, THREE.MeshStandardMaterial>>(new Map());

  const isDraggingRef = useRef<boolean>(false);
  const isInterpolatingRef = useRef(false);
  const targetSpatialRef = useRef<SpatialConfig | null>(null);

  const raycaster = useMemo(() => new THREE.Raycaster(), []);

  const hashString = (str: string, seed: number = 0) => {
    let hash = seed ^ 0xdeadbeef;
    for (let i = 0; i < str.length; i++) {
      hash = Math.imul(hash ^ str.charCodeAt(i), 2654435761);
    }
    return hash ^ (hash >>> 16);
  };

  // Initialize and load
  useEffect(() => {
    if (!containerRef.current) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf4f4f5);
    sceneRef.current = scene;

    const trailsGroup = new THREE.Group();
    scene.add(trailsGroup);
    trailsGroupRef.current = trailsGroup;

    const lineArtGroup = new THREE.Group();
    scene.add(lineArtGroup);
    lineArtGroupRef.current = lineArtGroup;

    const aspect = width / height;
    const pCamera = new THREE.PerspectiveCamera(45, aspect, 0.1, 5000);
    perspectiveCameraRef.current = pCamera;

    const oCamera = new THREE.OrthographicCamera(-10 * aspect, 10 * aspect, 10, -10, 0.1, 5000);
    orthoCameraRef.current = oCamera;

    const renderer = new THREE.WebGLRenderer({ 
        antialias: true, 
        alpha: true,
        preserveDrawingBuffer: true 
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 1.2);
    keyLight.position.set(10, 20, 15);
    keyLight.castShadow = true;
    scene.add(keyLight);

    const loader = new OBJLoader();
    loader.load(url, (obj) => {
      const group = obj;
      groupRef.current = group;
      scene.add(group);

      const box = new THREE.Box3().setFromObject(group);
      modelBoxRef.current = box;
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      
      group.position.sub(center);

      const parts: string[] = [];
      const meshData: { id: string, name: string, center: THREE.Vector3, mesh: THREE.Mesh, radius: number, volume: number }[] = [];

      group.traverse((child) => {
        if ((child as any).isMesh) {
          const mesh = child as THREE.Mesh;
          const meshBox = new THREE.Box3().setFromObject(mesh);
          const meshCenter = meshBox.getCenter(new THREE.Vector3());
          const meshSize = meshBox.getSize(new THREE.Vector3());
          const partId = mesh.name || mesh.uuid;
          parts.push(partId);
          meshData.push({ 
            id: mesh.uuid, 
            name: partId, 
            center: meshCenter, 
            mesh, 
            radius: Math.max(meshSize.x, meshSize.y, meshSize.z),
            volume: meshSize.x * meshSize.y * meshSize.z
          });

          const edges = new THREE.EdgesGeometry(mesh.geometry, 15);
          const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x0c0c0e, linewidth: 2 }));
          line.name = `lineart_${partId}`;
          lineArtGroup.add(line);
        }
      });

      onLoadParts?.(parts);

      // --- INDUSTRIAL EXPLOSION RECONSTRUCTION ---
      // 1. Calculate and Sort by distance from center (Assembly Sequence)
      meshData.sort((a, b) => a.center.distanceTo(center) - b.center.distanceTo(center));
      
      const totalVolume = meshData.reduce((acc, curr) => acc + curr.volume, 0);

      meshData.forEach(({ id, name, center: partWorldCenter, mesh, volume }, rank) => {
        const material = new THREE.MeshStandardMaterial({ 
            metalness: 0.3, 
            roughness: 0.4, 
            emissive: new THREE.Color(0x000000),
            color: new THREE.Color(0xcccccc)
        });
        mesh.material = material;
        partMaterials.current.set(name, material);
        initialPositions.current.set(mesh.uuid, mesh.position.clone());
        
        // 2. Manhattan Axial Locking: Find dominant axis for translation
        const rawVec = partWorldCenter.clone().sub(center);
        const absX = Math.abs(rawVec.x);
        const absY = Math.abs(rawVec.y);
        const absZ = Math.abs(rawVec.z);
        
        let lockedVec = new THREE.Vector3();
        if (absX >= absY && absX >= absZ) {
            lockedVec.set(rawVec.x >= 0 ? 1 : -1, 0, 0);
        } else if (absY >= absX && absY >= absZ) {
            lockedVec.set(0, rawVec.y >= 0 ? 1 : -1, 0);
        } else {
            lockedVec.set(0, 0, rawVec.z >= 0 ? 1 : -1);
        }

        // 3. Noise reduction for "shrapnel"
        // Give small parts (noise) a dampening factor so they don't fly too far
        const volumeFactor = Math.min(1.0, (volume / totalVolume) * 50); 
        
        // 4. Progressive Tiered Displacement (The "Accordion" Effect)
        // Displace based on rank in the sorted list to ensure layers are visible
        const displacementScale = 1.0 + (rank / meshData.length) * 2.0;
        const finalVec = lockedVec.multiplyScalar(displacementScale * volumeFactor);
        
        relativeExplodeVectors.current.set(mesh.uuid, finalVec);
      });

      // Knolling layout
      const cols = Math.ceil(Math.sqrt(meshData.length));
      const spacing = Math.max(size.x, size.y, size.z) * 1.5;
      meshData.sort((a, b) => b.radius - a.radius).forEach(({ id, mesh }, idx) => {
        const r = Math.floor(idx / cols);
        const c = idx % cols;
        const gridPos = new THREE.Vector3((c - (cols - 1) / 2) * spacing, -size.y / 2, (r - (cols - 1) / 2) * spacing);
        knollingPositions.current.set(mesh.uuid, gridPos);
      });

      const maxDim = Math.max(size.x, size.y, size.z);
      const viewDistance = maxDim * 2.5;
      const orthoScale = maxDim * 1.2;
      oCamera.left = -orthoScale * aspect; oCamera.right = orthoScale * aspect;
      oCamera.top = orthoScale; oCamera.bottom = -orthoScale;
      oCamera.updateProjectionMatrix();

      const useOrtho = cameraMode === 'orthographic' || (viewAngle && ['top', 'front', 'side', 'bottom', 'left', 'right', 'iso_fr', 'iso_fl', 'iso_br', 'iso_bl'].includes(viewAngle));
      const camera = useOrtho ? oCamera : pCamera;
      activeCameraRef.current = camera;

      if (spatialConfig) {
          const phi = (90 - spatialConfig.elevation) * (Math.PI / 180);
          const theta = (spatialConfig.azimuth) * (Math.PI / 180);
          camera.position.setFromSphericalCoords(spatialConfig.distance || viewDistance, phi, theta);
      } else {
          camera.position.set(viewDistance * 0.7, viewDistance * 0.7, viewDistance * 0.7);
      }
      camera.lookAt(0, 0, 0);

      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.15;
      controls.target.set(0, 0, 0);
      controls.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.PAN, RIGHT: null as any };
      
      controls.addEventListener('start', () => { 
          isDraggingRef.current = true; 
          isInterpolatingRef.current = false; 
      });
      
      controls.addEventListener('end', () => { 
          isDraggingRef.current = false; 
      });

      controls.addEventListener('change', () => {
          if (!activeCameraRef.current || !onCameraChange || isInterpolatingRef.current) return;
          if (!isDraggingRef.current) return;

          const cam = activeCameraRef.current;
          const spherical = new THREE.Spherical().setFromVector3(cam.position);
          let rawAzi = (spherical.theta * 180 / Math.PI) % 360;
          const azimuth = rawAzi < 0 ? rawAzi + 360 : rawAzi;
          const elevation = 90 - (spherical.phi * 180 / Math.PI);
          onCameraChange({ azimuth, elevation, distance: spherical.radius, fov: (cam as any).fov || 45 });
      });
      controlsRef.current = controls;

      applyCMF();
    });

    const handleMouseClick = (event: MouseEvent) => {
        if (!containerRef.current || !activeCameraRef.current || !groupRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const mouse = new THREE.Vector2();
        mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(mouse, activeCameraRef.current);
        const intersects = raycaster.intersectObjects(groupRef.current.children, true);
        if (intersects.length > 0) { 
            const clickedMesh = intersects[0].object as THREE.Mesh;
            const pid = clickedMesh.name || clickedMesh.uuid;
            onPartSelect?.(pid);
            const point = intersects[0].point;
            const vector = point.clone().project(activeCameraRef.current);
            const x = (vector.x + 1) * width / 2;
            const y = (-vector.y + 1) * height / 2;
            onPartHUD?.(pid, { x, y });
        } else { onPartSelect?.(''); onPartHUD?.('', { x: 0, y: 0 }); }
    };

    const container = containerRef.current;
    container.addEventListener('click', handleMouseClick);

    let frameId: number;
    let lastProjectionUpdate = 0;

    const animate = (time: number) => {
      frameId = requestAnimationFrame(animate);
      
      if (isInterpolatingRef.current && targetSpatialRef.current && activeCameraRef.current && controlsRef.current) {
          const cam = activeCameraRef.current;
          const currentSpherical = new THREE.Spherical().setFromVector3(cam.position);
          const targetPhi = (90 - targetSpatialRef.current.elevation) * (Math.PI / 180);
          const targetTheta = (targetSpatialRef.current.azimuth) * (Math.PI / 180);
          const targetDist = targetSpatialRef.current.distance;

          currentSpherical.phi = THREE.MathUtils.lerp(currentSpherical.phi, targetPhi, 0.1);
          currentSpherical.theta = lerpAngle(currentSpherical.theta, targetTheta, 0.1);
          currentSpherical.radius = THREE.MathUtils.lerp(currentSpherical.radius, targetDist, 0.1);

          cam.position.setFromSphericalCoords(currentSpherical.radius, currentSpherical.phi, currentSpherical.theta);
          cam.lookAt(0, 0, 0);
          
          if (Math.abs(currentSpherical.phi - targetPhi) < 0.001 && Math.abs(currentSpherical.theta - targetTheta) < 0.001 && Math.abs(currentSpherical.radius - targetDist) < 0.01) {
              isInterpolatingRef.current = false;
          }
      }

      if (controlsRef.current) controlsRef.current.update();
      
      const pulse = (Math.sin(time * 0.005) + 1) * 0.25;
      partMaterials.current.forEach((mat, partId) => {
          if (highlightedPartIds.includes(partId)) {
            mat.emissive.set(0x4f46e5); 
            mat.emissiveIntensity = 0.4 + pulse;
          } else if (partId !== activePartId) {
            mat.emissiveIntensity = 0;
          }
      });

      if (onProjectedPoints && groupRef.current && activeCameraRef.current && time - lastProjectionUpdate > 16) {
        const projections: any[] = [];
        groupRef.current.traverse(child => {
            if ((child as THREE.Mesh).isMesh) {
                const mesh = child as THREE.Mesh;
                if (mesh.visible) {
                    const worldPos = new THREE.Vector3();
                    mesh.getWorldPosition(worldPos);
                    const vector = worldPos.project(activeCameraRef.current!);
                    if (vector.z < 1.0) {
                        projections.push({ id: mesh.uuid, name: mesh.name || mesh.uuid, x: (vector.x + 1) * width / 2, y: (-vector.y + 1) * height / 2, z: vector.z });
                    }
                }
            }
        });
        onProjectedPoints(projections);
        lastProjectionUpdate = time;
      }

      if (rendererRef.current && sceneRef.current && activeCameraRef.current) {
        rendererRef.current.render(sceneRef.current, activeCameraRef.current);
      }
    };
    animate(0);

    return () => {
      cancelAnimationFrame(frameId);
      container.removeEventListener('click', handleMouseClick);
      renderer.dispose();
      initialPositions.current.clear();
      relativeExplodeVectors.current.clear();
      knollingPositions.current.clear();
      partMaterials.current.clear();
      if (renderer.domElement && container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
    };
  }, [url, width, height]);

  // Sync camera mode & dimensions
  useEffect(() => {
    if (!activeCameraRef.current || !controlsRef.current || !modelBoxRef.current || !rendererRef.current) return;
    
    rendererRef.current.setSize(width, height);
    
    const size = modelBoxRef.current.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const aspect = width / height;
    const useOrtho = cameraMode === 'orthographic' || (viewAngle && ['top', 'front', 'side', 'bottom', 'left', 'right', 'iso_fr', 'iso_fl', 'iso_br', 'iso_bl'].includes(viewAngle));
    
    const targetCamera = useOrtho ? orthoCameraRef.current : perspectiveCameraRef.current;
    if (targetCamera && targetCamera !== activeCameraRef.current) {
        targetCamera.position.copy(activeCameraRef.current.position);
        targetCamera.quaternion.copy(activeCameraRef.current.quaternion);
        if (useOrtho && orthoCameraRef.current) {
            const orthoScale = maxDim * 1.2;
            orthoCameraRef.current.left = -orthoScale * aspect; orthoCameraRef.current.right = orthoScale * aspect;
            orthoCameraRef.current.top = orthoScale; orthoCameraRef.current.bottom = -orthoScale;
            orthoCameraRef.current.updateProjectionMatrix();
        } else if (perspectiveCameraRef.current) {
            perspectiveCameraRef.current.aspect = aspect;
            perspectiveCameraRef.current.updateProjectionMatrix();
        }
        activeCameraRef.current = targetCamera;
        controlsRef.current.object = targetCamera;
    } else if (targetCamera) {
        if (useOrtho && orthoCameraRef.current) {
            const orthoScale = maxDim * 1.2;
            orthoCameraRef.current.left = -orthoScale * aspect; 
            orthoCameraRef.current.right = orthoScale * aspect;
            orthoCameraRef.current.updateProjectionMatrix();
        } else if (perspectiveCameraRef.current) {
            perspectiveCameraRef.current.aspect = aspect;
            perspectiveCameraRef.current.updateProjectionMatrix();
        }
    }
    controlsRef.current.update();
  }, [cameraMode, viewAngle, width, height]);

  // Handle external spatialConfig updates with anti-snapback logic
  useEffect(() => {
    if (spatialConfig && activeCameraRef.current && controlsRef.current) {
        if (isDraggingRef.current) return;

        const cam = activeCameraRef.current;
        const currentSpherical = new THREE.Spherical().setFromVector3(cam.position);
        
        const diffAzi = Math.abs(currentSpherical.theta * 180 / Math.PI - spatialConfig.azimuth);
        const diffEle = Math.abs(90 - (currentSpherical.phi * 180 / Math.PI) - spatialConfig.elevation);
        
        if (diffAzi > 2.0 || diffEle > 2.0) {
            targetSpatialRef.current = spatialConfig;
            isInterpolatingRef.current = true;
        } else {
            if (!isInterpolatingRef.current) {
                const phi = (90 - spatialConfig.elevation) * (Math.PI / 180);
                const theta = (spatialConfig.azimuth) * (Math.PI / 180);
                cam.position.setFromSphericalCoords(spatialConfig.distance || currentSpherical.radius, phi, theta);
                cam.lookAt(0, 0, 0);
                controlsRef.current.update();
            }
        }
    }
  }, [spatialConfig]);

  const applyCMF = () => {
    if (!sceneRef.current) return;
    sceneRef.current.background = new THREE.Color(wireframeMode ? 0xffffff : 0xf4f4f5);
    partMaterials.current.forEach((mat, partId) => {
      const cmf = partCMFMap[partId];
      if (wireframeMode) {
          mat.color.set(0xffffff); mat.emissive.set(0x000000); mat.metalness = 0; mat.roughness = 1; mat.opacity = 1; mat.transparent = false;
      } else {
          if (cmf) {
              if (cmf.color) mat.color.set(cmf.color);
              if (cmf.metalness !== undefined) mat.metalness = cmf.metalness;
              if (cmf.roughness !== undefined) mat.roughness = cmf.roughness;
              if (cmf.opacity !== undefined) { mat.transparent = cmf.opacity < 1; mat.opacity = cmf.opacity; }
          } else if (partColorMap[partId]) {
            mat.color.set(partColorMap[partId]);
          } else {
            const hash = hashString(partId, colorSeed);
            const hue = (Math.abs(hash) * 137.508) % 360;
            mat.color.setHSL(hue / 360, 0.65, 0.55); mat.metalness = 0.3; mat.roughness = 0.4;
          }
      }
      mat.needsUpdate = true;
    });
    if (lineArtGroupRef.current) lineArtGroupRef.current.visible = wireframeMode;
  };
  useEffect(() => { applyCMF(); }, [colorSeed, partColorMap, partCMFMap, wireframeMode]);

  useEffect(() => {
    if (!groupRef.current || !trailsGroupRef.current || !lineArtGroupRef.current) return;
    trailsGroupRef.current.clear();
    const trailMat = new THREE.LineBasicMaterial({ color: 0x6366f1, transparent: true, opacity: 0.4 });
    groupRef.current.traverse((child) => {
      if ((child as any).isMesh) {
        const mesh = child as THREE.Mesh;
        const initial = initialPositions.current.get(mesh.uuid);
        const relVec = relativeExplodeVectors.current.get(mesh.uuid);
        const kPos = knollingPositions.current.get(mesh.uuid);
        const pid = mesh.name || mesh.uuid;
        const isVisible = !hiddenPartIds.includes(pid);
        mesh.visible = isVisible;
        const line = lineArtGroupRef.current?.children.find(l => l.name === `lineart_${pid}`);
        if (line) line.visible = isVisible && wireframeMode;
        if (initial && relVec && kPos) {
          const size = modelBoxRef.current.getSize(new THREE.Vector3());
          const maxDim = Math.max(size.x, size.y, size.z);
          // INDUSTRIAL DISPLACEMENT:
          // Use relVec which now contains the axial lock AND the rank-based spacing factor
          const explodeOffset = relVec.clone().multiplyScalar(explodeFactor * maxDim * 1.5); 
          const assembledPos = initial.clone().add(explodeOffset);
          const currentPos = new THREE.Vector3().lerpVectors(assembledPos, kPos, knollingFactor);
          mesh.position.copy(currentPos);
          if (line) line.position.copy(currentPos);
          if (showExplodeTrails && explodeFactor > 0.05 && knollingFactor < 0.1 && isVisible) {
              const geometry = new THREE.BufferGeometry().setFromPoints([initial, currentPos]);
              const trailLine = new THREE.Line(geometry, trailMat);
              trailsGroupRef.current?.add(trailLine);
          }
        }
      }
    });
  }, [explodeFactor, knollingFactor, hiddenPartIds, showExplodeTrails, wireframeMode]);

  return (
    <div ref={containerRef} className="w-full h-full relative" style={{ touchAction: 'none' }} />
  );
}, (prev, next) => {
  return prev.url === next.url && 
         prev.viewAngle === next.viewAngle && 
         prev.cameraMode === next.cameraMode && 
         prev.explodeFactor === next.explodeFactor && 
         prev.knollingFactor === next.knollingFactor && 
         prev.activePartId === next.activePartId && 
         prev.wireframeMode === next.wireframeMode &&
         prev.showExplodeTrails === next.showExplodeTrails &&
         JSON.stringify(prev.highlightedPartIds) === JSON.stringify(next.highlightedPartIds) &&
         JSON.stringify(prev.hiddenPartIds) === JSON.stringify(next.hiddenPartIds) &&
         prev.colorSeed === next.colorSeed && 
         JSON.stringify(prev.partCMFMap) === JSON.stringify(next.partCMFMap) &&
         prev.width === next.width &&
         prev.height === next.height &&
         JSON.stringify(prev.spatialConfig) === JSON.stringify(next.spatialConfig);
});

export default ModelViewport;
