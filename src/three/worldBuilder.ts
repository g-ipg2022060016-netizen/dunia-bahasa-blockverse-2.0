import * as THREE from 'three';
import { getBlockMaterial } from './textures';
import { WorldNPC, WorldSign, WorldStructure, WorldTheme } from '../types/blockverse';

export interface ColliderBox {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
}

export interface AnimatedProp {
  group: THREE.Object3D;
  kind: 'tree' | 'animal' | 'cloud' | 'crystal' | 'npc';
  originX: number;
  originY: number;
  originZ: number;
  patrolRadius?: number;
  phase: number;
}

function makeLabelSprite(text: string, bgColor = 'rgba(15, 23, 42, 0.85)', textColor = '#ffffff') {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 112;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = bgColor;
  ctx.beginPath();
  ctx.roundRect(12, 12, 488, 88, 18);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.3)';
  ctx.lineWidth = 4;
  ctx.stroke();

  ctx.fillStyle = textColor;
  ctx.font = 'bold 34px Plus Jakarta Sans, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text.slice(0, 28), 256, 56);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false })
  );
  sprite.scale.set(3.2, 0.7, 1);
  return sprite;
}

export function buildTerrainAndSky(
  scene: THREE.Scene,
  theme: WorldTheme,
  dayMode: 'siang' | 'senja' | 'malam' | 'kitaran',
  maxAnisotropy: number
): { clouds: AnimatedProp[]; stars: THREE.Points } {
  const groundColor =
    theme === 'hutan' ? '#15803d' : theme === 'istana' ? '#86efac' : '#4ade80';

  // Main playable flat-to-rolling meadow + extended horizon terrain (never boxed into void)
  const grassMat = getBlockMaterial('grass', theme === 'hutan' ? '#86efac' : undefined, maxAnisotropy);
  const stoneMat = getBlockMaterial('stone', undefined, maxAnisotropy);
  const dirtMat = getBlockMaterial('dirt', undefined, maxAnisotropy);

  const floorMesh = new THREE.Mesh(new THREE.BoxGeometry(160, 1, 160), grassMat);
  floorMesh.position.set(0, -0.5, 0);
  floorMesh.receiveShadow = true;
  floorMesh.name = 'ground_plane';
  scene.add(floorMesh);

  // Outer rolling hills & mountains perimeter (using InstancedMesh for high FPS)
  const hillGeo = new THREE.BoxGeometry(4, 1, 4);
  const hillMatrices: THREE.Matrix4[] = [];
  const hillColors: THREE.Color[] = [];
  const dummy = new THREE.Object3D();

  for (let angle = 0; angle < Math.PI * 2; angle += 0.14) {
    const r = 42 + Math.sin(angle * 5) * 6;
    const x = Math.cos(angle) * r;
    const z = Math.sin(angle) * r;
    const h = 4 + Math.abs(Math.sin(angle * 3)) * 10;
    dummy.position.set(x, h / 2 - 0.5, z);
    dummy.scale.set(1.4, h, 1.4);
    dummy.rotation.y = angle;
    dummy.updateMatrix();
    hillMatrices.push(dummy.matrix.clone());
    hillColors.push(new THREE.Color(h > 9 ? '#64748b' : groundColor));
  }

  const hillInstanced = new THREE.InstancedMesh(hillGeo, stoneMat, hillMatrices.length);
  hillInstanced.receiveShadow = true;
  hillInstanced.castShadow = true;
  hillMatrices.forEach((m, i) => {
    hillInstanced.setMatrixAt(i, m);
    hillInstanced.setColorAt(i, hillColors[i]);
  });
  hillInstanced.computeBoundingSphere();
  scene.add(hillInstanced);

  // Distant soil mounds
  const mound = new THREE.Mesh(new THREE.BoxGeometry(14, 3, 12), dirtMat);
  mound.position.set(-28, 1.5, -26);
  mound.receiveShadow = true;
  scene.add(mound);

  // Voxel Clouds
  const clouds: AnimatedProp[] = [];
  const cloudMat = new THREE.MeshStandardMaterial({
    color: '#ffffff',
    roughness: 0.95,
    metalness: 0,
  });
  for (let i = 0; i < 10; i++) {
    const cg = new THREE.Group();
    const c1 = new THREE.Mesh(new THREE.BoxGeometry(5.5, 1.2, 3.2), cloudMat);
    const c2 = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.0, 2.2), cloudMat);
    c2.position.set(1.2, 0.8, 0.2);
    cg.add(c1, c2);
    const cx = -38 + i * 9;
    const cy = 19 + (i % 3) * 2.5;
    const cz = -30 + ((i * 17) % 50);
    cg.position.set(cx, cy, cz);
    scene.add(cg);
    clouds.push({
      group: cg,
      kind: 'cloud',
      originX: cx,
      originY: cy,
      originZ: cz,
      phase: i * 0.7,
    });
  }

  // Night Stars (visible when dusk/night)
  const starPositions = new Float32Array(300 * 3);
  for (let i = 0; i < 300; i++) {
    starPositions[i * 3] = (Math.random() - 0.5) * 140;
    starPositions[i * 3 + 1] = 22 + Math.random() * 40;
    starPositions[i * 3 + 2] = (Math.random() - 0.5) * 140;
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
  const starMat = new THREE.PointsMaterial({
    color: '#fef08a',
    size: 0.45,
    transparent: true,
    opacity: dayMode === 'malam' ? 0.95 : 0.0,
  });
  const stars = new THREE.Points(starGeo, starMat);
  scene.add(stars);

  return { clouds, stars };
}

