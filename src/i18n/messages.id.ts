import type { Message, MessageId } from './messages.en';

/**
 * Indonesian: casual ("kamu", short sentences), except permission and privacy texts, which
 * stay neutral and plain. Complete for every text that ships; a test fails when an id of the
 * English catalog has no Indonesian text, so a new text is added to both catalogs together.
 * (`translate` still falls back to English for an id missing here, as a safety net.)
 */
export const id: Partial<Record<MessageId, Message>> = {
  // Units, counts and lists. Indonesian has no plural form.
  'unit.video': 'video',
  'count.video': '{count} video',
  'count.hour': '{count} jam',
  'count.minute': '{count} menit',
  'count.second': '{count} detik',
  'list.and': '{items} dan {last}',
  'series.videos': 'video',
  'series.minutes': 'menit',

  // Tier names (CONTEXT.md, Tier).
  'tier.0': 'Santuy',
  'tier.1': 'Oleng',
  'tier.2': 'Madesu',
  'tier.3': 'Cengoh',
  'tier.4': 'Wassalam',
  'tier.sentence': 'Tingkat {level} dari {total}, {name}.',

  // Dates.
  'day.today': 'Hari ini',
  'day.yesterday': 'Kemarin',
  'weekday.0': 'Minggu',
  'weekday.1': 'Senin',
  'weekday.2': 'Selasa',
  'weekday.3': 'Rabu',
  'weekday.4': 'Kamis',
  'weekday.5': 'Jumat',
  'weekday.6': 'Sabtu',
  'month.0': 'Januari',
  'month.1': 'Februari',
  'month.2': 'Maret',
  'month.3': 'April',
  'month.4': 'Mei',
  'month.5': 'Juni',
  'month.6': 'Juli',
  'month.7': 'Agustus',
  'month.8': 'September',
  'month.9': 'Oktober',
  'month.10': 'November',
  'month.11': 'Desember',

  // Navigation.
  'nav.today': 'Hari ini',
  'nav.history': 'Riwayat',
  'nav.settings': 'Pengaturan',

  // The Overlay pill and its expanded panel.
  'pill.description': 'Doom meter. {videos}, {time}. {tier}',
  'today.tileLabel': '{name}, {videos}, {time}',
  'pill.collapsed': 'Tertutup',
  'panel.description': 'Detail doom meter hari ini. {videos}, {time}. {tier}',
  'panel.rowDescription': '{label}, {videos}, {time}, {percent} persen',
  'panel.close': 'Tutup',

  // Today.
  'today.title': 'Hari ini',
  'today.byPlatform': 'Per platform',
  'today.empty': 'Belum ada yang ditonton. Scroll aja seperti biasa, DoomMeter yang menghitung.',
  'today.emptyTitle': 'Belum ada data',
  'today.enableOverlay': 'Aktifkan overlay',
  'today.summary': 'Hari ini. {videos}, {time}. {tier}',
  'today.rowLabel': '{label}. {videos}, {time}, {percent} persen.',
  'today.rowWarning': 'Deteksi tidak merespons.',
  'today.warningKicker': 'Peringatan',
  'today.warningTitle': 'Deteksi {name} tidak merespons',
  'today.warningWithUsageAccess':
    'Waktu tonton tetap dihitung lewat Akses penggunaan. Video tidak dihitung sampai deteksi pulih.',
  'today.warningWithoutUsageAccess':
    'Belum ada yang dihitung sampai deteksi pulih. Akses penggunaan bisa menjaga Waktu tonton tetap jalan.',
  'today.warningLabel': 'Peringatan. {title}. {message}',
  'today.setupTitle': 'Pengaturan awal',
  'today.detectionOn': 'Deteksi aktif. Scroll TikTok, pill ikut bergerak.',
  'today.detectionOff':
    'Deteksi mati. Aktifkan layanan Aksesibilitas DoomMeter agar bisa melihat saat kamu scroll video pendek. Hanya jumlah yang disimpan; isi video tidak dibaca atau disimpan.',
  'today.openAccessibility': 'Buka pengaturan Aksesibilitas',
  'today.overlayOn': 'Overlay aktif. Hanya tampil saat feed video pendek terbuka.',
  'today.overlayNoPermission':
    'Izin overlay belum ada. Berikan izin "Tampilkan di atas aplikasi lain", lalu kembali ke sini.',
  'today.overlayOff': 'Overlay mati.',
  'today.disableOverlay': 'Matikan overlay',

  // History and the 7-day chart.
  'history.title': 'Riwayat',
  'history.emptyTitle': 'Belum ada data',
  'history.emptyMessage':
    'Hari-harimu muncul di sini setelah DoomMeter menghitung scroll. Aktifkan overlay lalu scroll seperti biasa.',
  'history.incomplete': 'Belum lengkap: deteksi sempat berhenti, jumlahnya mungkin kurang.',
  'history.rowLabel': '{date}. {videos}, {time}. {tier}',
  'chart.title': '7 hari terakhir',
  'chart.empty': 'Grafik 7 hari terakhir muncul di sini setelah DoomMeter menghitung scroll.',
  'chart.summary': '7 hari terakhir. {videos}, {time} total.',
  'chart.busiest': 'Hari tersibuk: {date}, {videos}.',
  'chart.nothing': '{date}: tidak ada yang tercatat.',
  'chart.day': '{date}: {videos}, {time}, {tier}',

  // Permissions: neutral and plain.
  'permission.accessibility.title': 'Layanan Aksesibilitas',
  'permission.accessibility.purpose':
    'DoomMeter memakainya untuk mengetahui kapan feed video pendek terbuka dan video baru muncul, supaya bisa menghitungnya.',
  'permission.overlay.title': 'Tampilkan di atas aplikasi lain',
  'permission.overlay.purpose':
    'DoomMeter memakainya untuk menampilkan pill di bagian atas layar saat feed video pendek terbuka.',
  'permission.usageAccess.title': 'Akses penggunaan',
  'permission.usageAccess.purpose':
    'DoomMeter memakainya hanya sebagai cadangan agar Waktu tonton tetap benar jika deteksi video berhenti bekerja.',
  'permission.notifications.title': 'Notifikasi',
  'permission.notifications.purpose':
    'DoomMeter memakainya untuk menampilkan pemberitahuan kecil yang menjaga penghitungan tetap berjalan di latar belakang.',
  'permission.required': 'Wajib',
  'permission.optional': 'Opsional',
  'permission.fix': 'Perbaiki izin',
  'permission.fixNamed': 'Perbaiki izin: {name}',
  'permission.banner': 'DoomMeter belum menghitung. Aktifkan {names}.',
  'permission.notCountingTitle': 'Belum menghitung',
  'permission.notCountingMessage':
    'DoomMeter tidak dapat melihat aktivitas scroll sampai izin yang kurang diaktifkan.',
  'notification.text': 'Menghitung video pendek di perangkat ini',

  // Layar blokir di atas aplikasi Platform selama Lockout.
  'lockout.blockedUntil': 'Diblokir sampai {time}',
  'lockout.back': 'Kembali ke Home',

  // Onboarding.
  'onboarding.step': 'Langkah {step} dari {total}',
  'onboarding.welcomeTitle': 'Selamat datang di DoomMeter',
  'onboarding.welcomeBody':
    'DoomMeter menghitung setiap video pendek yang kamu tonton. Makin lama kamu scrolling, Tier-mu makin naik, dan wajah di pill atas layar ikut berubah.',
  'onboarding.back': 'Kembali',
  'onboarding.tiersTitle': 'Lima Tier',
  'onboarding.tiersBody':
    'Dari yang paling santai sampai yang paling parah. Tiap Tier punya wajah sendiri, jadi terbaca sekilas.',
  'onboarding.privacyTitle': 'Privasi terjaga',
  'onboarding.privacyBody':
    'Tidak ada data yang keluar dari perangkatmu. DoomMeter hanya menyimpan jumlah dan waktu tonton, di ponsel ini. Isi tontonanmu tidak pernah disimpan.',
  'onboarding.calc.title': 'Iseng saja',
  'onboarding.calc.body':
    'Atur berapa lama kamu scrolling tiap hari dan isi umurmu. Apa pun yang kamu isi di sini tidak disimpan.',
  'onboarding.calc.hours': '{hours} jam per hari',
  'onboarding.calc.less': 'Kurangi waktu',
  'onboarding.calc.more': 'Tambah waktu',
  'onboarding.calc.ageLabel': 'Umurmu',
  'onboarding.calc.resultLabel': 'Tahun hidup terbuang untuk scrolling',
  'onboarding.calc.resultNote':
    'Tahun kalender, jika kamu terus begini sampai usia 73, harapan hidup rata-rata.',
  'onboarding.calc.needAge': 'Isi umurmu untuk melihat hasilnya.',
  'onboarding.calc.past':
    'Umurmu sudah mencapai atau melewati harapan hidup rata-rata 73 tahun, jadi tidak ada angka yang ditampilkan.',
  'onboarding.restrictedHint':
    'Di Android 13 ke atas, sakelar Aksesibilitas bisa berwarna abu-abu. Jika begitu, buka Info aplikasi, ketuk menu titik tiga, pilih Izinkan setelan terbatas (Allow restricted settings), lalu kembali ke sini.',
  'onboarding.getStarted': 'Mulai',
  'onboarding.continue': 'Lanjut',
  'onboarding.notNow': 'Nanti saja',
  'onboarding.skip': 'Lewati',
  'onboarding.granted': 'Sudah diizinkan',
  'onboarding.notGrantedYet': 'Belum diizinkan',
  'onboarding.privacy': 'Tidak ada data yang keluar dari perangkat. Hanya jumlah yang disimpan, di ponsel ini.',
  'onboarding.open.accessibility': 'Buka pengaturan Aksesibilitas',
  'onboarding.open.overlay': 'Buka pengaturan Overlay',
  'onboarding.open.usageAccess': 'Buka pengaturan Akses penggunaan',
  'onboarding.open.notifications': 'Buka pengaturan Notifikasi',

  // Settings.
  'settings.title': 'Pengaturan',
  'settings.error': 'Gagal: {message}',
  'settings.permissions.title': 'Izin',
  'settings.permission.granted': 'Diizinkan',
  'settings.permission.missing': 'Belum ada',
  'settings.permission.on': 'Aktif',
  'settings.permission.off': 'Mati',
  'settings.permission.notGranted': 'Belum diizinkan',
  'settings.permission.rowRequired': '{title}: {state}',
  'settings.permission.rowOptional': '{title}, opsional: {state}',
  'settings.permission.overlayWhy': 'Membuat pill tampil di atas {platforms}.',
  'settings.permission.accessibilityWhy':
    'Memungkinkan DoomMeter melihat saat kamu scroll video pendek. Hanya jumlah yang disimpan; isi video tidak dibaca atau disimpan.',
  'settings.overlay.title': 'Overlay',
  'settings.overlay.show': 'Tampilkan pill overlay',
  'settings.overlay.showHint': 'Hanya tampil saat feed video pendek terbuka.',
  'settings.overlay.compact': 'Mode ringkas',
  'settings.overlay.compactHint': 'Hanya wajah dan jumlah.',
  'settings.overlay.haptics': 'Getar',
  'settings.overlay.hapticsHint': 'Getar saat Tingkatmu naik.',
  'settings.position.label': 'Posisi',
  'settings.position.hint': 'Pill-nya juga bisa digeser langsung.',
  'settings.position.up': 'Naik',
  'settings.position.down': 'Turun',
  'settings.position.top': 'Atas',
  'settings.position.below': '{dp} dp dari atas',
  'settings.thresholds.title': 'Batas Tingkat',
  'settings.thresholds.hint':
    'Tiap Tingkat mulai dari angka di bawah. Tingkatmu adalah yang lebih tinggi antara Tingkat video dan Tingkat menit. Angkanya harus naik dari satu Tingkat ke berikutnya.',
  'settings.thresholds.videos': 'Video',
  'settings.thresholds.minutes': 'Menit',
  'settings.thresholds.videosLabel': 'Video {tier}',
  'settings.thresholds.minutesLabel': 'Menit {tier}',
  'settings.thresholds.save': 'Simpan batas',
  'settings.day.title': 'Hari',
  'settings.day.hint':
    'Hari baru mulai pukul {time} waktu setempat, jadi scroll larut malam masih masuk Hari yang sama. Isi jam dari 0 sampai 23.',
  'settings.day.fieldLabel': 'Jam pergantian Hari',
  'settings.day.fieldCaption': 'Jam (0-23)',
  'settings.day.save': 'Simpan jam pergantian',
  'settings.language.title': 'Bahasa',
  'settings.language.hint': 'Berlaku langsung, di aplikasi dan di pill.',
  'settings.language.system': 'Sistem',
  'settings.language.en': 'English',
  'settings.language.id': 'Bahasa Indonesia',
  'settings.punishment.title': 'Hukuman',
  'settings.punishment.hint':
    'Saat kamu pertama kali mencapai sebuah Tingkat dalam satu Hari, semua aplikasi Platform diblokir selama waktu yang kamu pilih. Lockout tidak bisa diakhiri lebih awal. Santuy tidak pernah dihukum.',
  'settings.punishment.off': 'Mati',
  'settings.punishment.15m': '15 menit',
  'settings.punishment.1h': '1 jam',
  'settings.punishment.3h': '3 jam',
  'settings.punishment.untilDay': 'Sampai pergantian Hari',
  'settings.punishment.rowLabel': 'Hukuman {tier}',
  'settings.punishment.status': 'Lockout aktif sampai {time}',
  'settings.saved': 'Pengaturan disimpan',

  // Why a setting was refused.
  'settings.error.videosWhole': 'Video {tier} harus berupa bilangan bulat.',
  'settings.error.minutesWhole': 'Menit {tier} harus berupa bilangan bulat.',
  'settings.error.thresholdsWhole': 'Batas Tingkat untuk {series} harus berupa bilangan bulat.',
  'settings.error.thresholdsRange': 'Batas Tingkat untuk {series} harus antara 1 dan {max}.',
  'settings.error.thresholdsAscend':
    'Batas Tingkat untuk {series} harus naik: tiap Tingkat mulai lebih tinggi dari sebelumnya ({values}).',
  'settings.error.rollover': 'Jam pergantian Hari harus bilangan bulat dari 0 sampai 23.',
  'settings.error.position': 'Posisi harus bilangan bulat dari {min} sampai {max}.',
  'settings.error.language': 'Bahasa harus Sistem, English atau Bahasa Indonesia.',
  'settings.error.punishment':
    'Hukuman harus Mati, 15 menit, 1 jam, 3 jam atau Sampai pergantian Hari untuk tiap Tingkat 1 sampai 4.',
  'settings.error.save':'Pengaturan ini tidak bisa disimpan di perangkat.',
  'widget.empty': 'Belum ada data',
  'widget.emptyDescription': 'Doom meter hari ini. Belum ada data.',
  'widget.description': 'Doom meter hari ini. {videos}, {time}. {tier}',
};
