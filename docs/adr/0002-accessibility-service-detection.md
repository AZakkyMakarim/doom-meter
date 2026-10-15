# Deteksi lewat AccessibilityService

Tidak ada API resmi dari Instagram, YouTube, atau TikTok untuk mengetahui video yang ditonton. Kami memakai AccessibilityService untuk membaca event UI dan menurunkan Watched video dan Short-form surface aktif. UsageStats hanya dipakai sebagai fallback Watch time bila deteksi gagal.

Trade-off yang diterima: izin sangat sensitif, Google Play membatasi penggunaan AccessibilityService, dan selektor UI bisa rusak setiap aplikasi target update. Karena itu hanya agregat yang disimpan (tanpa konten atau judul video), data tidak pernah meninggalkan device, dan hari dengan deteksi gagal ditandai "tidak lengkap" di History.

Alternatif ditolak: input manual (tidak masuk akal untuk produk ini) dan UsageStats saja (tidak bisa menghitung jumlah video).
