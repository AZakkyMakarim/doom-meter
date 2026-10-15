# React Native untuk UI, modul Kotlin untuk overlay dan deteksi

Layar dalam aplikasi (Today, History, Settings) ditulis dengan React Native. Overlay pill (di atas `WindowManager`) dan AccessibilityService ditulis native Kotlin, karena keduanya tidak bisa dijalankan dari lapisan JS.

Trade-off yang diterima: satu lapisan jembatan tambahan untuk Android-only, sebagai ganti ekosistem font, ikon (Phosphor), dan chart JS serta pintu terbuka bila platform lain dipertimbangkan kelak (lihat 0001). Alternatif yang ditimbang: Kotlin + Compose penuh, dan Flutter.
