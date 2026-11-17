import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { Check, RotateCw, Save, Sparkles, X } from 'lucide-react';
import {
  BACKPACK_COLORS,
  EYE_COLORS,
  HAIR_COLORS,
  MALAYSIA_UNIFORMS,
  SKIN_TONES,
} from '../data/curriculumDefaults';
import { playBlockSound } from '../services/audioSynth';
import {
  afterDraw,
  createStudioRenderer,
  detectSoftwareWebGL,
  setupRoomEnvironment,
} from '../three/rendererUtils';
import { animateAvatarRig, AvatarRig, buildVoxelAvatar } from '../three/voxelAvatar';
import {
  AccessoryType,
  AvatarAnimState,
  AvatarConfig,
  CustomUniformPreset,
  EyeShape,
  FaceShape,
  FacialExpression,
  HairStyle,
  HeadShape,
} from '../types/blockverse';

interface AvatarCreatorProps {
  initialAvatar: AvatarConfig;
  customUniforms?: CustomUniformPreset[];
  isInsideStudio?: boolean;
  onSave: (avatar: AvatarConfig) => Promise<void>;
  onClose: () => void;
}

const ANIM_OPTIONS: { id: AvatarAnimState; label: string }[] = [
  { id: 'idle', label: 'Berdiri' },
  { id: 'walk', label: 'Berjalan' },
  { id: 'run', label: 'Berlari' },
  { id: 'jump', label: 'Melompat' },
  { id: 'sit', label: 'Duduk' },
  { id: 'wave', label: 'Melambai' },
  { id: 'dance', label: 'Menari' },
  { id: 'raise_hand', label: 'Angkat Tangan' },
  { id: 'hold_book', label: 'Pegang Buku' },
  { id: 'celebrate', label: 'Raikan Kejayaan' },
];

