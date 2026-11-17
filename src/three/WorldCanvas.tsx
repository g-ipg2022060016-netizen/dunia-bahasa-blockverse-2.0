import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import {
  AvatarAnimState,
  AvatarConfig,
  BlockType,
  LearningStation,
  MusicZone,
  RemotePlayerState,
  VoxelBlock,
  WorldData,
  WorldNPC,
  WorldSign,
} from '../types/blockverse';
import {
  afterDraw,
  createStudioRenderer,
  detectSoftwareWebGL,
  setupRoomEnvironment,
} from './rendererUtils';
import { getBlockMaterial } from './textures';
import { animateAvatarRig, AvatarRig, buildVoxelAvatar } from './voxelAvatar';
import {
  AnimatedProp,
  buildMusicZoneBeacon,
  buildNPCGroup,
  buildSignpostGroup,
  buildStationBeacon,
  buildStructureGroup,
  buildTerrainAndSky,
  ColliderBox,
} from './worldBuilder';

export type NearbyTarget =
  | { kind: 'station'; station: LearningStation }
  | { kind: 'music'; musicZone: MusicZone }
  | { kind: 'npc'; npc: WorldNPC }
  | { kind: 'sign'; sign: WorldSign }
  | { kind: 'studio'; name: string }
  | { kind: 'clue'; station: LearningStation; clueText: string };

export interface TouchControlState {
  moveX: number; // -1..1
  moveY: number; // -1..1 (forward positive)
  jumpPressed: boolean;
  runActive: boolean;
}

export type CreatorToolType =
  | 'block'
  | 'erase'
  | 'rumah_kampung'
  | 'sekolah'
  | 'pondok_belajar'
  | 'pokok'
  | 'haiwan_kucing'
  | 'haiwan_rusa'
  | 'station'
  | 'music'
  | 'npc'
  | 'sign';

interface WorldCanvasProps {
  world: WorldData;
  playerAvatar: AvatarConfig;
  mode: 'menu' | 'play';
  cameraMode: 'third' | 'first';
  dayTimeMode: 'siang' | 'senja' | 'malam' | 'kitaran';
  manualAnimOverride: AvatarAnimState | null;
  remotePlayers: RemotePlayerState[];
  creatorActive: boolean;
  creatorTool: CreatorToolType;
  selectedBlockType: BlockType;
  selectedBlockTint?: string;
  touchControlsRef: React.MutableRefObject<TouchControlState>;
  onPlayerMove?: (pos: { x: number; y: number; z: number; yaw: number; animState: AvatarAnimState }) => void;
  onNearbyChange?: (target: NearbyTarget | null) => void;
  onInteractRequest?: (target: NearbyTarget) => void;
  onCreatorPlaceBlock?: (block: VoxelBlock) => void;
  onCreatorRemoveBlock?: (x: number, y: number, z: number) => void;
  onCreatorPlaceEntity?: (tool: CreatorToolType, pos: { x: number; y: number; z: number }) => void;
}

const _camTarget = new THREE.Vector3();
const _camDesired = new THREE.Vector3();
const _forward = new THREE.Vector3();
const _right = new THREE.Vector3();
const _mouseNdc = new THREE.Vector2();
const _raycaster = new THREE.Raycaster();

