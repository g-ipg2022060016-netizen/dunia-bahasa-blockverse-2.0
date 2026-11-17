export type UserRole = 'guru' | 'murid';

export type UniformOptionId = 'A' | 'B' | 'C' | 'D' | 'E' | 'F';

export type FaceShape = 'bulat' | 'segi_empat' | 'bujur';
export type HeadShape = 'standard' | 'lebar' | 'runcing';
export type EyeShape = 'bulat' | 'bintang' | 'tenang' | 'berkilau';
export type HairStyle =
  | 'pendek_kemas'
  | 'belah_tepi'
  | 'kerinting'
  | 'sanggul'
  | 'ekor_kuda'
  | 'panjang'
  | 'songkok';
export type FacialExpression = 'senyum' | 'gembira' | 'bersemangat' | 'tenang' | 'teruja';
export type AccessoryType = 'tiada' | 'cermin_mata' | 'songkok' | 'cekak_rambut' | 'jam_tangan';
export type ShoeStyle = 'kasut_hitam' | 'kasut_putih';

export type AvatarAnimState =
  | 'idle'
  | 'walk'
  | 'run'
  | 'jump'
  | 'sit'
  | 'wave'
  | 'dance'
  | 'raise_hand'
  | 'hold_book'
  | 'celebrate';

export interface AvatarConfig {
  avatarName: string;
  faceShape: FaceShape;
  headShape: HeadShape;
  skinColor: string;
  eyeColor: string;
  eyeShape: EyeShape;
  hairStyle: HairStyle;
  hairColor: string;
  expression: FacialExpression;
  accessory: AccessoryType;
  uniformOption: UniformOptionId;
  customTopColor?: string;
  customBottomColor?: string;
  shoeStyle: ShoeStyle;
  socksVisible: boolean;
  backpackColor: string;
  showBadge: boolean;
  showNameTag: boolean;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  teacherCode?: string;
  avatar: AvatarConfig;
  badges: string[];
  totalStars: number;
  createdAt: string;
}

export type BlockType =
  | 'grass'
  | 'dirt'
  | 'stone'
  | 'wood'
  | 'plank'
  | 'attap'
  | 'brick'
  | 'white_wall'
  | 'blue_roof'
  | 'gold'
  | 'water'
  | 'sand'
  | 'leaves'
  | 'flower_red'
  | 'flower_yellow'
  | 'road'
  | 'bridge'
  | 'crystal'
  | 'glass';

export interface VoxelBlock {
  id: string;
  x: number;
  y: number;
  z: number;
  type: BlockType;
  tint?: string;
}

export type StructureKind =
  | 'rumah_kampung'
  | 'sekolah'
  | 'studio_avatar'
  | 'istana'
  | 'taman_permainan'
  | 'pulau_terapung'
  | 'pokok'
  | 'haiwan_kucing'
  | 'haiwan_ayam'
  | 'haiwan_rusa'
  | 'jambatan'
  | 'pondok_belajar';

export interface WorldStructure {
  id: string;
  kind: StructureKind;
  name: string;
  x: number;
  y: number;
  z: number;
  rotationY?: number;
  accentColor?: string;
  stationId?: string;
}

export interface WorldNPC {
  id: string;
  name: string;
  roleTitle: string;
  x: number;
  y: number;
  z: number;
  patrolRadius: number;
  shirtColor: string;
  skinColor: string;
  dialogue: string;
  stationId?: string;
}

export interface WorldSign {
  id: string;
  title: string;
  message: string;
  x: number;
  y: number;
  z: number;
}

export type LanguageCategory =
  | 'Simpulan Bahasa'
  | 'Perumpamaan'
  | 'Pepatah'
  | 'Bidalan';

export type ActivityType =
  | 'situasi_kefahaman'
  | 'padanan'
  | 'susun_ayat'
  | 'teka_teki'
  | 'cari_objek'
  | 'misi_kumpulan';

export interface QuizQuestion {
  id: string;
  activityType: ActivityType;
  prompt: string;
  options: string[];
  correctAnswer: string;
  scrambledWords?: string[];
  explanation: string;
  points: number;
}

