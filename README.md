# Housebets Sportsbook — prototipe kontes

**Live:** https://nothing010101.github.io/housebets/ — *Pages build sedang tertahan oleh status billing akun GitHub; lihat “Deploy” di bawah.*

![Pratinjau sports home](preview.jpg)

Prototipe klik-able untuk kontes [Housebets · sportsbook design](https://www.housebets.com/id/contests/sportsbook-design).
Lima halaman, satu shell, data contoh. Tanpa login, tanpa backend, tanpa uang nyata.

> Catatan: paket *starter files* (shell + brand pack) tidak tersedia untuk akun ini, jadi shell, warna, dan tipografi
> diturunkan langsung dari housebets.com — wordmark gelombang, palet marine gelap, aksen aqua sea-glass.

---

## Deploy

Repo sudah berisi situs statis siap saji (tanpa build).

- **Vercel / Netlify:** import repo `nothing010101/housebets`, framework *Other*, output `.`, tanpa build command.
- **GitHub Pages:** Settings → Pages → Source: *Deploy from a branch* → `main` / root.
  URL: https://nothing010101.github.io/housebets/ (build baru berjalan setelah masalah billing akun GitHub diselesaikan).

## Jalankan

```bash
# cukup buka index.html, atau:
python3 -m http.server 8080
# lalu http://localhost:8080
```

Tidak ada build step, tidak ada dependensi, tidak ada request jaringan selain Google Fonts.
Semua state (slip, saldo demo, taruhan, tim yang diikuti) disimpan di `localStorage`.

---

## Halaman

| Halaman | Rute | Isi |
| --- | --- | --- |
| Sports home | `#/` | Spotlight live, Live sekarang, Segera mulai, Kompetisi populer, nav olahraga, pencarian |
| Live | `#/live` | Semua laga berjalan, filter olahraga + kompetisi, skor & menit, empty state → Starting soon |
| Sepak bola | `#/football` | 5 liga, odds hasil di setiap baris, ikuti tim/kompetisi, section "Untukmu" |
| Match | `#/match/ars-bha` | Arsenal v Brighton live, scoreboard, 6 grup pasar, odds bergerak, pasar ditangguhkan |
| Slip + My bets | `#/bets` | Taruhan tunggal, stake USDT, odds berubah, pilihan ditangguhkan, taruhan gagal, cash out |

Semua halaman saling terhubung lewat left nav, kartu, baris laga, breadcrumb, dan slip.

---

## Yang benar-benar berfungsi

**Pasar hidup.** Odds 1X2 di semua laga live bergerak tiap 3,2 detik dengan kilat hijau/merah dan panah delta.
Pasar grup di halaman match ikut bergerak. Pasar "Total gol", "Total kartu", dan "BTTS" ditangguhkan bergiliran
selama 10 detik — tombol odds berubah *striped*, klik ditolak, dan peringatan muncul di slip.

**Skor & jam.** Menit pertandingan bertambah otomatis, skor bisa berubah (gol), dan laga yang belum mulai
punya hitungan mundur yang benar-benar berjalan lalu berubah menjadi live.

**Slip taruhan.**
- Ketuk odds → masuk slip. Ketuk lagi → keluar. Bet tunggal saja, tanpa multi.
- Stake per pilihan (input + chip 10/25/50/Maks), potensi kembali dihitung langsung.
- Kalau odds bergeser ≥ 0,03 setelah dipilih, item menampilkan `Odds berubah 1,74 → 1,66` dan tombol
  **Pasang** terkunci sampai pemain menekan **Terima** (atau **Batalkan**).
- Pilihan yang ditangguhkan memblokir taruhan dengan alasan yang jelas.
- **Pasang** memproses ±1 detik. 12% gagal (pasar ditutup / odds berubah) dengan pesan kegagalan dan tanpa potong saldo.
- Sukses: saldo demo berkurang, slip kosong, tiket baru muncul di My bets dengan animasi.

**My bets.** Tab Terbuka / Selesai, nilai cash out bergerak tiap 6 detik, konfirmasi cairkan inline,
lalu status berubah menjadi Diuangkan dan saldo bertambah.

**Pencarian** (`⌘K` / `Ctrl K` / `/`): tim, pemain, kompetisi, pasar, pertandingan — deterministik, bukan AI,
dengan navigasi keyboard dan hasil terkelompok.

**Ikuti** tim atau kompetisi → laga mereka naik ke section "Untukmu" dan filter "Diikuti" bekerja.

**Responsif.** 1440px: top bar + left nav + side panel + drawer slip kanan.
390px: bottom tab bar, slip bar di atasnya, sheet slip 90vh dengan drag handle, dan segmented control
Slip / Taruhan saya di halaman taruhan.

---

## Sistem desain "Tidal"

- **Permukaan:** marine ink `#050F14` → `#0B222A`, hairline `rgba(163,214,219,.10)`, grain 3,5% agar tidak terasa datar.
- **Aksen:** aqua `#4BE3C8` (aksi & seleksi), coral `#FF7A63` (live), amber `#F2B45C` (ditangguhkan), sand `#E8D9C2` (aksen editorial).
- **Tipografi:** Instrument Serif untuk headline & skor (sentuhan editorial, bukan dashboard generik),
  Inter Tight untuk data dengan angka tabular. Label mikro uppercase + letter-spacing lebar.
- **Bentuk:** radius 8–22px, tinggi baris laga 2 tingkat, satu garis pemisah halus, tanpa kartu bertumpuk berlebihan.
- **Gerak:** 160–380ms dengan easing kustom, semua transisi dihapus saat `prefers-reduced-motion`.

---

## Struktur

```
index.html            shell: top bar, rail, side panel, bottom bar, drawer, palette, sprite ikon
assets/app.css        design system + seluruh komponen + breakpoint 1320/1120/900/420
assets/data.js        tim, kompetisi, 26 laga, 6 grup pasar, pemain, taruhan contoh
assets/app.js         router hash, store localStorage, mesin odds/skor, slip, cash out, pencarian
```

---

## Cakupan kontes

- [x] 5 halaman, saling terhubung, satu shell (top bar, left nav, side panel)
- [x] 390px dan 1440px
- [x] Slip di ponsel: bar bawah
- [x] Front-end saja, data contoh, tanpa login, tanpa uang nyata
- [x] Odds bergerak, pasar ditangguhkan, odds berubah harus diterima, pilihan ditangguhkan
- [x] Taruhan berhasil & gagal, cash out, riwayat terbuka/selesai
- [x] Tanpa multi/akumulator, boost, promo, outright, statistik, atau AI search