export const WorldCanvas: React.FC<WorldCanvasProps> = ({
  world,
  playerAvatar,
  mode,
  cameraMode,
  dayTimeMode,
  manualAnimOverride,
  remotePlayers,
  creatorActive,
  creatorTool,
  selectedBlockType,
  selectedBlockTint,
  touchControlsRef,
  onPlayerMove,
  onNearbyChange,
  onInteractRequest,
  onCreatorPlaceBlock,
  onCreatorRemoveBlock,
  onCreatorPlaceEntity,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);

  // Latest props in refs so WebGL scene never unmounts on React state changes
  const propsRef = useRef({
    mode,
    cameraMode,
    dayTimeMode,
    manualAnimOverride,
    creatorActive,
    creatorTool,
    selectedBlockType,
    selectedBlockTint,
    onPlayerMove,
    onNearbyChange,
    onInteractRequest,
    onCreatorPlaceBlock,
    onCreatorRemoveBlock,
    onCreatorPlaceEntity,
  });
  propsRef.current = {
    mode,
    cameraMode,
    dayTimeMode,
    manualAnimOverride,
    creatorActive,
    creatorTool,
    selectedBlockType,
    selectedBlockTint,
    onPlayerMove,
    onNearbyChange,
    onInteractRequest,
    onCreatorPlaceBlock,
    onCreatorRemoveBlock,
    onCreatorPlaceEntity,
  };

  const worldRef = useRef(world);
  worldRef.current = world;

  const avatarRef = useRef(playerAvatar);
  avatarRef.current = playerAvatar;

  const remotePlayersRef = useRef(remotePlayers);
  remotePlayersRef.current = remotePlayers;

  // Dynamic scene sub-refs for hot-swapping blocks/structures/avatar without recreating renderer
  const sceneObjectsRef = useRef<{
    scene: THREE.Scene;
    maxAnisotropy: number;
    dynamicGroup: THREE.Group;
    blocksGroup: THREE.Group;
    blockMeshes: THREE.Mesh[];
    colliders: ColliderBox[];
    animatedProps: AnimatedProp[];
    stars: THREE.Points | null;
    sunLight: THREE.DirectionalLight | null;
    hemiLight: THREE.HemisphereLight | null;
    playerRig: AvatarRig | null;
    remoteRigs: Map<string, { rig: AvatarRig; targetX: number; targetY: number; targetZ: number; targetYaw: number; animState: AvatarAnimState; sig: string }>;
    ghostBox: THREE.Mesh | null;
  }>({
    scene: new THREE.Scene(),
    maxAnisotropy: 4,
    dynamicGroup: new THREE.Group(),
    blocksGroup: new THREE.Group(),
    blockMeshes: [],
    colliders: [],
    animatedProps: [],
    stars: null,
    sunLight: null,
    hemiLight: null,
    playerRig: null,
    remoteRigs: new Map(),
    ghostBox: null,
  });

  const playerPhysicsRef = useRef({
    x: 0,
    y: 0,
    z: 6,
    vy: 0,
    yaw: Math.PI, // facing north (-Z)
    camYaw: 0,
    camPitch: 0.35,
    grounded: true,
    lastEmit: 0,
    lastNearbyKey: '',
  });

  // Helper to rebuild world structures/NPCs/stations/blocks when world data changes
  const rebuildWorldContents = (w: WorldData) => {
    const store = sceneObjectsRef.current;
    store.dynamicGroup.clear();
    store.blocksGroup.clear();
    store.blockMeshes = [];
    store.colliders = [];
    store.animatedProps = [];

    const { clouds, stars } = buildTerrainAndSky(
      store.dynamicGroup as unknown as THREE.Scene,
      w.worldType,
      propsRef.current.dayTimeMode,
      store.maxAnisotropy
    );
    store.stars = stars;
    store.animatedProps.push(...clouds);

    // Structures
    w.structures.forEach((s, idx) => {
      const built = buildStructureGroup(s, store.maxAnisotropy);
      store.dynamicGroup.add(built.group);
      store.colliders.push(...built.colliders);
      if (built.isTree) {
        store.animatedProps.push({
          group: built.group,
          kind: 'tree',
          originX: s.x,
          originY: s.y,
          originZ: s.z,
          phase: idx * 1.1,
        });
      } else if (built.isAnimal) {
        store.animatedProps.push({
          group: built.group,
          kind: 'animal',
          originX: s.x,
          originY: s.y,
          originZ: s.z,
          patrolRadius: 3.5,
          phase: idx * 1.7,
        });
      }
    });

    // NPCs
    w.npcs.forEach((npc, idx) => {
      const npcGroup = buildNPCGroup(npc);
      store.dynamicGroup.add(npcGroup);
      store.animatedProps.push({
        group: npcGroup,
        kind: 'npc',
        originX: npc.x,
        originY: npc.y,
        originZ: npc.z,
        patrolRadius: npc.patrolRadius || 2,
        phase: idx * 1.4,
      });
    });

    // Signs
    w.signs.forEach((sign) => {
      store.dynamicGroup.add(buildSignpostGroup(sign, store.maxAnisotropy));
    });

    // Learning Station Beacons
    w.stations.forEach((st) => {
      const beacon = buildStationBeacon(st.title, st.category);
      beacon.position.set(st.x, st.y, st.z);
      store.dynamicGroup.add(beacon);
      const crystal = beacon.getObjectByName('beacon_crystal');
      if (crystal) {
        store.animatedProps.push({
          group: crystal,
          kind: 'crystal',
          originX: 0,
          originY: 1.1,
          originZ: 0,
          phase: st.x * 0.4,
        });
      }
      if (st.hiddenCluePos) {
        const clueMesh = new THREE.Mesh(
          new THREE.OctahedronGeometry(0.28, 0),
          new THREE.MeshStandardMaterial({
            color: '#22d3ee',
            emissive: '#06b6d4',
            emissiveIntensity: 0.7,
          })
        );
        clueMesh.position.set(st.hiddenCluePos.x, st.hiddenCluePos.y + 0.7, st.hiddenCluePos.z);
        store.dynamicGroup.add(clueMesh);
        store.animatedProps.push({
          group: clueMesh,
          kind: 'crystal',
          originX: st.hiddenCluePos.x,
          originY: st.hiddenCluePos.y + 0.7,
          originZ: st.hiddenCluePos.z,
          phase: 1.9,
        });
      }
    });

    // Music Zones
    w.musicZones.forEach((mz) => {
      const mzGroup = buildMusicZoneBeacon(mz.title);
      mzGroup.position.set(mz.x, mz.y, mz.z);
      store.dynamicGroup.add(mzGroup);
      const crystal = mzGroup.getObjectByName('music_crystal');
      if (crystal) {
        store.animatedProps.push({
          group: crystal,
          kind: 'crystal',
          originX: 0,
          originY: 1.4,
          originZ: 0,
          phase: 2.3,
        });
      }
    });

    // Placed Voxel Blocks
    const unitGeo = new THREE.BoxGeometry(1, 1, 1);
    w.blocks.forEach((b) => {
      const mat = getBlockMaterial(b.type, b.tint, store.maxAnisotropy);
      const mesh = new THREE.Mesh(unitGeo, mat);
      mesh.position.set(b.x, b.y + 0.5, b.z);
      mesh.castShadow = b.type !== 'water';
      mesh.receiveShadow = true;
      mesh.userData = { block: b };
      store.blocksGroup.add(mesh);
      store.blockMeshes.push(mesh);
      if (b.type !== 'water' && b.type !== 'flower_red' && b.type !== 'flower_yellow') {
        store.colliders.push({
          minX: b.x - 0.5,
          maxX: b.x + 0.5,
          minY: b.y,
          maxY: b.y + 1,
          minZ: b.z - 0.5,
          maxZ: b.z + 0.5,
        });
      }
    });
  };

  // Mount Three.js scene ONCE
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const isSoftwareGl = detectSoftwareWebGL();
    const renderer = createStudioRenderer(isSoftwareGl);
    renderer.setSize(container.clientWidth || 1280, container.clientHeight || 720);
    container.appendChild(renderer.domElement);

    const store = sceneObjectsRef.current;
    store.maxAnisotropy = renderer.capabilities.getMaxAnisotropy();
    const scene = store.scene;
    scene.background = new THREE.Color('#7dd3fc');
    scene.fog = new THREE.FogExp2('#bae6fd', 0.011);

    const envTex = setupRoomEnvironment(renderer, scene);

    const camera = new THREE.PerspectiveCamera(
      62,
      (container.clientWidth || 1280) / (container.clientHeight || 720),
      0.1,
      220
    );

    // 3-point outdoor studio lighting
    const hemiLight = new THREE.HemisphereLight('#bae6fd', '#3f6212', 0.72);
    scene.add(hemiLight);
    store.hemiLight = hemiLight;

    const sunLight = new THREE.DirectionalLight('#fffbeb', 1.45);
    sunLight.position.set(28, 42, 22);
    sunLight.castShadow = !isSoftwareGl;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 2;
    sunLight.shadow.camera.far = 120;
    const d = 36;
    sunLight.shadow.camera.left = -d;
    sunLight.shadow.camera.right = d;
    sunLight.shadow.camera.top = d;
    sunLight.shadow.camera.bottom = -d;
    sunLight.shadow.bias = -0.0005;
    sunLight.shadow.normalBias = 0.02;
    scene.add(sunLight);
    store.sunLight = sunLight;

    const rimLight = new THREE.DirectionalLight('#93c5fd', 0.45);
    rimLight.position.set(-24, 18, -28);
    scene.add(rimLight);

    scene.add(store.dynamicGroup);
    scene.add(store.blocksGroup);

    // Creator Ghost Preview Box
    const ghostBox = new THREE.Mesh(
      new THREE.BoxGeometry(1.02, 1.02, 1.02),
      new THREE.MeshBasicMaterial({
        color: '#facc15',
        wireframe: true,
        transparent: true,
        opacity: 0.85,
      })
    );
    ghostBox.visible = false;
    scene.add(ghostBox);
    store.ghostBox = ghostBox;

    // Player Avatar Rig
    const playerRig = buildVoxelAvatar(avatarRef.current);
    scene.add(playerRig.root);
    store.playerRig = playerRig;

    rebuildWorldContents(worldRef.current);

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // Input handling
    const keys: Record<string, boolean> = {};
    let isDraggingLook = false;
    let pointerDownPos = { x: 0, y: 0 };
    let lastPointer = { x: 0, y: 0 };
    let lastTouchLookId: number | null = null;
    let lastNearbyCheck: NearbyTarget | null = null;

    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) {
        return;
      }
      keys[e.code] = true;
      if (e.code === 'KeyE' && propsRef.current.mode === 'play' && lastNearbyCheck) {
        propsRef.current.onInteractRequest?.(lastNearbyCheck);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      keys[e.code] = false;
    };

    const canvasEl = renderer.domElement;
    const onPointerDown = (e: PointerEvent) => {
      if (propsRef.current.mode !== 'play') return;
      isDraggingLook = true;
      pointerDownPos = { x: e.clientX, y: e.clientY };
      lastPointer = { x: e.clientX, y: e.clientY };
    };

    const onPointerMove = (e: PointerEvent) => {
      const rect = canvasEl.getBoundingClientRect();
      _mouseNdc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      _mouseNdc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      if (isDraggingLook && propsRef.current.mode === 'play') {
        const dx = e.clientX - lastPointer.x;
        const dy = e.clientY - lastPointer.y;
        lastPointer = { x: e.clientX, y: e.clientY };
        playerPhysicsRef.current.camYaw -= dx * 0.0055;
        playerPhysicsRef.current.camPitch = THREE.MathUtils.clamp(
          playerPhysicsRef.current.camPitch + dy * 0.0045,
          -0.25,
          1.15
        );
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      if (!isDraggingLook) return;
      isDraggingLook = false;
      const movedDist = Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y);
      if (movedDist < 6 && propsRef.current.mode === 'play' && propsRef.current.creatorActive) {
        // Creator click action
        const rect = canvasEl.getBoundingClientRect();
        _mouseNdc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        _mouseNdc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        _raycaster.setFromCamera(_mouseNdc, camera);

        const groundObj = store.dynamicGroup.getObjectByName('ground_plane');
        const targets: THREE.Object3D[] = [...store.blockMeshes];
        if (groundObj) targets.push(groundObj);

        const hits = _raycaster.intersectObjects(targets, false);
        if (hits.length > 0) {
          const hit = hits[0];
          const tool = propsRef.current.creatorTool;
          if (e.button === 2 || tool === 'erase') {
            if (hit.object.userData?.block) {
              const b = hit.object.userData.block as VoxelBlock;
              propsRef.current.onCreatorRemoveBlock?.(b.x, b.y, b.z);
            }
          } else if (tool === 'block') {
            const normal = hit.face?.normal || new THREE.Vector3(0, 1, 0);
            const pt = hit.point.clone().addScaledVector(normal, 0.45);
            const gx = Math.round(pt.x);
            const gy = Math.max(0, Math.floor(pt.y));
            const gz = Math.round(pt.z);
            propsRef.current.onCreatorPlaceBlock?.({
              id: `blk_${gx}_${gy}_${gz}`,
              x: gx,
              y: gy,
              z: gz,
              type: propsRef.current.selectedBlockType,
              ...(propsRef.current.selectedBlockTint ? { tint: propsRef.current.selectedBlockTint } : {}),
            });
          } else {
            propsRef.current.onCreatorPlaceEntity?.(tool, {
              x: Math.round(hit.point.x),
              y: Math.max(0, Math.round(hit.point.y)),
              z: Math.round(hit.point.z),
            });
          }
        }
      }
    };

    const onContextMenu = (e: MouseEvent) => {
      if (propsRef.current.creatorActive) e.preventDefault();
    };

    const onTouchStart = (e: TouchEvent) => {
      if (propsRef.current.mode !== 'play') return;
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        if (t.clientX > window.innerWidth * 0.35 && lastTouchLookId === null) {
          lastTouchLookId = t.identifier;
          lastPointer = { x: t.clientX, y: t.clientY };
        }
      }
    };
    const onTouchMove = (e: TouchEvent) => {
      if (lastTouchLookId === null) return;
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        if (t.identifier === lastTouchLookId) {
          const dx = t.clientX - lastPointer.x;
          const dy = t.clientY - lastPointer.y;
          lastPointer = { x: t.clientX, y: t.clientY };
          playerPhysicsRef.current.camYaw -= dx * 0.006;
          playerPhysicsRef.current.camPitch = THREE.MathUtils.clamp(
            playerPhysicsRef.current.camPitch + dy * 0.005,
            -0.25,
            1.15
          );
        }
      }
    };
    const onTouchEnd = (e: TouchEvent) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === lastTouchLookId) {
          lastTouchLookId = null;
        }
      }
    };

    const onResize = () => {
      if (!container) return;
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    const onContextLost = (e: Event) => {
      e.preventDefault();
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('resize', onResize);
    canvasEl.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    canvasEl.addEventListener('contextmenu', onContextMenu);
    canvasEl.addEventListener('touchstart', onTouchStart, { passive: true });
    canvasEl.addEventListener('touchmove', onTouchMove, { passive: true });
    canvasEl.addEventListener('touchend', onTouchEnd);
    canvasEl.addEventListener('webglcontextlost', onContextLost);

    const clock = new THREE.Clock();
    let frameId = 0;
    let disposed = false;

    const registerTimer = (id: number) => {
      frameId = id;
    };

    const updateAtmosphere = (elapsed: number) => {
      const modeVal = propsRef.current.dayTimeMode;
      let skyHex = '#7dd3fc';
      let fogHex = '#bae6fd';
      let sunInt = 1.45;
      let hemiInt = 0.72;
      let starOpacity = 0;

      if (modeVal === 'senja') {
        skyHex = '#fb923c';
        fogHex = '#fdba74';
        sunInt = 1.05;
        hemiInt = 0.55;
        starOpacity = 0.25;
      } else if (modeVal === 'malam') {
        skyHex = '#0f172a';
        fogHex = '#1e293b';
        sunInt = 0.45;
        hemiInt = 0.35;
        starOpacity = 0.95;
      } else if (modeVal === 'kitaran') {
        const cycle = (Math.sin(elapsed * 0.08) + 1) * 0.5;
        if (cycle < 0.3) {
          skyHex = '#0f172a';
          fogHex = '#1e293b';
          sunInt = 0.5;
          starOpacity = 0.9;
        } else if (cycle < 0.55) {
          skyHex = '#fdba74';
          fogHex = '#fed7aa';
          sunInt = 1.0;
          starOpacity = 0.2;
        }
      }

      if (scene.background instanceof THREE.Color) {
        scene.background.set(skyHex);
      }
      if (scene.fog instanceof THREE.FogExp2) {
        scene.fog.color.set(fogHex);
      }
      if (store.sunLight) store.sunLight.intensity = sunInt;
      if (store.hemiLight) store.hemiLight.intensity = hemiInt;
      if (store.stars && store.stars.material instanceof THREE.PointsMaterial) {
        store.stars.material.opacity = starOpacity;
      }
    };

    const tick = () => {
      if (disposed) return;
      const delta = Math.min(clock.getDelta(), 0.08);
      const elapsed = clock.getElapsedTime();

      updateAtmosphere(elapsed);

      // Animate environment props (clouds, swaying trees, roaming animals, NPCs, crystals)
      for (const prop of store.animatedProps) {
        if (prop.kind === 'cloud') {
          prop.group.position.x = ((prop.originX + elapsed * 0.45 + 45) % 90) - 45;
        } else if (prop.kind === 'tree') {
          prop.group.rotation.z = Math.sin(elapsed * 1.4 + prop.phase) * 0.028;
        } else if (prop.kind === 'crystal') {
          prop.group.rotation.y = elapsed * 1.4 + prop.phase;
          prop.group.position.y = prop.originY + Math.sin(elapsed * 2.5 + prop.phase) * 0.14;
        } else if (prop.kind === 'animal') {
          const r = prop.patrolRadius || 3;
          const nx = prop.originX + Math.cos(elapsed * 0.45 + prop.phase) * r;
          const nz = prop.originZ + Math.sin(elapsed * 0.45 + prop.phase) * r;
          prop.group.rotation.y = Math.atan2(nx - prop.group.position.x, nz - prop.group.position.z);
          prop.group.position.x = nx;
          prop.group.position.z = nz;
        } else if (prop.kind === 'npc') {
          const r = prop.patrolRadius || 2;
          const nx = prop.originX + Math.sin(elapsed * 0.35 + prop.phase) * r;
          const nz = prop.originZ + Math.cos(elapsed * 0.25 + prop.phase) * (r * 0.5);
          prop.group.rotation.y = Math.atan2(nx - prop.group.position.x, nz - prop.group.position.z);
          prop.group.position.x = nx;
          prop.group.position.z = nz;
        }
      }

      const phys = playerPhysicsRef.current;

      if (propsRef.current.mode === 'menu') {
        // Living menu showcase: avatar walks cheerfully along kampung road while camera orbits gently
        const walkX = Math.sin(elapsed * 0.35) * 6;
        const walkZ = 0.5 + Math.cos(elapsed * 0.35) * 2.5;
        if (store.playerRig) {
          store.playerRig.root.visible = true;
          store.playerRig.root.position.set(walkX, 0, walkZ);
          store.playerRig.root.rotation.y = elapsed * 0.35 + Math.PI / 2;
          animateAvatarRig(store.playerRig, 'walk', elapsed);
        }
        const orbitAngle = elapsed * 0.14;
        camera.position.set(
          Math.sin(orbitAngle) * 18,
          8.5 + Math.sin(elapsed * 0.2) * 1.2,
          Math.cos(orbitAngle) * 18
        );
        camera.lookAt(4, 2, -2);
      } else {
        // Playable 3D movement & collision
        const tc = touchControlsRef.current;
        const moveForwardInput =
          (keys['KeyW'] || keys['ArrowUp'] ? 1 : 0) -
          (keys['KeyS'] || keys['ArrowDown'] ? 1 : 0) +
          tc.moveY;
        const moveRightInput =
          (keys['KeyD'] || keys['ArrowRight'] ? 1 : 0) -
          (keys['KeyA'] || keys['ArrowLeft'] ? 1 : 0) +
          tc.moveX;
        const isRunning = Boolean(keys['ShiftLeft'] || keys['ShiftRight'] || tc.runActive);
        const speed = isRunning ? 9.2 : 5.4;

        _forward.set(-Math.sin(phys.camYaw), 0, -Math.cos(phys.camYaw)).normalize();
        _right.set(Math.cos(phys.camYaw), 0, -Math.sin(phys.camYaw)).normalize();

        const vx = (_forward.x * moveForwardInput + _right.x * moveRightInput);
        const vz = (_forward.z * moveForwardInput + _right.z * moveRightInput);
        const mag = Math.hypot(vx, vz);

        let nextX = phys.x;
        let nextZ = phys.z;
        let moving = false;

        if (mag > 0.05) {
          moving = true;
          const nx = (vx / Math.max(1, mag)) * speed * delta;
          const nz = (vz / Math.max(1, mag)) * speed * delta;
          const candidateX = THREE.MathUtils.clamp(phys.x + nx, -38, 38);
          const candidateZ = THREE.MathUtils.clamp(phys.z + nz, -38, 38);

          const hitsWall = (tx: number, tz: number) => {
            for (const c of store.colliders) {
              if (
                tx + 0.35 > c.minX &&
                tx - 0.35 < c.maxX &&
                tz + 0.35 > c.minZ &&
                tz - 0.35 < c.maxZ &&
                phys.y + 0.4 < c.maxY &&
                phys.y + 1.8 > c.minY
              ) {
                return true;
              }
            }
            return false;
          };

          if (!hitsWall(candidateX, phys.z)) nextX = candidateX;
          if (!hitsWall(nextX, candidateZ)) nextZ = candidateZ;
          phys.x = nextX;
          phys.z = nextZ;
          phys.yaw = Math.atan2(vx, vz);
        }

        // Jump & Gravity
        if ((keys['Space'] || tc.jumpPressed) && phys.grounded) {
          phys.vy = 7.6;
          phys.grounded = false;
          tc.jumpPressed = false;
        }
        phys.vy -= 19.5 * delta;
        phys.y += phys.vy * delta;

        // Ground & block top collision
        let supportY = 0;
        for (const c of store.colliders) {
          if (
            phys.x + 0.3 > c.minX &&
            phys.x - 0.3 < c.maxX &&
            phys.z + 0.3 > c.minZ &&
            phys.z - 0.3 < c.maxZ &&
            phys.y >= c.maxY - 0.45
          ) {
            supportY = Math.max(supportY, c.maxY);
          }
        }
        if (phys.y <= supportY) {
          phys.y = supportY;
          phys.vy = 0;
          phys.grounded = true;
        }

        let activeAnim: AvatarAnimState = 'idle';
        if (!phys.grounded) activeAnim = 'jump';
        else if (moving) activeAnim = isRunning ? 'run' : 'walk';
        else if (propsRef.current.manualAnimOverride) activeAnim = propsRef.current.manualAnimOverride;

        if (store.playerRig) {
          store.playerRig.root.visible = propsRef.current.cameraMode === 'third';
          store.playerRig.root.position.set(phys.x, phys.y, phys.z);
          store.playerRig.root.rotation.y = phys.yaw;
          animateAvatarRig(store.playerRig, activeAnim, elapsed);
        }

        // Smooth camera positioning (1st person vs 3rd person)
        if (propsRef.current.cameraMode === 'first') {
          _camDesired.set(phys.x, phys.y + 1.65, phys.z);
          camera.position.set(
            THREE.MathUtils.damp(camera.position.x, _camDesired.x, 18, delta),
            THREE.MathUtils.damp(camera.position.y, _camDesired.y, 18, delta),
            THREE.MathUtils.damp(camera.position.z, _camDesired.z, 18, delta)
          );
          _camTarget.set(
            phys.x - Math.sin(phys.camYaw) * 6,
            phys.y + 1.65 - Math.sin(phys.camPitch) * 4,
            phys.z - Math.cos(phys.camYaw) * 6
          );
          camera.lookAt(_camTarget);
        } else {
          const dist = 6.2;
          const horiz = Math.cos(phys.camPitch) * dist;
          const vert = 2.2 + Math.sin(phys.camPitch) * dist;
          _camDesired.set(
            phys.x + Math.sin(phys.camYaw) * horiz,
            Math.max(0.8, phys.y + vert),
            phys.z + Math.cos(phys.camYaw) * horiz
          );
          camera.position.set(
            THREE.MathUtils.damp(camera.position.x, _camDesired.x, 12, delta),
            THREE.MathUtils.damp(camera.position.y, _camDesired.y, 12, delta),
            THREE.MathUtils.damp(camera.position.z, _camDesired.z, 12, delta)
          );
          _camTarget.set(phys.x, phys.y + 1.4, phys.z);
          camera.lookAt(_camTarget);
        }

        // Creator Mode ghost box update
        if (store.ghostBox) {
          if (propsRef.current.creatorActive) {
            _raycaster.setFromCamera(_mouseNdc, camera);
            const groundObj = store.dynamicGroup.getObjectByName('ground_plane');
            const targets: THREE.Object3D[] = [...store.blockMeshes];
            if (groundObj) targets.push(groundObj);
            const hits = _raycaster.intersectObjects(targets, false);
            if (hits.length > 0) {
              const hit = hits[0];
              const normal = hit.face?.normal || new THREE.Vector3(0, 1, 0);
              const pt =
                propsRef.current.creatorTool === 'erase'
                  ? hit.point.clone().addScaledVector(normal, -0.3)
                  : hit.point.clone().addScaledVector(normal, 0.45);
              store.ghostBox.visible = true;
              store.ghostBox.position.set(
                Math.round(pt.x),
                Math.max(0, Math.floor(pt.y)) + 0.5,
                Math.round(pt.z)
              );
              if (store.ghostBox.material instanceof THREE.MeshBasicMaterial) {
                store.ghostBox.material.color.set(
                  propsRef.current.creatorTool === 'erase' ? '#ef4444' : '#facc15'
                );
              }
            } else {
              store.ghostBox.visible = false;
            }
          } else {
            store.ghostBox.visible = false;
          }
        }

        // Sync remote multiplayer avatars
        const currentRemotes = remotePlayersRef.current;
        const activeIds = new Set(currentRemotes.map((r) => r.playerId));
        for (const [id, entry] of store.remoteRigs.entries()) {
          if (!activeIds.has(id)) {
            scene.remove(entry.rig.root);
            store.remoteRigs.delete(id);
          }
        }
        for (const rp of currentRemotes) {
          const sig = JSON.stringify(rp.avatar);
          let entry = store.remoteRigs.get(rp.playerId);
          if (!entry || entry.sig !== sig) {
            if (entry) scene.remove(entry.rig.root);
            const rig = buildVoxelAvatar(rp.avatar, rp.emoteText);
            rig.root.position.set(rp.x, rp.y, rp.z);
            scene.add(rig.root);
            entry = {
              rig,
              targetX: rp.x,
              targetY: rp.y,
              targetZ: rp.z,
              targetYaw: rp.yaw,
              animState: rp.animState,
              sig,
            };
            store.remoteRigs.set(rp.playerId, entry);
          } else {
            entry.targetX = rp.x;
            entry.targetY = rp.y;
            entry.targetZ = rp.z;
            entry.targetYaw = rp.yaw;
            entry.animState = rp.animState;
          }

          entry.rig.root.position.x = THREE.MathUtils.damp(entry.rig.root.position.x, entry.targetX, 12, delta);
          entry.rig.root.position.y = THREE.MathUtils.damp(entry.rig.root.position.y, entry.targetY, 12, delta);
          entry.rig.root.position.z = THREE.MathUtils.damp(entry.rig.root.position.z, entry.targetZ, 12, delta);
          entry.rig.root.rotation.y = entry.targetYaw;
          animateAvatarRig(entry.rig, entry.animState, elapsed);
        }

        // Emit state throttled (~10Hz) for multiplayer sync
        if (elapsed - phys.lastEmit > 0.1) {
          phys.lastEmit = elapsed;
          propsRef.current.onPlayerMove?.({
            x: Number(phys.x.toFixed(2)),
            y: Number(phys.y.toFixed(2)),
            z: Number(phys.z.toFixed(2)),
            yaw: Number(phys.yaw.toFixed(2)),
            animState: activeAnim,
          });
        }

        // Proximity interactive target check
        const w = worldRef.current;
        let foundTarget: NearbyTarget | null = null;
        let bestDist = 3.8;

        for (const st of w.stations) {
          const dist = Math.hypot(phys.x - st.x, phys.z - st.z);
          if (dist < bestDist) {
            bestDist = dist;
            foundTarget = { kind: 'station', station: st };
          }
          if (st.hiddenCluePos) {
            const cDist = Math.hypot(phys.x - st.hiddenCluePos.x, phys.z - st.hiddenCluePos.z);
            if (cDist < 2.8) {
              bestDist = cDist;
              foundTarget = { kind: 'clue', station: st, clueText: st.hiddenCluePos.clueText };
            }
          }
        }
        for (const mz of w.musicZones) {
          const dist = Math.hypot(phys.x - mz.x, phys.z - mz.z);
          if (dist < mz.radius) {
            foundTarget = { kind: 'music', musicZone: mz };
          }
        }
        for (const s of w.structures) {
          if (s.kind === 'studio_avatar') {
            const dist = Math.hypot(phys.x - s.x, phys.z - s.z);
            if (dist < 4.5) {
              foundTarget = { kind: 'studio', name: s.name };
            }
          }
        }
        for (const npc of w.npcs) {
          const dist = Math.hypot(phys.x - npc.x, phys.z - npc.z);
          if (dist < 3.4) {
            foundTarget = { kind: 'npc', npc };
          }
        }
        for (const sign of w.signs) {
          const dist = Math.hypot(phys.x - sign.x, phys.z - sign.z);
          if (dist < 2.8) {
            foundTarget = { kind: 'sign', sign };
          }
        }

        const nearbyKey = foundTarget
          ? foundTarget.kind +
            '_' +
            (foundTarget.kind === 'station'
              ? foundTarget.station.id
              : foundTarget.kind === 'music'
              ? foundTarget.musicZone.id
              : foundTarget.kind === 'npc'
              ? foundTarget.npc.id
              : foundTarget.kind === 'sign'
              ? foundTarget.sign.id
              : foundTarget.kind)
          : '';
        if (nearbyKey !== phys.lastNearbyKey) {
          phys.lastNearbyKey = nearbyKey;
          lastNearbyCheck = foundTarget;
          propsRef.current.onNearbyChange?.(foundTarget);
        } else {
          lastNearbyCheck = foundTarget;
        }
      }

      renderer.render(scene, camera);

      if (isSoftwareGl) {
        afterDraw(renderer, tick, registerTimer);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    };

    tick();

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('resize', onResize);
      canvasEl.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      canvasEl.removeEventListener('contextmenu', onContextMenu);
      canvasEl.removeEventListener('touchstart', onTouchStart);
      canvasEl.removeEventListener('touchmove', onTouchMove);
      canvasEl.removeEventListener('touchend', onTouchEnd);
      canvasEl.removeEventListener('webglcontextlost', onContextLost);
      envTex.dispose();
      renderer.dispose();
      if (canvasEl.parentNode === container) {
        container.removeChild(canvasEl);
      }
    };
  }, []);

  // Hot-swap world geometry when world updates (e.g., Creator edits, live sync, world switch)
  useEffect(() => {
    rebuildWorldContents(world);
    playerPhysicsRef.current.x = 0;
    playerPhysicsRef.current.z = 6;
    playerPhysicsRef.current.y = 0;
  }, [world.id]);

  // Hot-swap blocks/structures/stations in-place without resetting player position
  useEffect(() => {
    rebuildWorldContents(world);
  }, [world.version, world.blocks, world.structures, world.stations, world.musicZones, world.npcs, world.signs]);

  // Hot-swap local player's 3D avatar mesh whenever customized
  useEffect(() => {
    const store = sceneObjectsRef.current;
    if (store.playerRig) {
      store.scene.remove(store.playerRig.root);
    }
    const nextRig = buildVoxelAvatar(playerAvatar);
    store.scene.add(nextRig.root);
    store.playerRig = nextRig;
  }, [playerAvatar]);

  return <div ref={mountRef} className="w-full h-full relative overflow-hidden" />;
};
