import * as THREE from 'three';
import { MALAYSIA_UNIFORMS } from '../data/curriculumDefaults';
import { AvatarAnimState, AvatarConfig } from '../types/blockverse';

function makeNameTagSprite(text: string, subtext?: string): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = 'rgba(15, 23, 42, 0.82)';
  ctx.beginPath();
  ctx.roundRect(16, 16, 480, 96, 20);
  ctx.fill();

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
  ctx.lineWidth = 4;
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 40px Plus Jakarta Sans, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text.slice(0, 20), 256, subtext ? 48 : 64);

  if (subtext) {
    ctx.fillStyle = '#fde68a';
    ctx.font = '600 24px Plus Jakarta Sans, sans-serif';
    ctx.fillText(subtext.slice(0, 28), 256, 88);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(1.6, 0.4, 1);
  return sprite;
}

function makeChestNameTagTexture(name: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 48;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, 128, 48);
  ctx.strokeStyle = '#f8fafc';
  ctx.lineWidth = 4;
  ctx.strokeRect(2, 2, 124, 44);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 20px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText((name || 'MURID').toUpperCase().slice(0, 9), 64, 25);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export interface AvatarRig {
  root: THREE.Group;
  bodyPivot: THREE.Group;
  headGroup: THREE.Group;
  leftArmPivot: THREE.Group;
  rightArmPivot: THREE.Group;
  leftLegPivot: THREE.Group;
  rightLegPivot: THREE.Group;
  heldBook: THREE.Group;
  nameSprite?: THREE.Sprite;
}

