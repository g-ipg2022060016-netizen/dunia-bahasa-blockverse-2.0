import {
  AvatarConfig,
  BadgeInfo,
  UniformOptionId,
} from '../types/blockverse';

export const DEFAULT_AVATAR: AvatarConfig = {
  avatarName: 'Peneroka Cilik',
  faceShape: 'bulat',
  headShape: 'standard',
  skinColor: '#eab68c',
  eyeColor: '#2c1e16',
  eyeShape: 'bulat',
  hairStyle: 'pendek_kemas',
  hairColor: '#1e1b18',
  expression: 'senyum',
  accessory: 'tiada',
  uniformOption: 'A',
  shoeStyle: 'kasut_hitam',
  socksVisible: true,
  backpackColor: '#2563eb',
  showBadge: true,
  showNameTag: true,
};

export interface UniformDescriptor {
  id: UniformOptionId;
  label: string;
  description: string;
  topColor: string;
  bottomColor: string;
  hasTudung?: boolean;
  isPinafore?: boolean;
  isKurung?: boolean;
  isShorts?: boolean;
  isSport?: boolean;
}

export const MALAYSIA_UNIFORMS: UniformDescriptor[] = [
  {
    id: 'A',
    label: 'Pilihan A — Kemeja & Seluar Panjang',
    description: 'Kemeja putih berlengan pendek dan seluar panjang biru gelap.',
    topColor: '#f8fafc',
    bottomColor: '#1e3a5f',
  },
  {
    id: 'B',
    label: 'Pilihan B — Kemeja & Seluar Pendek',
    description: 'Kemeja putih dan seluar pendek biru gelap sekolah rendah.',
    topColor: '#f8fafc',
    bottomColor: '#1e3a5f',
    isShorts: true,
  },
  {
    id: 'C',
    label: 'Pilihan C — Blaus & Pinafore',
    description: 'Blaus putih dan gaun pinafore biru gelap.',
    topColor: '#f8fafc',
    bottomColor: '#1e3a5f',
    isPinafore: true,
  },
  {
    id: 'D',
    label: 'Pilihan D — Baju Kurung & Kain',
    description: 'Baju kurung putih dan kain biru gelap tradisional sekolah.',
    topColor: '#f8fafc',
    bottomColor: '#1e3a5f',
    isKurung: true,
  },
  {
    id: 'E',
    label: 'Pilihan E — Baju Kurung & Tudung',
    description: 'Baju kurung putih lengkap dengan tudung putih dan kain biru gelap.',
    topColor: '#f8fafc',
    bottomColor: '#1e3a5f',
    isKurung: true,
    hasTudung: true,
  },
  {
    id: 'F',
    label: 'Pilihan F — Pakaian Sukan Sekolah',
    description: 'Kemeja-T sukan sekolah ceria dan seluar trek biru gelap.',
    topColor: '#0284c7',
    bottomColor: '#0f172a',
    isSport: true,
  },
];

export const SKIN_TONES = [
  { label: 'Cerah', hex: '#f6d2b5' },
  { label: 'Sawo Cerah', hex: '#eab68c' },
  { label: 'Sawo Matang', hex: '#c88c5d' },
  { label: 'Kuning Langsat', hex: '#dfae7b' },
  { label: 'Coklat Manis', hex: '#9c6644' },
  { label: 'Gelap Hangat', hex: '#6f452d' },
];

export const HAIR_COLORS = [
  { label: 'Hitam Pekat', hex: '#18181b' },
  { label: 'Coklat Gelap', hex: '#3f2a1d' },
  { label: 'Perang Hangat', hex: '#713f12' },
  { label: 'Kelabu Perak', hex: '#64748b' },
  { label: 'Biru Nilam', hex: '#1d4ed8' },
];

export const EYE_COLORS = [
  { label: 'Coklat Gelap', hex: '#2c1e16' },
  { label: 'Hitam', hex: '#09090b' },
  { label: 'Perang Madu', hex: '#78350f' },
  { label: 'Biru Laut', hex: '#0369a1' },
  { label: 'Hijau Zamrud', hex: '#15803d' },
];

export const BACKPACK_COLORS = [
  { label: 'Biru Sekolah', hex: '#2563eb' },
  { label: 'Merah Ceria', hex: '#dc2626' },
  { label: 'Hijau Rimba', hex: '#16a34a' },
  { label: 'Kuning Diraja', hex: '#d97706' },
  { label: 'Ungu Lavender', hex: '#7c3aed' },
];

export const BADGE_CATALOG: BadgeInfo[] = [
  {
    id: 'avatar_pereka',
    title: 'Pereka Avatar Cilik',
    description: 'Berjaya mencipta dan menyimpan watak 3D sendiri.',
    criteria: 'Simpan avatar pertama anda',
    color: '#0284c7',
  },
  {
    id: 'peneroka_kampung',
    title: 'Peneroka Kampung Bahasa',
    description: 'Menyelesaikan sekurang-kurangnya 3 stesen di Kampung Simpulan Bahasa.',
    criteria: '3 stesen Simpulan Bahasa selesai',
    color: '#16a34a',
  },
  {
    id: 'penjaga_hutan',
    title: 'Penjaga Hutan Perumpamaan',
    description: 'Menguasai perumpamaan di Hutan Perumpamaan.',
    criteria: '2 stesen Perumpamaan selesai',
    color: '#0d9488',
  },
  {
    id: 'pendeta_istana',
    title: 'Cendekiawan Istana',
    description: 'Menyelesaikan cabaran Pepatah dan Bidalan di Istana Melayu.',
    criteria: '2 stesen Pepatah & Bidalan selesai',
    color: '#d97706',
  },
  {
    id: 'bintang_muzik',
    title: 'Bintang Taman Lagu',
    description: 'Menari dan menjawab kuiz di Zon Muzik Blockverse.',
    criteria: 'Sertai zon muzik & jawab soalan',
    color: '#9333ea',
  },
  {
    id: 'juara_kumpulan',
    title: 'Sahabat Muafakat',
    description: 'Menyertai misi berkumpulan bersama rakan sekelas.',
    criteria: 'Selesaikan misi berkumpulan',
    color: '#e11d48',
  },
];