export function buildStructureGroup(
  s: WorldStructure,
  maxAnisotropy: number
): { group: THREE.Group; colliders: ColliderBox[]; isTree?: boolean; isAnimal?: boolean } {
  const group = new THREE.Group();
  group.position.set(s.x, s.y, s.z);
  if (s.rotationY) group.rotation.y = s.rotationY;

  const colliders: ColliderBox[] = [];
  const woodMat = getBlockMaterial('wood', undefined, maxAnisotropy);
  const plankMat = getBlockMaterial('plank', undefined, maxAnisotropy);
  const attapMat = getBlockMaterial('attap', undefined, maxAnisotropy);
  const whiteMat = getBlockMaterial('white_wall', undefined, maxAnisotropy);
  const blueRoofMat = getBlockMaterial('blue_roof', undefined, maxAnisotropy);
  const brickMat = getBlockMaterial('brick', undefined, maxAnisotropy);
  const goldMat = getBlockMaterial('gold', undefined, maxAnisotropy);
  const glassMat = getBlockMaterial('glass', undefined, maxAnisotropy);
  const leavesMat = getBlockMaterial('leaves', undefined, maxAnisotropy);

  if (s.kind === 'rumah_kampung') {
    // Traditional Malay stilt house (5-part composite + open doorway)
    const accentMat = new THREE.MeshStandardMaterial({
      color: s.accentColor || '#d97706',
      roughness: 0.65,
    });
    // 4 stilts
    [[-2, -2], [2, -2], [-2, 2], [2, 2]].forEach(([sx, sz]) => {
      const stilt = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.8, 0.4), woodMat);
      stilt.position.set(sx, 0.4, sz);
      stilt.castShadow = true;
      group.add(stilt);
    });
    // Raised floor
    const floor = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.3, 5.2), plankMat);
    floor.position.set(0, 0.95, 0);
    floor.receiveShadow = true;
    group.add(floor);
    // Front stairs
    const step1 = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.35, 0.6), plankMat);
    step1.position.set(0, 0.18, 3.0);
    const step2 = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.7, 0.6), plankMat);
    step2.position.set(0, 0.35, 2.5);
    group.add(step1, step2);

    // Back & side walls (leave front doorway open!)
    const backWall = new THREE.Mesh(new THREE.BoxGeometry(4.8, 2.6, 0.35), plankMat);
    backWall.position.set(0, 2.4, -2.2);
    backWall.castShadow = true;
    const leftWall = new THREE.Mesh(new THREE.BoxGeometry(0.35, 2.6, 4.4), plankMat);
    leftWall.position.set(-2.2, 2.4, 0);
    leftWall.castShadow = true;
    const rightWall = new THREE.Mesh(new THREE.BoxGeometry(0.35, 2.6, 4.4), plankMat);
    rightWall.position.set(2.2, 2.4, 0);
    rightWall.castShadow = true;

    // Front wall pillars framing doorway + accent trim
    const frontLeft = new THREE.Mesh(new THREE.BoxGeometry(1.4, 2.6, 0.35), accentMat);
    frontLeft.position.set(-1.5, 2.4, 2.2);
    const frontRight = new THREE.Mesh(new THREE.BoxGeometry(1.4, 2.6, 0.35), accentMat);
    frontRight.position.set(1.5, 2.4, 2.2);
    const transom = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.7, 0.35), accentMat);
    transom.position.set(0, 3.35, 2.2);
    group.add(backWall, leftWall, rightWall, frontLeft, frontRight, transom);

    // Pitched Attap Roof (two-tier)
    const roofBase = new THREE.Mesh(new THREE.BoxGeometry(5.8, 0.6, 5.8), attapMat);
    roofBase.position.set(0, 4.0, 0);
    roofBase.castShadow = true;
    const roofTop = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.75, 4.0), attapMat);
    roofTop.position.set(0, 4.65, 0);
    roofTop.castShadow = true;
    group.add(roofBase, roofTop);

    // Floating signboard
    const sign = makeLabelSprite(s.name, 'rgba(180, 83, 9, 0.92)');
    sign.position.set(0, 5.7, 0);
    group.add(sign);

    colliders.push(
      { minX: s.x - 2.4, maxX: s.x + 2.4, minY: 0, maxY: 4, minZ: s.z - 2.4, maxZ: s.z - 1.9 },
      { minX: s.x - 2.4, maxX: s.x - 1.9, minY: 0, maxY: 4, minZ: s.z - 2.4, maxZ: s.z + 2.4 },
      { minX: s.x + 1.9, maxX: s.x + 2.4, minY: 0, maxY: 4, minZ: s.z - 2.4, maxZ: s.z + 2.4 }
    );
  } else if (s.kind === 'sekolah') {
    const base = new THREE.Mesh(new THREE.BoxGeometry(11, 0.4, 7), brickMat);
    base.position.set(0, 0.2, 0);
    const back = new THREE.Mesh(new THREE.BoxGeometry(10.6, 3.6, 0.4), whiteMat);
    back.position.set(0, 2.2, -3.2);
    back.castShadow = true;
    const left = new THREE.Mesh(new THREE.BoxGeometry(0.4, 3.6, 6.4), whiteMat);
    left.position.set(-5.1, 2.2, 0);
    const right = new THREE.Mesh(new THREE.BoxGeometry(0.4, 3.6, 6.4), whiteMat);
    right.position.set(5.1, 2.2, 0);
    const winL = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.4, 0.3), glassMat);
    winL.position.set(-2.8, 2.4, 3.2);
    const winR = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.4, 0.3), glassMat);
    winR.position.set(2.8, 2.4, 3.2);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(11.6, 0.8, 7.6), blueRoofMat);
    roof.position.set(0, 4.4, 0);
    roof.castShadow = true;
    const ridge = new THREE.Mesh(new THREE.BoxGeometry(9.0, 0.7, 4.6), blueRoofMat);
    ridge.position.set(0, 5.1, 0);

    // Flagpole in front
    const pole = new THREE.Mesh(new THREE.BoxGeometry(0.15, 5.5, 0.15), whiteMat);
    pole.position.set(-4.8, 2.75, 4.2);
    const flag = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 0.7, 0.08),
      new THREE.MeshStandardMaterial({ color: '#dc2626', roughness: 0.6 })
    );
    flag.position.set(-4.2, 5.0, 4.2);

    group.add(base, back, left, right, winL, winR, roof, ridge, pole, flag);
    const sign = makeLabelSprite(s.name, 'rgba(29, 78, 216, 0.92)');
    sign.position.set(0, 6.4, 0);
    group.add(sign);

    colliders.push(
      { minX: s.x - 5.3, maxX: s.x + 5.3, minY: 0, maxY: 4, minZ: s.z - 3.4, maxZ: s.z - 2.8 }
    );
  } else if (s.kind === 'studio_avatar') {
    const floor = new THREE.Mesh(new THREE.BoxGeometry(7.5, 0.3, 6.5), plankMat);
    floor.position.set(0, 0.15, 0);
    const back = new THREE.Mesh(new THREE.BoxGeometry(7.2, 3.4, 0.4), whiteMat);
    back.position.set(0, 2.0, -3.0);
    const glassL = new THREE.Mesh(new THREE.BoxGeometry(0.25, 3.2, 5.8), glassMat);
    glassL.position.set(-3.4, 1.9, 0);
    const glassR = new THREE.Mesh(new THREE.BoxGeometry(0.25, 3.2, 5.8), glassMat);
    glassR.position.set(3.4, 1.9, 0);
    const roof = new THREE.Mesh(
      new THREE.BoxGeometry(7.8, 0.6, 6.8),
      new THREE.MeshStandardMaterial({ color: '#0284c7', roughness: 0.4 })
    );
    roof.position.set(0, 3.9, 0);
    // Virtual mirror inside studio
    const mirrorFrame = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.4, 0.2), goldMat);
    mirrorFrame.position.set(0, 1.7, -2.6);
    const mirrorGlass = new THREE.Mesh(
      new THREE.BoxGeometry(2.2, 2.0, 0.25),
      new THREE.MeshStandardMaterial({ color: '#bae6fd', metalness: 0.9, roughness: 0.08 })
    );
    mirrorGlass.position.set(0, 1.7, -2.55);
    // Dressing podium
    const podium = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.2, 0.25, 8), goldMat);
    podium.position.set(0, 0.4, 0);

    group.add(floor, back, glassL, glassR, roof, mirrorFrame, mirrorGlass, podium);
    const sign = makeLabelSprite(s.name, 'rgba(3, 105, 161, 0.95)', '#fef08a');
    sign.position.set(0, 5.1, 0);
    group.add(sign);

    colliders.push(
      { minX: s.x - 3.6, maxX: s.x + 3.6, minY: 0, maxY: 4, minZ: s.z - 3.2, maxZ: s.z - 2.6 }
    );
  } else if (s.kind === 'istana') {
    const base = new THREE.Mesh(new THREE.BoxGeometry(14, 0.8, 10), brickMat);
    base.position.set(0, 0.4, 0);
    const hall = new THREE.Mesh(new THREE.BoxGeometry(10, 4.4, 8), whiteMat);
    hall.position.set(0, 3.0, -0.5);
    hall.castShadow = true;
    const roof = new THREE.Mesh(new THREE.BoxGeometry(11.4, 1.1, 9.4), goldMat);
    roof.position.set(0, 5.6, -0.5);
    const spire = new THREE.Mesh(new THREE.ConeGeometry(1.8, 2.8, 4), goldMat);
    spire.position.set(0, 7.4, -0.5);
    spire.rotation.y = Math.PI / 4;

    // 4 Corner Towers
    [[-5.8, -4.4], [5.8, -4.4], [-5.8, 4.0], [5.8, 4.0]].forEach(([tx, tz]) => {
      const tower = new THREE.Mesh(new THREE.BoxGeometry(2.2, 6.2, 2.2), whiteMat);
      tower.position.set(tx, 3.1, tz);
      tower.castShadow = true;
      const cap = new THREE.Mesh(new THREE.ConeGeometry(1.7, 2.0, 4), goldMat);
      cap.position.set(tx, 7.1, tz);
      cap.rotation.y = Math.PI / 4;
      group.add(tower, cap);
    });

    const carpet = new THREE.Mesh(
      new THREE.BoxGeometry(2.4, 0.1, 6.0),
      new THREE.MeshStandardMaterial({ color: '#dc2626', roughness: 0.85 })
    );
    carpet.position.set(0, 0.85, 5.2);

    group.add(base, hall, roof, spire, carpet);
    const sign = makeLabelSprite(s.name, 'rgba(180, 83, 9, 0.95)', '#fef08a');
    sign.position.set(0, 9.2, 0);
    group.add(sign);
  } else if (s.kind === 'taman_permainan') {
    const pad = new THREE.Mesh(
      new THREE.BoxGeometry(7, 0.12, 6),
      getBlockMaterial('sand', undefined, maxAnisotropy)
    );
    pad.position.set(0, 0.06, 0);
    // Slide
    const slideTower = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.2, 1.2), woodMat);
    slideTower.position.set(-2, 1.1, -1.2);
    const chute = new THREE.Mesh(
      new THREE.BoxGeometry(1.0, 0.2, 2.6),
      new THREE.MeshStandardMaterial({ color: '#ef4444', roughness: 0.35 })
    );
    chute.position.set(-2, 1.1, 0.4);
    chute.rotation.x = 0.6;
    // Seesaw
    const fulcrum = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.6, 0.8), woodMat);
    fulcrum.position.set(1.6, 0.3, 0.8);
    const plank = new THREE.Mesh(
      new THREE.BoxGeometry(3.4, 0.18, 0.6),
      new THREE.MeshStandardMaterial({ color: '#eab308', roughness: 0.5 })
    );
    plank.position.set(1.6, 0.72, 0.8);
    plank.rotation.z = 0.14;
    // Swing frame
    const postL = new THREE.Mesh(new THREE.BoxGeometry(0.25, 2.8, 0.25), woodMat);
    postL.position.set(0.8, 1.4, -1.8);
    const postR = new THREE.Mesh(new THREE.BoxGeometry(0.25, 2.8, 0.25), woodMat);
    postR.position.set(2.8, 1.4, -1.8);
    const crossbar = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.25, 0.25), woodMat);
    crossbar.position.set(1.8, 2.7, -1.8);

    group.add(pad, slideTower, chute, fulcrum, plank, postL, postR, crossbar);
    const sign = makeLabelSprite(s.name, 'rgba(22, 163, 74, 0.92)');
    sign.position.set(0, 3.6, 0);
    group.add(sign);
  } else if (s.kind === 'pondok_belajar') {
    const deck = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.3, 4.2), plankMat);
    deck.position.set(0, 0.15, 0);
    [[-1.7, -1.7], [1.7, -1.7], [-1.7, 1.7], [1.7, 1.7]].forEach(([px, pz]) => {
      const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.3, 2.6, 0.3), woodMat);
      pillar.position.set(px, 1.5, pz);
      pillar.castShadow = true;
      group.add(pillar);
    });
    const roof = new THREE.Mesh(new THREE.BoxGeometry(4.8, 0.5, 4.8), attapMat);
    roof.position.set(0, 3.0, 0);
    const roofTop = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.6, 2.8), attapMat);
    roofTop.position.set(0, 3.55, 0);
    const table = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.7, 1.0), plankMat);
    table.position.set(0, 0.65, 0);
    group.add(deck, roof, roofTop, table);
    const sign = makeLabelSprite(s.name, 'rgba(13, 148, 136, 0.94)');
    sign.position.set(0, 4.5, 0);
    group.add(sign);
  } else if (s.kind === 'pokok') {
    const trunk = new THREE.Mesh(new THREE.BoxGeometry(0.75, 2.8, 0.75), woodMat);
    trunk.position.set(0, 1.4, 0);
    trunk.castShadow = true;
    const crown1 = new THREE.Mesh(new THREE.BoxGeometry(3.0, 1.4, 3.0), leavesMat);
    crown1.position.set(0, 3.2, 0);
    crown1.castShadow = true;
    const crown2 = new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.1, 2.0), leavesMat);
    crown2.position.set(0, 4.3, 0);
    crown2.castShadow = true;
    group.add(trunk, crown1, crown2);
    return { group, colliders, isTree: true };
  } else if (s.kind.startsWith('haiwan_')) {
    const bodyColor =
      s.kind === 'haiwan_kucing' ? '#fb923c' : s.kind === 'haiwan_ayam' ? '#f8fafc' : '#92400e';
    const bodyMat = new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.75 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.45, 1.0), bodyMat);
    body.position.set(0, 0.45, 0);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.42, 0.45), bodyMat);
    head.position.set(0, 0.72, 0.55);
    const earL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.22, 0.12), bodyMat);
    earL.position.set(-0.14, 0.98, 0.55);
    const earR = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.22, 0.12), bodyMat);
    earR.position.set(0.14, 0.98, 0.55);
    [[-0.22, -0.3], [0.22, -0.3], [-0.22, 0.3], [0.22, 0.3]].forEach(([lx, lz]) => {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.28, 0.14), bodyMat);
      leg.position.set(lx, 0.14, lz);
      group.add(leg);
    });
    group.add(body, head, earL, earR);
    return { group, colliders, isAnimal: true };
  }

  return { group, colliders };
}

