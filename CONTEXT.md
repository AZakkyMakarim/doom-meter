# DoomMeter

Aplikasi yang menghitung berapa video short-form yang ditonton user dan berapa lama waktu yang dihabiskan, lalu menunjukkan seberapa parah doomscrolling-nya lewat tampilan yang makin buruk.

## Language

**Short-form video**:
Video vertikal yang diputar dalam feed swipe tanpa henti, di platform yang dicakup DoomMeter.
_Avoid_: reel, short, konten

**Platform**:
Salah satu dari tiga sumber short-form video: Instagram, YouTube, TikTok.
_Avoid_: app, aplikasi sumber

**Short-form surface**:
Tempat di dalam sebuah **Platform** tempat feed swipe vertikal tampil. Semua pintu masuk ke feed itu dihitung sama: tab Reels, Explore, DM, atau post di feed yang dibuka ke feed Reels (Instagram); Shorts (YouTube); For You dan Following (TikTok). Video panjang, Stories, dan sekadar melihat thumbnail tidak termasuk. Surface dianggap aktif hanya selama feed swipe itu sendiri terlihat dengan video utama di fokus; membuka komentar atau profil kreator menghentikan penghitungan sampai user kembali ke feed.
_Avoid_: halaman, tab

**Watched video**:
Satu **Short-form video** yang tampil di layar selama minimal 5 detik. Skip yang lebih cepat dari itu tidak dihitung.
_Avoid_: view, tontonan

**Watch time**:
Total waktu user berada di **Short-form surface** dengan layar menyala, termasuk video yang di-skip dan 5 detik pertama. Bukan jumlah panjang video yang ditonton.
_Avoid_: durasi video, duration

**Day**:
Periode tempat **Watched video** dan **Watch time** dijumlahkan. Dihitung per hari, bukan per sesi, dan tidak bisa direset manual. Berganti pukul 04:00 waktu lokal (bisa diatur) agar scroll larut malam tetap masuk hari yang sama.
_Avoid_: sesi, session

**Tier**:
Tingkat keparahan 0–4 (Fresh, Drifting, Doomed, Cooked, Terminal) yang diturunkan dari jumlah **Watched video** dan **Watch time** pada **Day** berjalan. Rumus dan ambang ada di design system.
_Avoid_: level, status

**Mood avatar**:
Wajah maskot yang berubah per **Tier**. Hanya dekoratif; label **Tier** yang membawa makna.
_Avoid_: ikon, emoji

**Overlay pill**:
Pop-up kecil di atas layar yang menampilkan **Mood avatar**, jumlah **Watched video**, **Watch time**, dan label **Tier**. Hanya tampil saat sebuah **Short-form surface** aktif di foreground; di luar itu hilang.
_Avoid_: widget, notifikasi, HUD