export interface LearningStation {
  id: string;
  title: string;
  expression: string;
  category: LanguageCategory;
  meaning: string;
  exampleSentence: string;
  teacherNotes: string;
  audioUrl?: string;
  videoUrl?: string;
  imageUrl?: string;
  pdfUrl?: string;
  externalLink?: string;
  x: number;
  y: number;
  z: number;
  hiddenCluePos?: { x: number; y: number; z: number; clueText: string };
  questions: QuizQuestion[];
}

export interface MusicZone {
  id: string;
  title: string;
  artistOrTeacher: string;
  x: number;
  y: number;
  z: number;
  radius: number;
  audioUrl?: string;
  synthMelodyId?: 'ceria_kampung' | 'irama_pantun' | 'lagu_ringan_tulang';
  lyrics: string[];
  isBackgroundMusic: boolean;
  volume: number;
  questions: QuizQuestion[];
}

export interface CustomUniformPreset {
  id: string;
  name: string;
  topColor: string;
  bottomColor: string;
}

export interface WorldSnapshot {
  id: string;
  savedAt: string;
  note: string;
  blocks: VoxelBlock[];
  structures: WorldStructure[];
  npcs: WorldNPC[];
  stations: LearningStation[];
  musicZones: MusicZone[];
  signs: WorldSign[];
}

export type WorldTheme = 'kampung' | 'hutan' | 'istana' | 'kreatif';

export interface WorldData {
  id: string;
  worldCode: string;
  title: string;
  description: string;
  worldType: WorldTheme;
  ownerId: string;
  ownerName: string;
  teacherCode: string;
  isPublished: boolean;
  allowStudentBuild: boolean;
  maxPlayers: number;
  dayTimeMode: 'siang' | 'senja' | 'malam' | 'kitaran';
  blocks: VoxelBlock[];
  structures: WorldStructure[];
  npcs: WorldNPC[];
  stations: LearningStation[];
  musicZones: MusicZone[];
  signs: WorldSign[];
  customUniforms: CustomUniformPreset[];
  snapshots: WorldSnapshot[];
  version: number;
  updatedAt: string;
}

export interface WorldSummary {
  id: string;
  worldCode: string;
  title: string;
  description: string;
  worldType: WorldTheme;
  ownerName: string;
  teacherCode: string;
  isPublished: boolean;
  allowStudentBuild: boolean;
  maxPlayers: number;
  stationCount: number;
  musicCount: number;
  updatedAt: string;
}

export interface BuildingTemplate {
  id: string;
  ownerId: string;
  name: string;
  category: string;
  blocks: VoxelBlock[];
  structures: WorldStructure[];
  createdAt: string;
}

export interface AnswerAttemptRecord {
  questionId: string;
  questionPrompt: string;
  selectedAnswer: string;
  isCorrect: boolean;
  timestamp: string;
}

export type MasteryLevel =
  | 'Belum Mula'
  | 'Dalam Latihan'
  | 'Menguasai'
  | 'Cemerlang';

export interface StudentProgressRecord {
  id: string;
  studentId: string;
  studentName: string;
  avatarSummary: {
    uniformOption: UniformOptionId;
    skinColor: string;
    hairColor: string;
    avatarName: string;
  };
  worldId: string;
  worldCode: string;
  worldTitle: string;
  stationId: string;
  stationTitle: string;
  expression: string;
  category: LanguageCategory;
  score: number;
  maxScore: number;
  attempts: number;
  wrongAttempts: number;
  completed: boolean;
  masteryLevel: MasteryLevel;
  timeSpentSeconds: number;
  unmasteredQuestions: string[];
  history: AnswerAttemptRecord[];
  updatedAt: string;
}

export interface RemotePlayerState {
  playerId: string;
  name: string;
  role: UserRole;
  avatar: AvatarConfig;
  x: number;
  y: number;
  z: number;
  yaw: number;
  animState: AvatarAnimState;
  emoteText?: string;
  updatedAt: number;
}

export interface GroupQuestState {
  worldCode: string;
  questId: string;
  title: string;
  targetCount: number;
  collectedBy: Record<string, string>; // playerId -> playerName
  completed: boolean;
}

export interface BadgeInfo {
  id: string;
  title: string;
  description: string;
  criteria: string;
  color: string;
}