export function buildNPCGroup(npc: WorldNPC): THREE.Group {
  const g = new THREE.Group();
  g.position.set(npc.x, npc.y, npc.z);

  const skinMat = new THREE.MeshStandardMaterial({ color: npc.skinColor, roughness: 0.7 });
  const shirtMat = new THREE.MeshStandardMaterial({ color: npc.shirtColor, roughness: 0.65 });
  const pantMat = new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.8 });

  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.68, 0.22), pantMat);
  legL.position.set(-0.13, 0.34, 0);
  const legR = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.68, 0.22), pantMat);
  legR.position.set(0.13, 0.34, 0);
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.68, 0.28), shirtMat);
  torso.position.set(0, 1.02, 0);
  torso.castShadow = true;
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.58, 0.18), shirtMat);
  armL.position.set(-0.38, 1.05, 0);
  const armR = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.58, 0.18), shirtMat);
  armR.position.set(0.38, 1.05, 0);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.48, 0.48), skinMat);
  head.position.set(0, 1.62, 0);
  head.castShadow = true;
  const hat = new THREE.Mesh(
    new THREE.BoxGeometry(0.52, 0.14, 0.52),
    new THREE.MeshStandardMaterial({ color: '#18181b', roughness: 0.85 })
  );
  hat.position.set(0, 1.9, 0);

  const label = makeLabelSprite(`${npc.name} (${npc.roleTitle})`, 'rgba(15, 118, 110, 0.92)');
  label.position.set(0, 2.45, 0);
  label.scale.set(2.4, 0.52, 1);

  g.add(legL, legR, torso, armL, armR, head, hat, label);
  return g;
}

