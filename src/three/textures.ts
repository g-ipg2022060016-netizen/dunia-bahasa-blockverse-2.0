import * as THREE from 'three';
import { BlockType } from '../types/blockverse';

const materialCache = new Map<string, THREE.MeshStandardMaterial>();
const textureCache = new Map<string, THREE.CanvasTexture>();

function makeVoxelTexture(
  key: string,
  baseHex: string,
  accentHex: string,
  pattern: 'speckle' | 'plank' | 'brick' | 'water' | 'leaves' | 'gold' | 'road' | 'crystal' | 'attap',
  maxAnisotropy = 4
): THREE.CanvasTexture {
  const cached = textureCache.get(key);
  if (cached) return cached;

  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = baseHex;
  ctx.fillRect(0, 0, size, size);

  if (pattern === 'speckle') {
    for (let y = 0; y < size; y += 8) {
      for (let x = 0; x < size; x += 8) {
        if (((x * 13 + y * 7) % 5) === 0) {
          ctx.fillStyle = accentHex;
          ctx.fillRect(x, y, 8, 8);
        }
      }
    }
  } else if (pattern === 'plank') {
    ctx.fillStyle = accentHex;
    for (let y = 0; y < size; y += 16) {
      ctx.fillRect(0, y, size, 2);
      ctx.fillRect((y * 2) % size, y, 2, 16);
    }
  } else if (pattern === 'brick') {
    ctx.fillStyle = accentHex;
    for (let y = 0; y < size; y += 16) {
      ctx.fillRect(0, y, size, 2);
      const offset = (y / 16) % 2 === 0 ? 0 : 16;
      for (let x = offset; x < size; x += 32) {
        ctx.fillRect(x, y, 2, 16);
      }
    }
  } else if (pattern === 'water') {
    ctx.fillStyle = accentHex;
    for (let y = 6; y < size; y += 16) {
      ctx.fillRect(4, y, 24, 4);
      ctx.fillRect(36, y + 6, 20, 4);
    }
  } else if (pattern === 'leaves') {
    for (let y = 0; y < size; y += 8) {
      for (let x = 0; x < size; x += 8) {
        if (((x + y) / 8) % 2 === 0) {
          ctx.fillStyle = accentHex;
          ctx.fillRect(x + 1, y + 1, 6, 6);
        }
      }
    }
  } else if (pattern === 'gold') {
    ctx.fillStyle = accentHex;
    ctx.fillRect(4, 4, size - 8, 6);
    ctx.fillRect(4, size - 10, size - 8, 6);
    ctx.fillStyle = '#fef08a';
    ctx.fillRect(10, 12, 14, 14);
  } else if (pattern === 'road') {
    ctx.fillStyle = accentHex;
    ctx.fillRect(0, 0, size, 4);
    ctx.fillRect(0, size - 4, size, 4);
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(28, 10, 8, 18);
    ctx.fillRect(28, 38, 8, 18);
  } else if (pattern === 'crystal') {
    ctx.fillStyle = accentHex;
    ctx.fillRect(8, 8, 48, 48);
    ctx.fillStyle = '#e0f2fe';
    ctx.fillRect(18, 18, 28, 28);
  } else if (pattern === 'attap') {
    ctx.fillStyle = accentHex;
    for (let y = 0; y < size; y += 8) {
      ctx.fillRect(0, y, size, 3);
    }
  }

  // Subtle voxel border shading
  ctx.strokeStyle = 'rgba(0,0,0,0.12)';
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, size - 2, size - 2);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.anisotropy = maxAnisotropy;
  textureCache.set(key, tex);
  return tex;
}

export const BLOCK_CATALOG: Record<
  BlockType,
  {
    label: string;
    base: string;
    accent: string;
    pattern: 'speckle' | 'plank' | 'brick' | 'water' | 'leaves' | 'gold' | 'road' | 'crystal' | 'attap';
    roughness: number;
    metalness: number;
    transparent?: boolean;
    opacity?: number;
    emissive?: string;
  }
