import { VoxelBlock, WorldData } from '../types/blockverse';

function makeBlock(
  x: number,
  y: number,
  z: number,
  type: VoxelBlock['type']
): VoxelBlock {
  return { id: `blk_${x}_${y}_${z}`, x, y, z, type };
}

function buildKampungTerrainBlocks(): VoxelBlock[] {
  const blocks: VoxelBlock[] = [];
  for (let z = -20; z <= 20; z++) {
    for (let x = -6; x <= -4; x++) {
      blocks.push(makeBlock(x, 0, z, 'water'));
    }
  }
  for (let z = -1; z <= 1; z++) {
    for (let x = -7; x <= -3; x++) {
      blocks.push(makeBlock(x, 1, z, 'bridge'));
    }
  }
  for (let x = -18; x <= 18; x++) {
    if (x < -7 || x > -3) {
      blocks.push(makeBlock(x, 0, 0, 'road'));
      blocks.push(makeBlock(x, 0, 1, 'road'));
    }
  }
  for (let dx = -2; dx <= 2; dx++) {
    for (let dz = -2; dz <= 2; dz++) {
      if (Math.abs(dx) + Math.abs(dz) <= 3) {
        blocks.push(makeBlock(14 + dx, 10, -14 + dz, 'grass'));
        blocks.push(makeBlock(14 + dx, 9, -14 + dz, 'dirt'));
      }
    }
  }
  blocks.push(makeBlock(14, 11, -14, 'crystal'));
  for (let y = 1; y <= 6; y++) {
    blocks.push(makeBlock(-5, y, -21, 'water'));
    blocks.push(makeBlock(-6, y, -22, 'stone'));
    blocks.push(makeBlock(-5, y, -22, 'stone'));
    blocks.push(makeBlock(-4, y, -22, 'stone'));
  }
  return blocks;
}

const now = new Date().toISOString();