export function buildSignpostGroup(sign: WorldSign, maxAnisotropy: number): THREE.Group {
  const g = new THREE.Group();
  g.position.set(sign.x, sign.y, sign.z);

  const woodMat = getBlockMaterial('wood', undefined, maxAnisotropy);
  const plankMat = getBlockMaterial('plank', undefined, maxAnisotropy);

  const post = new THREE.Mesh(new THREE.BoxGeometry(0.22, 1.4, 0.22), woodMat);
  post.position.set(0, 0.7, 0);
  const board = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.85, 0.16), plankMat);
  board.position.set(0, 1.45, 0);
  const sprite = makeLabelSprite(sign.title, 'rgba(30, 41, 59, 0.9)');
  sprite.position.set(0, 2.35, 0);
  sprite.scale.set(2.2, 0.48, 1);

  g.add(post, board, sprite);
  return g;
}

export function buildStationBeacon(title: string, category: string): THREE.Group {
  const g = new THREE.Group();
  const ring = new THREE.Mesh(
    new THREE.CylinderGeometry(1.1, 1.1, 0.12, 16),
    new THREE.MeshStandardMaterial({
      color: '#f59e0b',
      emissive: '#d97706',
      emissiveIntensity: 0.45,
      roughness: 0.3,
    })
  );
  ring.position.y = 0.06;
  const crystal = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.35, 0),
    new THREE.MeshStandardMaterial({
      color: '#fde047',
      emissive: '#f59e0b',
      emissiveIntensity: 0.6,
      roughness: 0.15,
      metalness: 0.5,
    })
  );
  crystal.position.y = 1.1;
  crystal.name = 'beacon_crystal';

  const sprite = makeLabelSprite(`${category}: ${title}`, 'rgba(180, 83, 9, 0.92)');
  sprite.position.set(0, 2.0, 0);
  sprite.scale.set(2.5, 0.55, 1);

  g.add(ring, crystal, sprite);
  return g;
}

export function buildMusicZoneBeacon(title: string): THREE.Group {
  const g = new THREE.Group();
  const stage = new THREE.Mesh(
    new THREE.CylinderGeometry(2.6, 2.8, 0.24, 16),
    new THREE.MeshStandardMaterial({
      color: '#7c3aed',
      roughness: 0.4,
      metalness: 0.2,
    })
  );
  stage.position.y = 0.12;
  const noteBlock = new THREE.Mesh(
    new THREE.BoxGeometry(0.7, 0.7, 0.7),
    new THREE.MeshStandardMaterial({
      color: '#ec4899',
      emissive: '#db2777',
      emissiveIntensity: 0.45,
      roughness: 0.25,
    })
  );
  noteBlock.position.y = 1.4;
  noteBlock.name = 'music_crystal';
  const sprite = makeLabelSprite(`🎵 ${title}`, 'rgba(109, 40, 217, 0.94)');
  sprite.position.set(0, 2.4, 0);
  sprite.scale.set(2.8, 0.6, 1);

  g.add(stage, noteBlock, sprite);
  return g;
}