> = {
  grass: { label: 'Rumput Hijau', base: '#4ade80', accent: '#22c55e', pattern: 'speckle', roughness: 0.88, metalness: 0.0 },
  dirt: { label: 'Tanah Subur', base: '#925e3c', accent: '#78492a', pattern: 'speckle', roughness: 0.92, metalness: 0.0 },
  stone: { label: 'Batu Gunung', base: '#94a3b8', accent: '#64748b', pattern: 'brick', roughness: 0.85, metalness: 0.05 },
  wood: { label: 'Kayu Balak', base: '#7c4a27', accent: '#5c3419', pattern: 'plank', roughness: 0.82, metalness: 0.0 },
  plank: { label: 'Papan Kampung', base: '#c28b52', accent: '#9c6b3a', pattern: 'plank', roughness: 0.78, metalness: 0.0 },
  attap: { label: 'Bumbung Nipah', base: '#854d27', accent: '#5e3418', pattern: 'attap', roughness: 0.9, metalness: 0.0 },
  brick: { label: 'Bata Merah', base: '#c24136', accent: '#e2e8f0', pattern: 'brick', roughness: 0.82, metalness: 0.0 },
  white_wall: { label: 'Dinding Putih', base: '#f1f5f9', accent: '#cbd5e1', pattern: 'brick', roughness: 0.75, metalness: 0.0 },
  blue_roof: { label: 'Bumbung Biru', base: '#1d4ed8', accent: '#1e40af', pattern: 'attap', roughness: 0.65, metalness: 0.1 },
  gold: { label: 'Emas Istana', base: '#f59e0b', accent: '#d97706', pattern: 'gold', roughness: 0.22, metalness: 0.85 },
  water: { label: 'Air Sungai', base: '#0ea5e9', accent: '#7dd3fc', pattern: 'water', roughness: 0.12, metalness: 0.1, transparent: true, opacity: 0.82 },
  sand: { label: 'Pasir Pantai', base: '#fde68a', accent: '#fcd34d', pattern: 'speckle', roughness: 0.9, metalness: 0.0 },
  leaves: { label: 'Daun Pokok', base: '#16a34a', accent: '#15803d', pattern: 'leaves', roughness: 0.86, metalness: 0.0 },
  flower_red: { label: 'Bunga Raya', base: '#ef4444', accent: '#facc15', pattern: 'leaves', roughness: 0.75, metalness: 0.0 },
  flower_yellow: { label: 'Bunga Matahari', base: '#eab308', accent: '#ca8a04', pattern: 'leaves', roughness: 0.75, metalness: 0.0 },
  road: { label: 'Jalan Raya', base: '#475569', accent: '#334155', pattern: 'road', roughness: 0.84, metalness: 0.02 },
  bridge: { label: 'Jambatan Kayu', base: '#a16207', accent: '#713f12', pattern: 'plank', roughness: 0.76, metalness: 0.0 },
  crystal: { label: 'Kristal Terapung', base: '#38bdf8', accent: '#7dd3fc', pattern: 'crystal', roughness: 0.15, metalness: 0.4, emissive: '#0284c7' },
  glass: { label: 'Kaca Studio', base: '#bae6fd', accent: '#e0f2fe', pattern: 'crystal', roughness: 0.1, metalness: 0.15, transparent: true, opacity: 0.55 },
};

export function getBlockMaterial(
  type: BlockType,
  tint?: string,
  maxAnisotropy = 4
): THREE.MeshStandardMaterial {
  const key = `${type}_${tint || 'default'}`;
  const existing = materialCache.get(key);
  if (existing) return existing;

  const spec = BLOCK_CATALOG[type] || BLOCK_CATALOG.stone;
  const map = makeVoxelTexture(type, spec.base, spec.accent, spec.pattern, maxAnisotropy);
  const mat = new THREE.MeshStandardMaterial({
    map,
    color: tint ? new THREE.Color(tint) : new THREE.Color('#ffffff'),
    roughness: spec.roughness,
    metalness: spec.metalness,
    transparent: Boolean(spec.transparent),
    opacity: spec.opacity ?? 1,
    ...(spec.emissive ? { emissive: new THREE.Color(spec.emissive), emissiveIntensity: 0.35 } : {}),
  });
  materialCache.set(key, mat);
  return mat;
}