export const DEFAULT_STARTER_WORLDS: WorldData[] = [
  {
    id: 'wld_kampung_01',
    worldCode: 'KAMPUNG01',
    title: 'Kampung Simpulan Bahasa',
    description:
      'Terokai rumah kampung Melayu, Sekolah Kebangsaan, Studio Avatar, dan Taman Lagu untuk menguasai Simpulan Bahasa!',
    worldType: 'kampung',
    ownerId: '',
    ownerName: 'Cikgu Blockverse',
    teacherCode: 'GURU-1001',
    isPublished: true,
    allowStudentBuild: false,
    maxPlayers: 25,
    dayTimeMode: 'siang',
    blocks: buildKampungTerrainBlocks(),
    structures: [
      { id: 'str_studio_avatar', kind: 'studio_avatar', name: 'Studio Avatar Sekolah Malaysia', x: -13, y: 0, z: -8, rotationY: 0 },
      { id: 'str_sekolah', kind: 'sekolah', name: 'Sekolah Kebangsaan Blockverse', x: 0, y: 0, z: -14, rotationY: 0 },
      { id: 'str_taman_permainan', kind: 'taman_permainan', name: 'Taman Permainan Ria', x: -14, y: 0, z: 10, rotationY: 0 },
      { id: 'str_rumah_ringan_tulang', kind: 'rumah_kampung', name: 'Rumah Ringan Tulang', x: 8, y: 0, z: -7, accentColor: '#d97706', stationId: 'st_ringan_tulang' },
      { id: 'str_rumah_anak_emas', kind: 'rumah_kampung', name: 'Rumah Anak Emas', x: 16, y: 0, z: -6, accentColor: '#eab308', stationId: 'st_anak_emas' },
      { id: 'str_rumah_kaki_bangku', kind: 'rumah_kampung', name: 'Rumah Kaki Bangku', x: 8, y: 0, z: 8, accentColor: '#0284c7', stationId: 'st_kaki_bangku' },
      { id: 'str_rumah_mulut_murai', kind: 'rumah_kampung', name: 'Rumah Mulut Murai', x: 16, y: 0, z: 8, accentColor: '#16a34a', stationId: 'st_mulut_murai' },
      { id: 'str_rumah_buah_hati', kind: 'rumah_kampung', name: 'Rumah Buah Hati', x: 24, y: 0, z: -6, accentColor: '#e11d48', stationId: 'st_buah_hati' },
      { id: 'str_rumah_panjang_tangan', kind: 'rumah_kampung', name: 'Rumah Panjang Tangan', x: 24, y: 0, z: 8, accentColor: '#7c3aed', stationId: 'st_panjang_tangan' },
      { id: 'str_pokok_1', kind: 'pokok', name: 'Pokok Rambutan', x: 3, y: 0, z: 5 },
      { id: 'str_pokok_2', kind: 'pokok', name: 'Pokok Mangga', x: -11, y: 0, z: 4 },
      { id: 'str_pokok_3', kind: 'pokok', name: 'Pokok Kelapa', x: 12, y: 0, z: 14 },
      { id: 'str_kucing_1', kind: 'haiwan_kucing', name: 'Si Comel', x: 4, y: 0, z: -4 },
      { id: 'str_ayam_1', kind: 'haiwan_ayam', name: 'Ayam Kampung', x: 12, y: 0, z: 2 },
    ],
    npcs: [
      { id: 'npc_pak_mail', name: 'Pak Mail', roleTitle: 'Ketua Kampung', x: 2, y: 0, z: -3, patrolRadius: 2.5, shirtColor: '#0f766e', skinColor: '#c88c5d', dialogue: 'Selamat datang ke Kampung Simpulan Bahasa! Dekati mana-mana rumah untuk belajar dan selesaikan cabaran bahasa.', stationId: 'st_ringan_tulang' },
      { id: 'npc_cikgu_siti', name: 'Cikgu Siti', roleTitle: 'Guru Bahasa Melayu', x: 0, y: 0, z: -9, patrolRadius: 2, shirtColor: '#2563eb', skinColor: '#eab68c', dialogue: 'Ingat ya anak-anak, setiap simpulan bahasa membawa makna kiasan yang indah dalam pertuturan harian kita.', stationId: 'st_anak_emas' },
    ],
    signs: [
      { id: 'sign_aluan', title: 'Papan Tanda Kampung Bahasa', message: 'Gunakan WASD untuk berjalan, Space untuk melompat, dan E untuk berinteraksi dengan rumah atau watak NPC!', x: -2, y: 0, z: 2 },
      { id: 'sign_studio', title: 'Arah ke Studio Avatar', message: 'Melintasi jambatan kayu di sebelah barat untuk menukar pakaian seragam sekolah di Studio Avatar Sekolah Malaysia.', x: -8, y: 0, z: -3 },
    ],
    stations: [
      {
        id: 'st_ringan_tulang',
        title: 'Rumah Ringan Tulang',
        expression: 'Ringan tulang',
        category: 'Simpulan Bahasa',
        meaning: 'Rajin membantu atau bekerja tanpa disuruh.',
        exampleSentence: 'Amir ringan tulang membantu ibunya mengemas ruang tamu setiap pagi hujung minggu.',
        teacherNotes: 'Simpulan bahasa ini menggambarkan sifat terpuji murid yang suka menolong guru, ibu bapa, dan rakan sebaya.',
        x: 8,
        y: 0,
        z: -4,
        hiddenCluePos: { x: 11, y: 0, z: -9, clueText: 'Petunjuk Tersembunyi: Penyapu lidi di tepi tangga rumah melambangkan kerajinan!' },
        questions: [
          {
            id: 'q_rt_1',
            activityType: 'situasi_kefahaman',
            prompt: 'Haziq ternampak Cikgu Nora membawa banyak buku latihan yang berat ke bilik guru. Haziq terus menawarkan diri untuk menolong. Apakah simpulan bahasa yang paling sesuai untuk Haziq?',
            options: ['Ringan tulang', 'Berat tulang', 'Kaki bangku', 'Panjang tangan'],
            correctAnswer: 'Ringan tulang',
            explanation: 'Haziq rajin dan cepat membantu orang lain, jadi dia disifatkan sebagai seorang yang ringan tulang.',
            points: 20,
          },
          {
            id: 'q_rt_2',
            activityType: 'susun_ayat',
            prompt: 'Susun perkataan berikut menjadi ayat yang lengkap menggunakan simpulan bahasa:',
            options: [],
            scrambledWords: ['membantu', 'Siti', 'tulang', 'jiran', 'ringan', 'mengemas', 'halaman.'],
            correctAnswer: 'Siti ringan tulang membantu jiran mengemas halaman.',
            explanation: 'Subjek (Siti) diikuti simpulan bahasa (ringan tulang) dan kata kerja (membantu jiran mengemas halaman).',
            points: 25,
          },
        ],
      },
      {
        id: 'st_anak_emas',
        title: 'Rumah Anak Emas',
        expression: 'Anak emas',
        category: 'Simpulan Bahasa',
        meaning: 'Anak atau pekerja yang sangat disayangi oleh ibu bapa atau majikan.',
        exampleSentence: 'Adik bongsu menjadi anak emas keluarga kerana sifatnya yang sopan dan mendengar kata.',
        teacherNotes: 'Perhatian: "Anak emas" bukan bermaksud anak yang diperbuat daripada emas, sebaliknya membawa maksud kiasan orang yang paling disayangi.',
        x: 16,
        y: 0,
        z: -3,
        questions: [
          {
            id: 'q_ae_1',
            activityType: 'situasi_kefahaman',
            prompt: 'Farah sentiasa menjaga tutur kata, membantu ibu bapa, dan berjaya dalam pelajaran sehingga menjadi kesayangan neneknya. Farah digelar sebagai...',
            options: ['Anak emas', 'Buah mulut', 'Kaki ayam', 'Telinga nipis'],
            correctAnswer: 'Anak emas',
            explanation: '"Anak emas" bermaksud seseorang yang amat disayangi oleh ibu bapa, keluarga, atau gurunya.',
            points: 20,
          },
        ],
      },
      {
        id: 'st_kaki_bangku',
        title: 'Rumah Kaki Bangku',
        expression: 'Kaki bangku',
        category: 'Simpulan Bahasa',
        meaning: 'Orang yang tidak pandai atau tidak tahu bermain bola sepak dan sukan padang.',
        exampleSentence: 'Walaupun Danish kaki bangku, dia tetap bersorak memberi semangat kepada pasukan kelasnya.',
        teacherNotes: 'Murid yang kurang mahir bermain bola masih boleh menyumbang sebagai penyokong atau pengadil pembantu!',
        x: 8,
        y: 0,
        z: 5,
        questions: [
          {
            id: 'q_kb_1',
            activityType: 'padanan',
            prompt: 'Padankan situasi: "Zaim sering tersadung apabila cuba menendang bola dan tidak pernah menyertai perlawanan bola sepak."',
            options: ['Kaki bangku — tidak pandai bermain bola', 'Kaki ayam — tidak memakai kasut', 'Ringan mulut — suka berbual ramah', 'Cepat kaki — pantas berlari'],
            correctAnswer: 'Kaki bangku — tidak pandai bermain bola',
            explanation: 'Simpulan bahasa "kaki bangku" merujuk kepada seseorang yang tidak pandai bermain bola.',
            points: 20,
          },
        ],
      },
      {
        id: 'st_mulut_murai',
        title: 'Rumah Mulut Murai',
        expression: 'Mulut murai',
        category: 'Simpulan Bahasa',
        meaning: 'Orang yang suka bercakap banyak atau becok.',
        exampleSentence: 'Suasana di kantin menjadi riuh apabila rakan-rakan yang mulut murai itu bercerita tentang percutian mereka.',
        teacherNotes: 'Burung murai terkenal dengan kicauan yang tidak berhenti-henti.',
        x: 16,
        y: 0,
        z: 5,
        questions: [
          {
            id: 'q_mm_1',
            activityType: 'teka_teki',
            prompt: 'Teka-teki: Saya suka berkicau sepanjang hari sehingga kelas tidak sunyi apabila saya hadir. Siapakah saya dalam simpulan bahasa?',
            options: ['Mulut murai', 'Telinga kuali', 'Hati batu', 'Mata duitan'],
            correctAnswer: 'Mulut murai',
            explanation: '"Mulut murai" bermaksud orang yang becok dan suka bercakap.',
            points: 20,
          },
        ],
      },
      {
        id: 'st_buah_hati',
        title: 'Rumah Buah Hati',
        expression: 'Buah hati',
        category: 'Simpulan Bahasa',
        meaning: 'Orang yang dikasihi atau disayangi.',
        exampleSentence: 'Kucing comel dan adik kecil itu menjadi buah hati seluruh ahli keluarga kami.',
        teacherNotes: 'Ungkapan ini digunakan untuk menunjukkan kasih sayang yang mendalam.',
        x: 24,
        y: 0,
        z: -3,
        questions: [
          {
            id: 'q_bh_1',
            activityType: 'situasi_kefahaman',
            prompt: 'Ibu memeluk adik bongsu dengan penuh kasih sayang kerana dialah orang yang paling disayangi dalam keluarga. Adik ialah _______ ibu.',
            options: ['buah hati', 'buah tangan', 'langkah kanan', 'makan angin'],
            correctAnswer: 'buah hati',
            explanation: '"Buah hati" bermaksud orang yang sangat dikasihi atau disayangi.',
            points: 20,
          },
        ],
      },
      {
        id: 'st_panjang_tangan',
        title: 'Rumah Panjang Tangan',
        expression: 'Panjang tangan',
        category: 'Simpulan Bahasa',
        meaning: 'Tabiat suka mencuri atau mengambil barang kepunyaan orang lain tanpa izin.',
        exampleSentence: 'Kita hendaklah menjauhi sikap panjang tangan supaya sentiasa dipercayai oleh rakan-rakan.',
        teacherNotes: 'Nilai murni: Sentiasa meminta izin sebelum meminjam barang rakan.',
        x: 24,
        y: 0,
        z: 5,
        questions: [
          {
            id: 'q_pt_1',
            activityType: 'situasi_kefahaman',
            prompt: 'Mengapakah kita dinasihatkan supaya tidak bersikap "panjang tangan" di sekolah?',
            options: [
              'Kerana mengambil barang orang tanpa izin ialah perbuatan tidak jujur',
              'Kerana lengan baju sekolah akan menjadi pendek',
              'Kerana kita tidak dibenarkan menolong guru',
              'Kerana tulisan di papan putih sukar dicapai',
            ],
            correctAnswer: 'Kerana mengambil barang orang tanpa izin ialah perbuatan tidak jujur',
            explanation: '"Panjang tangan" ialah simpulan bahasa bagi perbuatan mencuri atau mengambil barang tanpa kebenaran.',
            points: 20,
          },
        ],
      },
    ],
    musicZones: [
      {
        id: 'mz_taman_lagu',
        title: 'Taman Lagu Simpulan Bahasa',
        artistOrTeacher: 'Cikgu Blockverse',
        x: -2,
        y: 0,
        z: 10,
        radius: 5,
        synthMelodyId: 'lagu_ringan_tulang',
        lyrics: [
          'Mari kawan kita ke kampung bahasa,',
          'Ringan tulang bantu ibu dan bapa,',
          'Jangan panjang tangan, bersikap jujur selalu,',
          'Jadi anak emas kebanggaan cikgu!',
          'Walau kaki bangku, semangat tetap tinggi,',
          'Bersatu hati membina budi pekerti!',
        ],
        isBackgroundMusic: false,
        volume: 0.75,
        questions: [
          {
            id: 'q_mz_1',
            activityType: 'situasi_kefahaman',
            prompt: 'Berdasarkan lirik lagu di Taman Lagu tadi, apakah sikap baik yang patut diamalkan untuk menjadi kebanggaan guru dan ibu bapa?',
            options: [
              'Ringan tulang dan bersikap jujur',
              'Panjang tangan dan berat tulang',
              'Mulut murai ketika guru mengajar',
              'Kaki bangku dan berputus asa',
            ],
            correctAnswer: 'Ringan tulang dan bersikap jujur',
            explanation: 'Lagu menekankan amalan ringan tulang dan menjauhi sikap panjang tangan.',
            points: 25,
          },
        ],
      },
    ],
    customUniforms: [],
    snapshots: [],
    version: 1,
    updatedAt: now,
  },
  {
    id: 'wld_hutan_02',
    worldCode: 'HUTAN02',
    title: 'Hutan Perumpamaan',
    description: 'Hutan ajaib dengan haiwan 3D dan pencerita untuk mempelajari Perumpamaan Melayu melalui kisah alam.',
    worldType: 'hutan',
    ownerId: '',
    ownerName: 'Cikgu Blockverse',
    teacherCode: 'GURU-1001',
    isPublished: true,
    allowStudentBuild: false,
    maxPlayers: 25,
    dayTimeMode: 'siang',
    blocks: [
      makeBlock(-3, 0, -4, 'water'),
      makeBlock(-3, 0, -3, 'water'),
      makeBlock(-2, 0, -4, 'water'),
      makeBlock(-2, 0, -3, 'water'),
      makeBlock(0, 0, -2, 'bridge'),
    ],
    structures: [
      { id: 'h_tree_1', kind: 'pokok', name: 'Pokok Buluh', x: -6, y: 0, z: -6 },
      { id: 'h_tree_2', kind: 'pokok', name: 'Pokok Meranti', x: 10, y: 0, z: -10 },
      { id: 'h_tree_3', kind: 'pokok', name: 'Pokok Cengal', x: -10, y: 0, z: 8 },
      { id: 'h_rusa_1', kind: 'haiwan_rusa', name: 'Sang Rusa', x: 4, y: 0, z: 6 },
      { id: 'h_pondok_1', kind: 'pondok_belajar', name: 'Pondok Aur dan Tebing', x: 6, y: 0, z: -6, stationId: 'st_aur_tebing' },
      { id: 'h_pondok_2', kind: 'pondok_belajar', name: 'Pondok Isi dan Kuku', x: 14, y: 0, z: 4, stationId: 'st_isi_kuku' },
      { id: 'h_pondok_3', kind: 'pondok_belajar', name: 'Pondok Pinang Dibelah Dua', x: -8, y: 0, z: 5, stationId: 'st_pinang_belah' },
      { id: 'h_pondok_4', kind: 'pondok_belajar', name: 'Kolam Katak & Tempurung', x: -10, y: 0, z: -8, stationId: 'st_katak_tempurung' },
    ],
    npcs: [
      { id: 'npc_tok_rimba', name: 'Tok Rimba', roleTitle: 'Penjaga Hutan Perumpamaan', x: 2, y: 0, z: -2, patrolRadius: 2, shirtColor: '#15803d', skinColor: '#9c6644', dialogue: 'Selamat datang ke Hutan Perumpamaan! Perumpamaan membandingkan sesuatu dengan alam sekeliling menggunakan kata seperti "bagai" atau "seperti".', stationId: 'st_aur_tebing' },
    ],
    signs: [
      { id: 'sign_hutan', title: 'Petunjuk Perumpamaan', message: 'Perumpamaan lazimnya dimulakan dengan kata pembanding: bagai, ibarat, laksana, seperti, umpama.', x: 0, y: 0, z: 2 },
    ],
    stations: [
      {
        id: 'st_aur_tebing',
        title: 'Pondok Aur dan Tebing',
        expression: 'Bagai aur dengan tebing',
        category: 'Perumpamaan',
        meaning: 'Hubungan persahabatan atau kerjasama yang sangat erat dan saling membantu.',
        exampleSentence: 'Penduduk kampung bergotong-royong membersihkan sungai bagai aur dengan tebing.',
        teacherNotes: 'Akar rumpun aur mencengkam tanah tebing supaya tidak runtuh.',
        x: 6,
        y: 0,
        z: -4,
        questions: [
          {
            id: 'q_at_1',
            activityType: 'situasi_kefahaman',
            prompt: 'Murid Tahun 5 Bestari bekerjasama menghias kelas sehingga memenangi pertandingan keceriaan sekolah. Perumpamaan manakah yang menggambarkan semangat mereka?',
            options: ['Bagai aur dengan tebing', 'Seperti katak di bawah tempurung', 'Bagai mencurah air ke daun keladi', 'Seperti anjing dengan kucing'],
            correctAnswer: 'Bagai aur dengan tebing',
            explanation: '"Bagai aur dengan tebing" bermaksud saling bekerjasama dan tolong-menolong.',
            points: 25,
          },
        ],
      },
      {
        id: 'st_isi_kuku',
        title: 'Pondok Isi dan Kuku',
        expression: 'Bagai isi dengan kuku',
        category: 'Perumpamaan',
        meaning: 'Persahabatan yang sangat akrab dan tidak boleh dipisahkan.',
        exampleSentence: 'Amir dan Danial berkawan baik sejak darjah satu bagai isi dengan kuku.',
        teacherNotes: 'Isi jari dan kuku sentiasa melekat rapat.',
        x: 14,
        y: 0,
        z: 2,
        questions: [
          {
            id: 'q_ik_1',
            activityType: 'padanan',
            prompt: 'Pilih maksud yang paling tepat bagi perumpamaan "Bagai isi dengan kuku":',
            options: ['Persahabatan yang sangat akrab dan sukar dipisahkan', 'Pasangan yang sama cantik dan sama padan', 'Orang yang kurang ilmu pengetahuan', 'Nasihat yang tidak diendahkan'],
            correctAnswer: 'Persahabatan yang sangat akrab dan sukar dipisahkan',
            explanation: '"Bagai isi dengan kuku" menggambarkan persahabatan yang sangat rapat.',
            points: 20,
          },
        ],
      },
      {
        id: 'st_pinang_belah',
        title: 'Pondok Pinang Dibelah Dua',
        expression: 'Bagai pinang dibelah dua',
        category: 'Perumpamaan',
        meaning: 'Dua orang atau pasangan yang sangat sepadan, sama cantik atau seiras.',
        exampleSentence: 'Pasangan pengantin diraja di atas pelamin itu kelihatan bagai pinang dibelah dua.',
        teacherNotes: 'Buah pinang yang dibelah dua tepat di tengah menghasilkan dua belahan yang sepadan.',
        x: -8,
        y: 0,
        z: 3,
        questions: [
          {
            id: 'q_pb_1',
            activityType: 'situasi_kefahaman',
            prompt: 'Kembar seiras Laila dan Nadia mempunyai wajah yang amat serupa serta bakat melukis yang setanding. Mereka kelihatan...',
            options: ['Bagai pinang dibelah dua', 'Bagai aur dengan tebing', 'Seperti katak di bawah tempurung', 'Seperti ular kena palu'],
            correctAnswer: 'Bagai pinang dibelah dua',
            explanation: '"Bagai pinang dibelah dua" bermaksud sama sepadan atau serupa benar.',
            points: 20,
          },
        ],
      },
      {
        id: 'st_katak_tempurung',
        title: 'Kolam Katak & Tempurung',
        expression: 'Seperti katak di bawah tempurung',
        category: 'Perumpamaan',
        meaning: 'Orang yang cetek pengetahuan dan enggan mengambil tahu perkembangan dunia luar.',
        exampleSentence: 'Rajinlah membaca buku agar tidak menjadi seperti katak di bawah tempurung.',
        teacherNotes: 'Galakkan murid membaca buku dan meneroka ilmu baharu.',
        x: -10,
        y: 0,
        z: -6,
        questions: [
          {
            id: 'q_kt_1',
            activityType: 'situasi_kefahaman',
            prompt: 'Mengapakah kita digalakkan membaca pelbagai buku dan belajar ilmu baharu di sekolah?',
            options: ['Supaya tidak menjadi seperti katak di bawah tempurung', 'Supaya menjadi seperti pahat dengan penukul', 'Supaya menjadi bagai tikus membaiki labu', 'Supaya kelihatan bagai pinang dibelah dua'],
            correctAnswer: 'Supaya tidak menjadi seperti katak di bawah tempurung',
            explanation: 'Membaca meluaskan pengetahuan agar tidak cetek ilmu.',
            points: 25,
          },
        ],
      },
    ],
    musicZones: [
      {
        id: 'mz_hutan_rimba',
        title: 'Pentas Irama Rimba',
        artistOrTeacher: 'Cikgu Blockverse',
        x: 2,
        y: 0,
        z: 9,
        radius: 4.5,
        synthMelodyId: 'irama_pantun',
        lyrics: ['Di dalam hutan hijau kita bersama,', 'Bagai aur dengan tebing saling menjaga,', 'Sahabat sejati bagai isi dengan kuku,', 'Teroka dunia dengan ilmu dan buku!'],
        isBackgroundMusic: false,
        volume: 0.7,
        questions: [
          {
            id: 'q_mzh_1',
            activityType: 'situasi_kefahaman',
            prompt: 'Apakah perumpamaan tentang persahabatan sejati yang disebut dalam lagu rimba?',
            options: ['Bagai isi dengan kuku', 'Seperti katak di bawah tempurung', 'Bagai mencurah garam ke laut', 'Seperti embun di hujung rumput'],
            correctAnswer: 'Bagai isi dengan kuku',
            explanation: 'Lagu menyebut: "Sahabat sejati bagai isi dengan kuku".',
            points: 20,
          },
        ],
      },
    ],
    customUniforms: [],
    snapshots: [],
    version: 1,
    updatedAt: now,
  },
  {
    id: 'wld_istana_03',
    worldCode: 'ISTANA03',
    title: 'Istana Pepatah dan Bidalan',
    description: 'Istana Melayu 3D yang megah. Temui Bendahara dan selesaikan misi Pepatah serta Bidalan.',
    worldType: 'istana',
    ownerId: '',
    ownerName: 'Cikgu Blockverse',
    teacherCode: 'GURU-1001',
    isPublished: true,
    allowStudentBuild: false,
    maxPlayers: 25,
    dayTimeMode: 'siang',
    blocks: [
      makeBlock(-2, 0, 5, 'bridge'),
      makeBlock(-1, 0, 5, 'bridge'),
      makeBlock(0, 0, 5, 'bridge'),
      makeBlock(1, 0, 5, 'bridge'),
      makeBlock(2, 0, 5, 'bridge'),
    ],
    structures: [
      { id: 'ist_main', kind: 'istana', name: 'Istana Balai Seri Bahasa', x: 0, y: 0, z: -12 },
      { id: 'ist_pondok_1', kind: 'pondok_belajar', name: 'Balai Tabung Diraja', x: -12, y: 0, z: -4, stationId: 'st_sedikit_bukit' },
      { id: 'ist_pondok_2', kind: 'pondok_belajar', name: 'Balai Usaha Gigih', x: 12, y: 0, z: -4, stationId: 'st_pekasam' },
      { id: 'ist_pondok_3', kind: 'pondok_belajar', name: 'Balai Muafakat', x: 0, y: 0, z: -10, stationId: 'st_bulat_air' },
    ],
    npcs: [
      { id: 'npc_bendahara', name: 'Dato’ Bendahara', roleTitle: 'Penasihat Istana Bahasa', x: 0, y: 0, z: -4, patrolRadius: 2, shirtColor: '#b45309', skinColor: '#eab68c', dialogue: 'Selamat datang anakanda! Bezakan dengan bijak antara Bidalan yang mengandungi nasihat terus dan Pepatah yang merupakan ungkapan bijaksana.', stationId: 'st_bulat_air' },
    ],
    signs: [
      { id: 'sign_istana', title: 'Panduan Pengkelasan Peribahasa', message: 'Pepatah ialah ungkapan patah-patah kata sebagai pedoman hidup. Bidalan pula ialah pepatah yang mengandungi pengajaran serta nasihat yang jelas.', x: 3, y: 0, z: 3 },
    ],
    stations: [
      {
        id: 'st_sedikit_bukit',
        title: 'Balai Tabung Diraja',
        expression: 'Sedikit-sedikit, lama-lama menjadi bukit',
        category: 'Bidalan',
        meaning: 'Kerja atau simpanan yang dilakukan secara sabar dan berterusan akhirnya membuahkan hasil yang besar.',
        exampleSentence: 'Nurin menabung lima puluh sen setiap hari kerana berpegang kepada bidalan sedikit-sedikit, lama-lama menjadi bukit.',
        teacherNotes: 'Pengkelasan: Bidalan — memberi nasihat tentang kesabaran menabung dan berusaha.',
        x: -12,
        y: 0,
        z: -2,
        questions: [
          {
            id: 'q_sb_1',
            activityType: 'situasi_kefahaman',
            prompt: 'Apakah jenis peribahasa bagi "Sedikit-sedikit, lama-lama menjadi bukit" dan bagaimanakah cara mengamalkannya di sekolah?',
            options: ['Bidalan — menyimpan wang saku sedikit demi sedikit setiap hari', 'Simpulan Bahasa — berbelanja besar setiap hujung minggu', 'Perumpamaan — menunggu hadiah tanpa berusaha', 'Bidalan — menyiapkan kerja rumah sekali gus pada akhir tahun'],
            correctAnswer: 'Bidalan — menyimpan wang saku sedikit demi sedikit setiap hari',
            explanation: 'Ungkapan ini tergolong dalam Bidalan yang menasihatkan kita supaya sabar berusaha sedikit demi sedikit.',
            points: 25,
          },
        ],
      },
      {
        id: 'st_pekasam',
        title: 'Balai Usaha Gigih',
        expression: 'Alang-alang menyeluk pekasam, biar sampai ke pangkal lengan',
        category: 'Bidalan',
        meaning: 'Apabila melakukan sesuatu pekerjaan, lakukanlah dengan bersungguh-sungguh sehingga berjaya.',
        exampleSentence: 'Iman berlatih bersungguh-sungguh kerana alang-alang menyeluk pekasam, biar sampai ke pangkal lengan.',
        teacherNotes: 'Pengkelasan: Bidalan — mengandungi teladan agar tidak bekerja separuh jalan.',
        x: 12,
        y: 0,
        z: -2,
        questions: [
          {
            id: 'q_pk_1',
            activityType: 'situasi_kefahaman',
            prompt: 'Aiman mahu berhenti menyiapkan projek sainsnya apabila berdepan cabaran kecil. Apakah nasihat bidalan yang paling sesuai untuk Aiman?',
            options: ['Alang-alang menyeluk pekasam, biar sampai ke pangkal lengan', 'Sedikit-sedikit, lama-lama menjadi bukit', 'Bagai aur dengan tebing', 'Ringan tulang berat perut'],
            correctAnswer: 'Alang-alang menyeluk pekasam, biar sampai ke pangkal lengan',
            explanation: 'Bidalan ini mendorong kita menyempurnakan usaha hingga tuntas.',
            points: 25,
          },
        ],
      },
      {
        id: 'st_bulat_air',
        title: 'Balai Muafakat',
        expression: 'Bulat air kerana pembetung, bulat manusia kerana muafakat',
        category: 'Pepatah',
        meaning: 'Kata sepakat dan perpaduan dicapai apabila ahli masyarakat bermesyuarat dan bersatu hati.',
        exampleSentence: 'Warga sekolah berjaya menganjurkan Hari Bahasa Melayu hasil muafakat bersama, bak pepatah bulat air kerana pembetung, bulat manusia kerana muafakat.',
        teacherNotes: 'Pengkelasan: Pepatah — ungkapan berirama masyarakat Melayu tentang kepentingan musyawarah.',
        x: 0,
        y: 0,
        z: -7,
        questions: [
          {
            id: 'q_ba_1',
            activityType: 'situasi_kefahaman',
            prompt: 'Sebelum menentukan tema gerai Hari Kantin, ahli kelas berbincang dan mengundi secara adil supaya semua pihak bersetuju. Situasi ini menepati pepatah...',
            options: ['Bulat air kerana pembetung, bulat manusia kerana muafakat', 'Alang-alang menyeluk pekasam, biar sampai ke pangkal lengan', 'Bagai pinang dibelah dua', 'Seperti katak di bawah tempurung'],
            correctAnswer: 'Bulat air kerana pembetung, bulat manusia kerana muafakat',
            explanation: 'Pepatah ini menekankan bahawa kesepakatan bersama melahirkan kejayaan.',
            points: 30,
          },
        ],
      },
    ],
    musicZones: [
      {
        id: 'mz_istana',
        title: 'Balai Nobat Bahasa',
        artistOrTeacher: 'Cikgu Blockverse',
        x: -8,
        y: 0,
        z: 6,
        radius: 4.5,
        synthMelodyId: 'ceria_kampung',
        lyrics: ['Sedikit-sedikit menjadi bukit,', 'Usaha gigih janganlah sikit,', 'Bulat manusia kerana muafakat,', 'Bahasa Melayu terus berkat!'],
        isBackgroundMusic: false,
        volume: 0.7,
        questions: [
          {
            id: 'q_mzi_1',
            activityType: 'situasi_kefahaman',
            prompt: 'Apakah tema utama lagu di Balai Nobat Bahasa?',
            options: ['Kesabaran berusaha dan semangat muafakat', 'Sikap terburu-buru tanpa perbincangan', 'Tabiat suka mencuri barang kawan', 'Menjauhkan diri daripada masyarakat'],
            correctAnswer: 'Kesabaran berusaha dan semangat muafakat',
            explanation: 'Lagu menggabungkan nilai usaha berterusan dan muafakat bersama.',
            points: 20,
          },
        ],
      },
    ],
    customUniforms: [],
    snapshots: [],
    version: 1,
    updatedAt: now,
  },
  {
    id: 'wld_kreatif_04',
    worldCode: 'KREATIF04',
    title: 'Creative World',
    description: 'Dunia kanvas terbuka khas untuk guru membina bangunan, stesen bahasa, taman muzik, dan pengembaraan baharu mengikut kreativiti.',
    worldType: 'kreatif',
    ownerId: '',
    ownerName: 'Cikgu Blockverse',
    teacherCode: 'GURU-1001',
    isPublished: true,
    allowStudentBuild: true,
    maxPlayers: 30,
    dayTimeMode: 'siang',
    blocks: [],
    structures: [
      { id: 'kr_studio', kind: 'studio_avatar', name: 'Studio Avatar Sekolah Malaysia', x: -10, y: 0, z: -6 },
      { id: 'kr_pokok', kind: 'pokok', name: 'Pokok Inspirasi', x: 6, y: 0, z: -5 },
    ],
    npcs: [
      { id: 'npc_pemandu_kreatif', name: 'Cikgu Pembina', roleTitle: 'Panduan Creative World', x: 0, y: 0, z: -3, patrolRadius: 1.5, shirtColor: '#7c3aed', skinColor: '#eab68c', dialogue: 'Aktifkan Mod Pembina Guru (Creator Mode) di bahagian bawah skrin untuk meletakkan blok, rumah, stesen bahasa, atau lagu baharu!' },
    ],
    signs: [
      { id: 'sign_kreatif', title: 'Selamat Membina!', message: 'Guru boleh menyimpan binaan sebagai templat, menambah stesen pembelajaran, dan menerbitkan dunia supaya murid boleh menerokanya melalui Kod Dunia.', x: 3, y: 0, z: 2 },
    ],
    stations: [],
    musicZones: [],
    customUniforms: [],
    snapshots: [],
    version: 1,
    updatedAt: now,
  },
];