export const AvatarCreator: React.FC<AvatarCreatorProps> = ({
  initialAvatar,
  customUniforms = [],
  isInsideStudio = false,
  onSave,
  onClose,
}) => {
  const [avatar, setAvatar] = useState<AvatarConfig>(initialAvatar);
  const [previewAnim, setPreviewAnim] = useState<AvatarAnimState>('idle');
  const [activeTab, setActiveTab] = useState<'muka' | 'seragam' | 'aksesori'>('seragam');
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const previewRef = useRef<HTMLDivElement | null>(null);
  const rigRef = useRef<AvatarRig | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const animRef = useRef<AvatarAnimState>('idle');
  animRef.current = previewAnim;
  const yawRef = useRef(0.35);

  // Setup isolated 3D Studio Viewport
  useEffect(() => {
    const container = previewRef.current;
    if (!container) return;

    const isSoftwareGl = detectSoftwareWebGL();
    const renderer = createStudioRenderer(isSoftwareGl);
    renderer.setSize(container.clientWidth || 420, container.clientHeight || 480);
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#e0f2fe');
    sceneRef.current = scene;
    const envTex = setupRoomEnvironment(renderer, scene);

    const camera = new THREE.PerspectiveCamera(
      42,
      (container.clientWidth || 420) / (container.clientHeight || 480),
      0.1,
      50
    );
    camera.position.set(0, 1.55, 4.3);
    camera.lookAt(0, 1.05, 0);

    const hemi = new THREE.HemisphereLight('#ffffff', '#94a3b8', 0.9);
    scene.add(hemi);
    const keyLight = new THREE.DirectionalLight('#fffbeb', 1.4);
    keyLight.position.set(3, 5, 4);
    keyLight.castShadow = !isSoftwareGl;
    scene.add(keyLight);

    // Studio Podium & Virtual Mirror Frame
    const podium = new THREE.Mesh(
      new THREE.CylinderGeometry(1.15, 1.25, 0.24, 24),
      new THREE.MeshStandardMaterial({ color: '#0284c7', roughness: 0.35, metalness: 0.2 })
    );
    podium.position.y = -0.12;
    podium.receiveShadow = true;
    scene.add(podium);

    const mirrorBack = new THREE.Mesh(
      new THREE.BoxGeometry(2.5, 2.8, 0.12),
      new THREE.MeshStandardMaterial({ color: '#bae6fd', metalness: 0.85, roughness: 0.1 })
    );
    mirrorBack.position.set(0, 1.35, -1.25);
    const mirrorFrame = new THREE.Mesh(
      new THREE.BoxGeometry(2.75, 3.05, 0.08),
      new THREE.MeshStandardMaterial({ color: '#f59e0b', metalness: 0.7, roughness: 0.25 })
    );
    mirrorFrame.position.set(0, 1.35, -1.32);
    scene.add(mirrorBack, mirrorFrame);

    const rig = buildVoxelAvatar(avatar);
    scene.add(rig.root);
    rigRef.current = rig;

    let dragging = false;
    let lastX = 0;
    const el = renderer.domElement;

    const onDown = (e: PointerEvent) => {
      dragging = true;
      lastX = e.clientX;
    };
    const onMove = (e: PointerEvent) => {
      if (!dragging) return;
      const dx = e.clientX - lastX;
      lastX = e.clientX;
      yawRef.current += dx * 0.012;
    };
    const onUp = () => {
      dragging = false;
    };
    const onResize = () => {
      if (!container) return;
      const w = container.clientWidth || 420;
      const h = container.clientHeight || 480;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    el.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('resize', onResize);

    const clock = new THREE.Clock();
    let frameId = 0;
    let disposed = false;

    const tick = () => {
      if (disposed) return;
      const elapsed = clock.getElapsedTime();
      clock.getDelta();
      if (rigRef.current) {
        rigRef.current.root.rotation.y = yawRef.current;
        animateAvatarRig(rigRef.current, animRef.current, elapsed);
      }
      renderer.render(scene, camera);
      if (isSoftwareGl) {
        afterDraw(renderer, tick, (id) => {
          frameId = id;
        });
      } else {
        frameId = requestAnimationFrame(tick);
      }
    };
    tick();

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      el.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('resize', onResize);
      envTex.dispose();
      renderer.dispose();
      if (el.parentNode === container) container.removeChild(el);
    };
  }, []);

  // Live rebuild avatar whenever user customizes any trait
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    if (rigRef.current) {
      scene.remove(rigRef.current.root);
    }
    const nextRig = buildVoxelAvatar(avatar);
    nextRig.root.rotation.y = yawRef.current;
    scene.add(nextRig.root);
    rigRef.current = nextRig;
  }, [avatar]);

  const handleSave = async () => {
    setSaving(true);
    setStatusMsg(null);
    try {
      await onSave(avatar);
      playBlockSound('success');
      setStatusMsg('Avatar berjaya disimpan ke awan dan sedia digunakan pada semua peranti!');
    } catch (err) {
      setStatusMsg(err instanceof Error ? err.message : 'Gagal menyimpan avatar.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-white w-full max-w-6xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col lg:flex-row max-h-[94vh]">
        {/* Left: Live 360° 3D Studio Viewport */}
        <div className="lg:w-[44%] bg-sky-50 border-b lg:border-b-0 lg:border-r border-slate-200 flex flex-col">
          <div className="px-5 py-4 border-b border-sky-200 flex items-center justify-between bg-white">
            <div>
              <h2 className="font-display text-xl font-bold text-slate-900">
                {isInsideStudio ? 'Studio Avatar Sekolah Malaysia' : 'Cipta Watak Saya'}
              </h2>
              <p className="text-xs text-slate-500">Seret watak untuk putaran 360 darjah secara langsung</p>
            </div>
            <button
              type="button"
              onClick={() => {
                yawRef.current += Math.PI / 2;
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-sky-100 text-sky-900 hover:bg-sky-200 whitespace-nowrap"
            >
              <RotateCw className="w-3.5 h-3.5" />
              Putar 90°
            </button>
          </div>

          <div ref={previewRef} className="w-full h-72 sm:h-96 lg:flex-1 cursor-grab active:cursor-grabbing" />

          {/* Live Animation Tester */}
          <div className="p-3 bg-white border-t border-slate-200">
            <div className="text-xs font-semibold text-slate-600 mb-2">Uji Animasi Watak:</div>
            <div className="flex flex-wrap gap-1.5">
              {ANIM_OPTIONS.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setPreviewAnim(a.id)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                    previewAnim === a.id
                      ? 'bg-sky-600 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {a.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Customization Controls */}
        <div className="lg:w-[56%] flex flex-col max-h-[94vh]">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setActiveTab('seragam')}
                className={`px-3.5 py-2 text-xs sm:text-sm font-semibold rounded-lg whitespace-nowrap ${
                  activeTab === 'seragam' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
                }`}
              >
                Seragam Sekolah
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('muka')}
                className={`px-3.5 py-2 text-xs sm:text-sm font-semibold rounded-lg whitespace-nowrap ${
                  activeTab === 'muka' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
                }`}
              >
                Muka & Rambut
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('aksesori')}
                className={`px-3.5 py-2 text-xs sm:text-sm font-semibold rounded-lg whitespace-nowrap ${
                  activeTab === 'aksesori' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
                }`}
              >
                Beg & Aksesori
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Tutup Studio Avatar"
              className="p-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 overflow-y-auto flex-1 space-y-5">
            {/* Avatar Name */}
            <div>
              <label className="block text-sm font-semibold text-slate-800 mb-1.5">
                Nama Avatar (Dipaparkan pada Tanda Nama & Dunia 3D)
              </label>
              <input
                type="text"
                maxLength={24}
                value={avatar.avatarName}
                onChange={(e) => setAvatar({ ...avatar, avatarName: e.target.value })}
                placeholder="Contoh: Amir Hakim"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>

            {activeTab === 'seragam' && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-800 mb-2">
                    Pilihan Pakaian Seragam Sekolah Rendah Malaysia (Bebas Dipilih)
                  </h3>
                  <div className="grid sm:grid-cols-2 gap-2.5">
                    {MALAYSIA_UNIFORMS.map((u) => {
                      const active = avatar.uniformOption === u.id && !avatar.customTopColor;
                      return (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() =>
                            setAvatar({
                              ...avatar,
                              uniformOption: u.id,
                              customTopColor: undefined,
                              customBottomColor: undefined,
                            })
                          }
                          className={`text-left p-3 rounded-xl border transition-all ${
                            active
                              ? 'border-sky-600 bg-sky-50 ring-2 ring-sky-200'
                              : 'border-slate-200 hover:border-slate-300 bg-white'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold text-sm text-slate-900">{u.label}</span>
                            {active && <Check className="w-4 h-4 text-sky-600 shrink-0" />}
                          </div>
                          <p className="text-xs text-slate-600 mt-1">{u.description}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {customUniforms.length > 0 && (
                  <div>
                    <h4 className="text-sm font-bold text-slate-800 mb-2">
                      Pakaian Khas Tambahan Guru
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {customUniforms.map((cu) => (
                        <button
                          key={cu.id}
                          type="button"
                          onClick={() =>
                            setAvatar({
                              ...avatar,
                              customTopColor: cu.topColor,
                              customBottomColor: cu.bottomColor,
                            })
                          }
                          className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold flex items-center gap-2 hover:bg-slate-50"
                        >
                          <span
                            className="w-4 h-4 rounded-full border border-slate-300"
                            style={{ backgroundColor: cu.topColor }}
                          />
                          {cu.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid sm:grid-cols-2 gap-4 pt-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Pilihan Kasut Sekolah
                    </label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setAvatar({ ...avatar, shoeStyle: 'kasut_hitam' })}
                        className={`flex-1 py-2 px-3 rounded-xl border text-xs font-semibold ${
                          avatar.shoeStyle === 'kasut_hitam'
                            ? 'bg-slate-900 text-white border-slate-900'
                            : 'bg-white text-slate-700 border-slate-200'
                        }`}
                      >
                        Kasut Hitam
                      </button>
                      <button
                        type="button"
                        onClick={() => setAvatar({ ...avatar, shoeStyle: 'kasut_putih' })}
                        className={`flex-1 py-2 px-3 rounded-xl border text-xs font-semibold ${
                          avatar.shoeStyle === 'kasut_putih'
                            ? 'bg-sky-600 text-white border-sky-600'
                            : 'bg-white text-slate-700 border-slate-200'
                        }`}
                      >
                        Kasut Putih
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-col justify-end gap-2">
                    <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={avatar.socksVisible}
                        onChange={(e) => setAvatar({ ...avatar, socksVisible: e.target.checked })}
                        className="rounded text-sky-600"
                      />
                      Pakai Stoking Sekolah
                    </label>
                    <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={avatar.showBadge}
                        onChange={(e) => setAvatar({ ...avatar, showBadge: e.target.checked })}
                        className="rounded text-sky-600"
                      />
                      Lencana Sekolah Generik
                    </label>
                    <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={avatar.showNameTag}
                        onChange={(e) => setAvatar({ ...avatar, showNameTag: e.target.checked })}
                        className="rounded text-sky-600"
                      />
                      Papar Tanda Nama Murid
                    </label>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'muka' && (
              <div className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Bentuk Muka
                    </label>
                    <select
                      value={avatar.faceShape}
                      onChange={(e) => setAvatar({ ...avatar, faceShape: e.target.value as FaceShape })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                    >
                      <option value="bulat">Bulat Voxel</option>
                      <option value="segi_empat">Segi Empat Klasik</option>
                      <option value="bujur">Bujur Comel</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Bentuk Kepala
                    </label>
                    <select
                      value={avatar.headShape}
                      onChange={(e) => setAvatar({ ...avatar, headShape: e.target.value as HeadShape })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                    >
                      <option value="standard">Standard Blok</option>
                      <option value="lebar">Lebar Ceria</option>
                      <option value="runcing">Runcing Halus</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Warna Kulit
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {SKIN_TONES.map((st) => (
                      <button
                        key={st.hex}
                        type="button"
                        onClick={() => setAvatar({ ...avatar, skinColor: st.hex })}
                        className={`px-3 py-1.5 rounded-xl border text-xs font-medium flex items-center gap-2 ${
                          avatar.skinColor === st.hex
                            ? 'border-sky-600 bg-sky-50'
                            : 'border-slate-200'
                        }`}
                      >
                        <span
                          className="w-4 h-4 rounded-full border border-slate-300"
                          style={{ backgroundColor: st.hex }}
                        />
                        {st.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Bentuk Mata
                    </label>
                    <select
                      value={avatar.eyeShape}
                      onChange={(e) => setAvatar({ ...avatar, eyeShape: e.target.value as EyeShape })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                    >
                      <option value="bulat">Bulat Ceria</option>
                      <option value="berkilau">Berkilau</option>
                      <option value="bintang">Bintang</option>
                      <option value="tenang">Tenang</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Ekspresi Muka
                    </label>
                    <select
                      value={avatar.expression}
                      onChange={(e) =>
                        setAvatar({ ...avatar, expression: e.target.value as FacialExpression })
                      }
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                    >
                      <option value="senyum">Senyum Mesra</option>
                      <option value="gembira">Gembira Lebar</option>
                      <option value="bersemangat">Bersemangat</option>
                      <option value="tenang">Tenang</option>
                      <option value="teruja">Teruja</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Warna Mata
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {EYE_COLORS.map((ec) => (
                      <button
                        key={ec.hex}
                        type="button"
                        onClick={() => setAvatar({ ...avatar, eyeColor: ec.hex })}
                        className={`px-3 py-1.5 rounded-xl border text-xs font-medium flex items-center gap-2 ${
                          avatar.eyeColor === ec.hex ? 'border-sky-600 bg-sky-50' : 'border-slate-200'
                        }`}
                      >
                        <span className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: ec.hex }} />
                        {ec.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Gaya Rambut
                    </label>
                    <select
                      value={avatar.hairStyle}
                      onChange={(e) => setAvatar({ ...avatar, hairStyle: e.target.value as HairStyle })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                    >
                      <option value="pendek_kemas">Pendek Kemas</option>
                      <option value="belah_tepi">Belah Tepi</option>
                      <option value="kerinting">Kerinting Ceria</option>
                      <option value="panjang">Rambut Panjang</option>
                      <option value="sanggul">Sanggul</option>
                      <option value="ekor_kuda">Ekor Kuda</option>
                      <option value="songkok">Kemas Bersongkok</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Warna Rambut
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {HAIR_COLORS.map((hc) => (
                        <button
                          key={hc.hex}
                          type="button"
                          onClick={() => setAvatar({ ...avatar, hairColor: hc.hex })}
                          title={hc.label}
                          className={`w-8 h-8 rounded-lg border-2 ${
                            avatar.hairColor === hc.hex ? 'border-sky-600 scale-105' : 'border-slate-200'
                          }`}
                          style={{ backgroundColor: hc.hex }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'aksesori' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Aksesori Watak
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {(
                      [
                        { id: 'tiada', label: 'Tiada Aksesori' },
                        { id: 'cermin_mata', label: 'Cermin Mata' },
                        { id: 'songkok', label: 'Songkok Hitam' },
                        { id: 'cekak_rambut', label: 'Cekak Rambut' },
                        { id: 'jam_tangan', label: 'Jam Tangan' },
                      ] as { id: AccessoryType; label: string }[]
                    ).map((acc) => (
                      <button
                        key={acc.id}
                        type="button"
                        onClick={() => setAvatar({ ...avatar, accessory: acc.id })}
                        className={`py-2.5 px-3 rounded-xl border text-xs font-semibold ${
                          avatar.accessory === acc.id
                            ? 'border-sky-600 bg-sky-50 text-sky-900'
                            : 'border-slate-200 text-slate-700'
                        }`}
                      >
                        {acc.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Warna Beg Sekolah
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {BACKPACK_COLORS.map((bc) => (
                      <button
                        key={bc.hex}
                        type="button"
                        onClick={() => setAvatar({ ...avatar, backpackColor: bc.hex })}
                        className={`px-3 py-2 rounded-xl border text-xs font-semibold flex items-center gap-2 ${
                          avatar.backpackColor === bc.hex
                            ? 'border-sky-600 bg-sky-50'
                            : 'border-slate-200'
                        }`}
                      >
                        <span className="w-4 h-4 rounded" style={{ backgroundColor: bc.hex }} />
                        {bc.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {statusMsg && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-medium">
                {statusMsg}
              </div>
            )}
          </div>

          <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-300 text-sm font-semibold text-slate-700 hover:bg-slate-100 whitespace-nowrap"
            >
              Kembali
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={handleSave}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-sky-600 text-white text-sm font-bold hover:bg-sky-700 disabled:opacity-60 whitespace-nowrap"
            >
              {saving ? (
                <>Menyimpan...</>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Simpan Avatar ke Akaun
                  <Sparkles className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