export function buildVoxelAvatar(config: AvatarConfig, subtitle?: string): AvatarRig {
  const root = new THREE.Group();
  const bodyPivot = new THREE.Group();
  root.add(bodyPivot);

  const uniform =
    MALAYSIA_UNIFORMS.find((u) => u.id === config.uniformOption) || MALAYSIA_UNIFORMS[0];
  const topColor = config.customTopColor || uniform.topColor;
  const bottomColor = config.customBottomColor || uniform.bottomColor;

  const skinMat = new THREE.MeshStandardMaterial({
    color: config.skinColor || '#eab68c',
    roughness: 0.72,
    metalness: 0.0,
  });
  const topMat = new THREE.MeshStandardMaterial({
    color: topColor,
    roughness: 0.65,
    metalness: 0.02,
  });
  const bottomMat = new THREE.MeshStandardMaterial({
    color: bottomColor,
    roughness: 0.78,
    metalness: 0.02,
  });
  const hairMat = new THREE.MeshStandardMaterial({
    color: config.hairColor || '#18181b',
    roughness: 0.85,
    metalness: 0.05,
  });
  const shoeMat = new THREE.MeshStandardMaterial({
    color: config.shoeStyle === 'kasut_putih' ? '#f8fafc' : '#18181b',
    roughness: 0.45,
    metalness: 0.08,
  });
  const sockMat = new THREE.MeshStandardMaterial({
    color: '#ffffff',
    roughness: 0.8,
  });

  // 1. Legs (pivoted at hip y = 0.72)
  const leftLegPivot = new THREE.Group();
  leftLegPivot.position.set(-0.14, 0.72, 0);
  const rightLegPivot = new THREE.Group();
  rightLegPivot.position.set(0.14, 0.72, 0);
  bodyPivot.add(leftLegPivot, rightLegPivot);

  const buildLeg = (pivot: THREE.Group) => {
    if (uniform.isShorts) {
      const shortMesh = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.34, 0.24), bottomMat);
      shortMesh.position.y = -0.17;
      shortMesh.castShadow = true;
      pivot.add(shortMesh);

      const calfMesh = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.24, 0.2), skinMat);
      calfMesh.position.y = -0.46;
      calfMesh.castShadow = true;
      pivot.add(calfMesh);
    } else if (!uniform.isKurung) {
      const pantMesh = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.56, 0.24), bottomMat);
      pantMesh.position.y = -0.28;
      pantMesh.castShadow = true;
      pivot.add(pantMesh);
    }

    if (config.socksVisible) {
      const sock = new THREE.Mesh(new THREE.BoxGeometry(0.21, 0.14, 0.21), sockMat);
      sock.position.y = -0.58;
      pivot.add(sock);
    }

    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.12, 0.3), shoeMat);
    shoe.position.set(0, -0.66, 0.03);
    shoe.castShadow = true;
    pivot.add(shoe);
  };

  buildLeg(leftLegPivot);
  buildLeg(rightLegPivot);

  // If Baju Kurung / Kain or Pinafore, add skirt layer
  if (uniform.isKurung) {
    const kain = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.62, 0.3), bottomMat);
    kain.position.set(0, 0.45, 0);
    kain.castShadow = true;
    bodyPivot.add(kain);
  }

  // 2. Torso (y = 0.72 to 1.38)
  const torsoHeight = uniform.isKurung ? 0.74 : 0.64;
  const torsoGeo = new THREE.BoxGeometry(0.54, torsoHeight, 0.28);
  const torso = new THREE.Mesh(
    torsoGeo,
    uniform.isPinafore ? bottomMat : topMat
  );
  torso.position.set(0, uniform.isKurung ? 1.02 : 1.04, 0);
  torso.castShadow = true;
  bodyPivot.add(torso);

  // Pinafore white blouse collar accent
  if (uniform.isPinafore) {
    const collar = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.2, 0.29), topMat);
    collar.position.set(0, 1.26, 0);
    bodyPivot.add(collar);
  }

  // Sport stripe for Pilihan F
  if (uniform.isSport) {
    const stripeMat = new THREE.MeshStandardMaterial({ color: '#facc15', roughness: 0.4 });
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.08, 0.3), stripeMat);
    stripe.position.set(0, 1.04, 0);
    bodyPivot.add(stripe);
  }

  // Generic School Badge (left chest)
  if (config.showBadge) {
    const badge = new THREE.Mesh(
      new THREE.BoxGeometry(0.09, 0.1, 0.02),
      new THREE.MeshStandardMaterial({ color: '#eab308', metalness: 0.5, roughness: 0.3 })
    );
    badge.position.set(-0.15, 1.18, 0.15);
    bodyPivot.add(badge);
  }

  // Name Tag (Tanda Nama on chest)
  if (config.showNameTag) {
    const tagTex = makeChestNameTagTexture(config.avatarName);
    const tagMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 0.06, 0.02),
      new THREE.MeshStandardMaterial({ map: tagTex, roughness: 0.4 })
    );
    tagMesh.position.set(0.12, 1.17, 0.15);
    bodyPivot.add(tagMesh);
  }

  // School Backpack (Beg Sekolah)
  const packMat = new THREE.MeshStandardMaterial({
    color: config.backpackColor || '#2563eb',
    roughness: 0.65,
  });
  const backpack = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.48, 0.18), packMat);
  backpack.position.set(0, 1.06, -0.22);
  backpack.castShadow = true;
  bodyPivot.add(backpack);

  const packPocket = new THREE.Mesh(
    new THREE.BoxGeometry(0.32, 0.22, 0.06),
    new THREE.MeshStandardMaterial({ color: '#facc15', roughness: 0.5 })
  );
  packPocket.position.set(0, 0.96, -0.32);
  bodyPivot.add(packPocket);

  // 3. Arms (pivoted at shoulders y = 1.32)
  const leftArmPivot = new THREE.Group();
  leftArmPivot.position.set(-0.38, 1.32, 0);
  const rightArmPivot = new THREE.Group();
  rightArmPivot.position.set(0.38, 1.32, 0);
  bodyPivot.add(leftArmPivot, rightArmPivot);

  const buildArm = (pivot: THREE.Group, isRight: boolean) => {
    const sleeveLen = uniform.isKurung ? 0.44 : 0.24;
    const sleeve = new THREE.Mesh(new THREE.BoxGeometry(0.2, sleeveLen, 0.2), topMat);
    sleeve.position.y = -sleeveLen / 2;
    sleeve.castShadow = true;
    pivot.add(sleeve);

    const forearmLen = 0.56 - sleeveLen;
    const forearm = new THREE.Mesh(new THREE.BoxGeometry(0.18, forearmLen, 0.18), skinMat);
    forearm.position.y = -sleeveLen - forearmLen / 2;
    forearm.castShadow = true;
    pivot.add(forearm);

    if (isRight && config.accessory === 'jam_tangan') {
      const watch = new THREE.Mesh(
        new THREE.BoxGeometry(0.2, 0.06, 0.2),
        new THREE.MeshStandardMaterial({ color: '#0f172a', metalness: 0.7, roughness: 0.25 })
      );
      watch.position.y = -0.46;
      pivot.add(watch);
    }
  };
  buildArm(leftArmPivot, false);
  buildArm(rightArmPivot, true);

  // Held book prop (shown during 'hold_book' animState)
  const heldBook = new THREE.Group();
  const bookCover = new THREE.Mesh(
    new THREE.BoxGeometry(0.32, 0.08, 0.24),
    new THREE.MeshStandardMaterial({ color: '#0284c7', roughness: 0.5 })
  );
  const bookPages = new THREE.Mesh(
    new THREE.BoxGeometry(0.28, 0.06, 0.21),
    new THREE.MeshStandardMaterial({ color: '#f8fafc', roughness: 0.85 })
  );
  bookPages.position.y = 0.01;
  heldBook.add(bookCover, bookPages);
  heldBook.position.set(0, 1.0, 0.34);
  heldBook.visible = false;
  bodyPivot.add(heldBook);

  // 4. Head (y = 1.62)
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 1.38, 0);
  bodyPivot.add(headGroup);

  const headScaleX =
    config.headShape === 'lebar' ? 1.12 : config.headShape === 'runcing' ? 0.92 : 1.0;
  const headScaleZ = config.faceShape === 'bulat' ? 1.04 : 0.96;
  const headScaleY = config.faceShape === 'bujur' ? 1.08 : 1.0;

  const headMesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.5 * headScaleX, 0.5 * headScaleY, 0.5 * headScaleZ),
    skinMat
  );
  headMesh.position.y = 0.25 * headScaleY;
  headMesh.castShadow = true;
  headGroup.add(headMesh);

  // Eyes
  const eyeZ = 0.25 * headScaleZ + 0.01;
  const eyeY = 0.27 * headScaleY;
  const eyeWhiteMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.3 });
  const pupilMat = new THREE.MeshStandardMaterial({
    color: config.eyeColor || '#2c1e16',
    roughness: 0.2,
  });

  [-0.11, 0.11].forEach((ex) => {
    const eyeH = config.eyeShape === 'tenang' ? 0.04 : 0.08;
    const eyeW = config.eyeShape === 'bulat' ? 0.08 : 0.09;
    const sclera = new THREE.Mesh(new THREE.BoxGeometry(eyeW, eyeH, 0.02), eyeWhiteMat);
    sclera.position.set(ex, eyeY, eyeZ);
    headGroup.add(sclera);

    const pupil = new THREE.Mesh(
      new THREE.BoxGeometry(0.05, Math.max(0.035, eyeH * 0.75), 0.025),
      pupilMat
    );
    pupil.position.set(ex, eyeY, eyeZ + 0.005);
    headGroup.add(pupil);

    if (config.eyeShape === 'berkilau' || config.eyeShape === 'bintang') {
      const glint = new THREE.Mesh(
        new THREE.BoxGeometry(0.022, 0.022, 0.03),
        eyeWhiteMat
      );
      glint.position.set(ex + 0.015, eyeY + 0.015, eyeZ + 0.006);
      headGroup.add(glint);
    }
  });

  // Mouth expression
  const mouthMat = new THREE.MeshStandardMaterial({ color: '#991b1b', roughness: 0.5 });
  if (config.expression === 'gembira' || config.expression === 'teruja') {
    const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.06, 0.02), mouthMat);
    mouth.position.set(0, 0.13 * headScaleY, eyeZ);
    headGroup.add(mouth);
  } else if (config.expression === 'bersemangat') {
    const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.04, 0.02), mouthMat);
    mouth.position.set(0, 0.13 * headScaleY, eyeZ);
    headGroup.add(mouth);
  } else {
    const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.03, 0.02), mouthMat);
    mouth.position.set(0, 0.13 * headScaleY, eyeZ);
    headGroup.add(mouth);
  }

  // Tudung for Pilihan E
  if (uniform.hasTudung) {
    const tudungMat = new THREE.MeshStandardMaterial({ color: '#f8fafc', roughness: 0.75 });
    const tudungTop = new THREE.Mesh(
      new THREE.BoxGeometry(0.56 * headScaleX, 0.14, 0.56 * headScaleZ),
      tudungMat
    );
    tudungTop.position.set(0, 0.48 * headScaleY, 0);
    const tudungBack = new THREE.Mesh(
      new THREE.BoxGeometry(0.58 * headScaleX, 0.56, 0.34),
      tudungMat
    );
    tudungBack.position.set(0, 0.22 * headScaleY, -0.14);
    const tudungDrape = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.32, 0.32), tudungMat);
    tudungDrape.position.set(0, -0.05, 0.02);
    headGroup.add(tudungTop, tudungBack, tudungDrape);
  } else {
    // Hair styles
    const hairTop = new THREE.Mesh(
      new THREE.BoxGeometry(0.54 * headScaleX, 0.12, 0.54 * headScaleZ),
      hairMat
    );
    hairTop.position.set(0, 0.49 * headScaleY, 0);
    headGroup.add(hairTop);

    const hairBack = new THREE.Mesh(
      new THREE.BoxGeometry(0.54 * headScaleX, 0.36, 0.12),
      hairMat
    );
    hairBack.position.set(0, 0.3 * headScaleY, -0.23 * headScaleZ);
    headGroup.add(hairBack);

    if (config.hairStyle === 'kerinting') {
      const puff = new THREE.Mesh(
        new THREE.BoxGeometry(0.62 * headScaleX, 0.2, 0.6 * headScaleZ),
        hairMat
      );
      puff.position.set(0, 0.52 * headScaleY, 0);
      headGroup.add(puff);
    } else if (config.hairStyle === 'sanggul') {
      const bun = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.2, 0.22), hairMat);
      bun.position.set(0, 0.42 * headScaleY, -0.34);
      headGroup.add(bun);
    } else if (config.hairStyle === 'ekor_kuda') {
      const tail = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.38, 0.16), hairMat);
      tail.position.set(0, 0.26 * headScaleY, -0.34);
      headGroup.add(tail);
    } else if (config.hairStyle === 'panjang') {
      const longHair = new THREE.Mesh(
        new THREE.BoxGeometry(0.56 * headScaleX, 0.55, 0.16),
        hairMat
      );
      longHair.position.set(0, 0.12 * headScaleY, -0.24 * headScaleZ);
      headGroup.add(longHair);
    } else if (config.hairStyle === 'belah_tepi') {
      const bangs = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.1, 0.08), hairMat);
      bangs.position.set(-0.12, 0.41 * headScaleY, 0.24 * headScaleZ);
      headGroup.add(bangs);
    }
  }

  // Accessories
  if (config.accessory === 'songkok' || config.hairStyle === 'songkok') {
    const songkok = new THREE.Mesh(
      new THREE.BoxGeometry(0.52 * headScaleX, 0.18, 0.52 * headScaleZ),
      new THREE.MeshStandardMaterial({ color: '#111827', roughness: 0.9 })
    );
    songkok.position.set(0, 0.56 * headScaleY, 0);
    headGroup.add(songkok);
  } else if (config.accessory === 'cermin_mata') {
    const frameMat = new THREE.MeshStandardMaterial({
      color: '#1e293b',
      metalness: 0.6,
      roughness: 0.25,
    });
    const leftRim = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.1, 0.03), frameMat);
    leftRim.position.set(-0.11, eyeY, eyeZ + 0.015);
    const rightRim = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.1, 0.03), frameMat);
    rightRim.position.set(0.11, eyeY, eyeZ + 0.015);
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.025, 0.03), frameMat);
    bridge.position.set(0, eyeY + 0.01, eyeZ + 0.015);
    headGroup.add(leftRim, rightRim, bridge);
  } else if (config.accessory === 'cekak_rambut') {
    const cekak = new THREE.Mesh(
      new THREE.BoxGeometry(0.56 * headScaleX, 0.06, 0.12),
      new THREE.MeshStandardMaterial({ color: '#ec4899', roughness: 0.4 })
    );
    cekak.position.set(0, 0.54 * headScaleY, 0.05);
    headGroup.add(cekak);
  }

  // Floating Name Sprite
  let nameSprite: THREE.Sprite | undefined;
  if (config.avatarName) {
    nameSprite = makeNameTagSprite(config.avatarName, subtitle);
    nameSprite.position.set(0, 2.32, 0);
    root.add(nameSprite);
  }

  return {
    root,
    bodyPivot,
    headGroup,
    leftArmPivot,
    rightArmPivot,
    leftLegPivot,
    rightLegPivot,
    heldBook,
    nameSprite,
  };
}

