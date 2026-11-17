import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { WorldData } from '../types/blockverse';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabase: SupabaseClient | null =
  SUPABASE_URL && SUPABASE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_KEY, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
        },
        realtime: {
          params: {
            eventsPerSecond: 12,
          },
        },
      })
    : null;

export function isSupabaseEnabled(): boolean {
  return supabase !== null;
}

export interface SupabaseWorldRow {
  id: string;
  world_code: string;
  title: string;
  description: string;
  world_type: WorldData['worldType'];
  owner_id: string | null;
  owner_name: string;
  teacher_code: string;
  is_published: boolean;
  allow_student_build: boolean;
  max_players: number;
  day_time_mode: WorldData['dayTimeMode'];
  blocks: WorldData['blocks'];
  structures: WorldData['structures'];
  npcs: WorldData['npcs'];
  stations: WorldData['stations'];
  music_zones: WorldData['musicZones'];
  signs: WorldData['signs'];
  custom_uniforms: WorldData['customUniforms'];
  snapshots: WorldData['snapshots'];
  version: number;
  updated_at: string;
}

export function mapRowToWorld(row: SupabaseWorldRow): WorldData {
  return {
    id: row.id,
    worldCode: row.world_code,
    title: row.title,
    description: row.description || '',
    worldType: row.world_type,
    ownerId: row.owner_id || '',
    ownerName: row.owner_name || 'Guru Blockverse',
    teacherCode: row.teacher_code || 'GURU-0001',
    isPublished: Boolean(row.is_published),
    allowStudentBuild: Boolean(row.allow_student_build),
    maxPlayers: Number(row.max_players || 25),
    dayTimeMode: row.day_time_mode || 'siang',
    blocks: Array.isArray(row.blocks) ? row.blocks : [],
    structures: Array.isArray(row.structures) ? row.structures : [],
    npcs: Array.isArray(row.npcs) ? row.npcs : [],
    stations: Array.isArray(row.stations) ? row.stations : [],
    musicZones: Array.isArray(row.music_zones) ? row.music_zones : [],
    signs: Array.isArray(row.signs) ? row.signs : [],
    customUniforms: Array.isArray(row.custom_uniforms) ? row.custom_uniforms : [],
    snapshots: Array.isArray(row.snapshots) ? row.snapshots : [],
    version: Number(row.version || 1),
    updatedAt: row.updated_at || new Date().toISOString(),
  };
}

export function mapWorldToRow(w: WorldData): SupabaseWorldRow {
  return {
    id: w.id,
    world_code: w.worldCode,
    title: w.title,
    description: w.description,
    world_type: w.worldType,
    owner_id: w.ownerId || null,
    owner_name: w.ownerName,
    teacher_code: w.teacherCode,
    is_published: w.isPublished,
    allow_student_build: w.allowStudentBuild,
    max_players: w.maxPlayers,
    day_time_mode: w.dayTimeMode,
    blocks: w.blocks,
    structures: w.structures,
    npcs: w.npcs,
    stations: w.stations,
    music_zones: w.musicZones,
    signs: w.signs,
    custom_uniforms: w.customUniforms,
    snapshots: w.snapshots,
    version: w.version,
    updated_at: w.updatedAt,
  };
}
