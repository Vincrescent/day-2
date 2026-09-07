# LUMENVEIL — Astral Wish (Day 2)

Sistem gacha berbasis web (vanilla HTML/CSS/JS + Three.js) dengan mekanik wish bergaya cinematic:
single/multi pull, rarity 3–5★, soft/hard pity, 4★ guarantee, 50/50 featured, riwayat pull, dan
animasi orb + card reveal.

## Menjalankan

1. Buka `index.html` langsung di browser (double-click) **atau**
2. Sajikan lewat server lokal:
   ```bash
   cd "D:\CODE\30 DAYS\DAY 2"
   python -m http.server 8080
   ```
   lalu buka `http://localhost:8080`.

Three.js di-vendor lokal (`js/vendor/three.min.js`) agar aplikasi tetap jalan tanpa CDN. Jika file vendor hilang atau perangkat tidak mendukung WebGL, aplikasi otomatis turun ke animasi CSS 2D (fallback) tanpa mengganggu pull logic.

## Struktur

```
index.html          shell UI (banner, dock pity, riwayat)
css/style.css       design token + layout + keyframes 2D
js/items.js         katalog item original + rarity + warna
js/gacha-core.js    logika probabilitas & pity (inti, bisa diunit-test)
js/vendor/three.min.js  Three.js r128 lokal untuk mode offline
js/scene3d.js       summon cinematic: starfield + crystal orb + burst + flash + camera shake
js/scene2d.js       fallback CSS-only saat WebGL/CDN tidak tersedia
js/app.js           orkestrasi UI: state, pity bar, history, currency, skip, hasil
```

## Mekanik

### Probabilitas (lihat `js/gacha-core.js`)
- ★5 Legendary: **0.6%** dasar
- ★4 Rare: **5.1%**
- ★3 Common: sisanya (~94.3%)

### Pity
- **Soft pity ★5:** sejak pull ke-74 peluang ★5 naik tajam (rumus kuadrat, di-clamp maksimum 100%).
- **Hard pity ★5:** pull ke-90 **dijamin** ★5.
- **Hard pity ★4:** maksimal 10 pull tanpa ★4 → pull ke-10 dijamin ★4; counter reset saat dapat ★4/★5.
- Counter pity disimpan di `localStorage`.

### 50/50
- Saat ★5 muncul: 50% featured (rate-up), 50% standar.
- Kalau kalah 50/50 → ★5 berikutnya **dijamin** featured (guarantee).

### Currency & Pull
- Wish ×1: 160 Gems, Wish ×10: 1600 Gems (minimal satu ★4 dijamin di batch 10×).
- Klik saldo Gems untuk top-up demo (+1,600). Tidak ada backend — semua state lokal.

## Catatan IP
Proyek ini **orisinal**: nama (LUMENVEIL, Virelai, dll.), karakter, ikon, latar, dan partikel dibuat
dengan CSS/SVG generatif. Yang diambil dari game lain **hanya mekanik dan "feel" animasi**, bukan
aset, nama, atau logo berhak cipta.

## Modifikasi cepat
- Ubah peluang: konstanta di `GachaCore.pick`.
- Ubah ambang soft/hard pity: angka `74` / `90` / `10`.
- Tambah item: array `GACHA_ITEMS` di `js/items.js` (tandai `featured: true` untuk rate-up).
- Ubah intensitas bloom/particle: parameter di `js/scene3d.js`.