export function animateAvatarRig(
  rig: AvatarRig,
  animState: AvatarAnimState,
  elapsed: number
) {
  rig.heldBook.visible = animState === 'hold_book';
  rig.bodyPivot.position.set(0, 0, 0);
  rig.bodyPivot.rotation.set(0, 0, 0);
  rig.headGroup.rotation.set(0, 0, 0);

  if (animState === 'idle') {
    rig.bodyPivot.position.y = Math.sin(elapsed * 2.2) * 0.02;
    rig.leftArmPivot.rotation.set(Math.sin(elapsed * 1.8) * 0.04, 0, 0.06);
    rig.rightArmPivot.rotation.set(-Math.sin(elapsed * 1.8) * 0.04, 0, -0.06);
    rig.leftLegPivot.rotation.set(0, 0, 0);
    rig.rightLegPivot.rotation.set(0, 0, 0);
  } else if (animState === 'walk' || animState === 'run') {
    const speed = animState === 'run' ? 12 : 7;
    const amp = animState === 'run' ? 0.85 : 0.55;
    const swing = Math.sin(elapsed * speed) * amp;
    rig.leftArmPivot.rotation.set(-swing, 0, 0.06);
    rig.rightArmPivot.rotation.set(swing, 0, -0.06);
    rig.leftLegPivot.rotation.set(swing, 0, 0);
    rig.rightLegPivot.rotation.set(-swing, 0, 0);
    rig.bodyPivot.position.y = Math.abs(Math.sin(elapsed * speed)) * 0.06;
  } else if (animState === 'jump') {
    rig.leftArmPivot.rotation.set(-2.4, 0, 0.25);
    rig.rightArmPivot.rotation.set(-2.4, 0, -0.25);
    rig.leftLegPivot.rotation.set(-0.35, 0, 0);
    rig.rightLegPivot.rotation.set(0.25, 0, 0);
  } else if (animState === 'sit') {
    rig.bodyPivot.position.y = -0.35;
    rig.leftLegPivot.rotation.set(-1.35, 0, 0.08);
    rig.rightLegPivot.rotation.set(-1.35, 0, -0.08);
    rig.leftArmPivot.rotation.set(-0.35, 0, 0.08);
    rig.rightArmPivot.rotation.set(-0.35, 0, -0.08);
  } else if (animState === 'wave') {
    rig.leftArmPivot.rotation.set(0, 0, 0.08);
    rig.rightArmPivot.rotation.set(-2.6, 0, -0.25 + Math.sin(elapsed * 9) * 0.35);
    rig.leftLegPivot.rotation.set(0, 0, 0);
    rig.rightLegPivot.rotation.set(0, 0, 0);
    rig.headGroup.rotation.z = Math.sin(elapsed * 4) * 0.08;
  } else if (animState === 'dance') {
    rig.bodyPivot.position.y = Math.abs(Math.sin(elapsed * 8)) * 0.14;
    rig.bodyPivot.rotation.y = Math.sin(elapsed * 4) * 0.28;
    rig.leftArmPivot.rotation.set(-1.6 + Math.sin(elapsed * 8) * 0.7, 0, 0.35);
    rig.rightArmPivot.rotation.set(-1.6 - Math.sin(elapsed * 8) * 0.7, 0, -0.35);
    rig.leftLegPivot.rotation.set(Math.sin(elapsed * 8) * 0.35, 0, 0);
    rig.rightLegPivot.rotation.set(-Math.sin(elapsed * 8) * 0.35, 0, 0);
  } else if (animState === 'raise_hand') {
    rig.rightArmPivot.rotation.set(-3.0, 0, -0.1);
    rig.leftArmPivot.rotation.set(0, 0, 0.08);
    rig.leftLegPivot.rotation.set(0, 0, 0);
    rig.rightLegPivot.rotation.set(0, 0, 0);
  } else if (animState === 'hold_book') {
    rig.leftArmPivot.rotation.set(-0.95, -0.25, 0);
    rig.rightArmPivot.rotation.set(-0.95, 0.25, 0);
    rig.leftLegPivot.rotation.set(0, 0, 0);
    rig.rightLegPivot.rotation.set(0, 0, 0);
    rig.headGroup.rotation.x = 0.14;
  } else if (animState === 'celebrate') {
    rig.bodyPivot.position.y = Math.abs(Math.sin(elapsed * 9)) * 0.26;
    rig.bodyPivot.rotation.y = elapsed * 2.5;
    rig.leftArmPivot.rotation.set(-2.9, 0, 0.3);
    rig.rightArmPivot.rotation.set(-2.9, 0, -0.3);
    rig.leftLegPivot.rotation.set(Math.sin(elapsed * 9) * 0.3, 0, 0);
    rig.rightLegPivot.rotation.set(-Math.sin(elapsed * 9) * 0.3, 0, 0);
  }
}
