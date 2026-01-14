# Auto Screenshot WhatsApp Bot

Bot ini menggunakan whatsapp-web.js untuk mengambil screenshot layar penuh setiap jam dan mengirimkannya ke grup WhatsApp yang dipilih secara interaktif.

## Instalasi

1. Install dependencies:
   ```
   npm install
   ```

2. Jalankan bot:
   ```
   npm start
   ```

3. Scan QR code di terminal untuk login WhatsApp.

4. **Pilih Grup Target**: Bot akan menampilkan daftar semua grup WhatsApp Anda dan meminta Anda memilih grup mana yang akan menerima screenshot.

## Fitur Pemilihan Grup

Bot memiliki beberapa mode pemilihan grup untuk kemudahan penggunaan:

### Mode Grup Tersimpan (Prioritas Tertinggi)
- Bot akan otomatis mendeteksi jika ada grup yang pernah dipilih sebelumnya
- Opsi 1: Gunakan grup tersimpan (paling cepat)
- Grup tersimpan disimpan di file `.saved_group_id` (tidak di-commit ke Git)

### Mode Pilihan Cara Mendapatkan Grup
Ketika belum ada grup tersimpan, bot akan memberikan pilihan:
- **Opsi 1**: Coba dapatkan grup otomatis (akan mencoba 3x dengan timeout cepat)
- **Opsi 2**: Masukkan Group ID secara manual (cepat dan langsung)

### Mode Otomatis (Jika Memilih Opsi 1)
- Bot akan mencoba mengambil daftar semua chat WhatsApp Anda
- Menampilkan daftar grup yang tersedia dengan nomor urut
- Anda cukup memilih nomor grup yang diinginkan

### Mode Manual (Jika Memilih Opsi 2 atau Otomatis Gagal)
- Masukkan Group ID secara manual
- Format: `123456789@g.us` (contoh: `120363423652785425@g.us`)

### Mekanisme Retry
- Jika memilih otomatis, bot akan mencoba mendapatkan chat hingga 3 kali
- Timeout 10 detik per attempt dengan jeda 3-6 detik antar retry
- Jika semua retry gagal, otomatis beralih ke mode manual

## Konfigurasi

- Screenshot disimpan di folder `screenshots/`.
- Jadwal screenshot dapat dikonfigurasi melalui file `.env` (lihat bagian Environment).
- **Default**: Screenshot diambil setiap jam pada menit ke-0.

## Environment

- Salin `.env.example` menjadi `.env` untuk mengubah jadwal screenshot jika diperlukan.
- Jangan commit berkas `.env` yang berisi konfigurasi kustom.
- **CRON_SCHEDULE**: Mengatur kapan screenshot diambil (format cron expression)
  - `0 * * * *` = Setiap jam pada menit ke-0 (default)
  - `*/30 * * * *` = Setiap 30 menit
  - `0 9 * * *` = Setiap hari jam 9 pagi

## Sessions / Auth

- Library menyimpan sesi WhatsApp di folder `.wwebjs_auth/` dan cache di `.wwebjs_cache/`.
- Folder ini sudah ditambahkan ke `.gitignore`.
- Jangan men-commit atau membagikan isi folder auth karena berisi kredensial sesi.
- Untuk memulihkan sesi pada mesin lain, salin secara lokal folder `.wwebjs_auth/` ke direktori proyek (tidak melalui repo).
- **Grup tersimpan**: Bot menyimpan ID grup yang dipilih di file `.saved_group_id` untuk memudahkan penggunaan di kemudian hari.

## Catatan

- Bot berjalan di background setelah login dan pemilihan grup.
- Pastikan Node.js terinstall.
- Bot akan mengambil screenshot setiap jam secara default.
- **Grup tersimpan**: Setelah memilih grup pertama kali, bot akan mengingat pilihan Anda untuk penggunaan selanjutnya.
- Jika bot dimatikan dan dijalankan ulang, Anda akan diberi opsi untuk menggunakan grup tersimpan atau memilih yang baru.
- File `.saved_group_id` berisi ID grup yang dipilih (tidak di-commit ke Git).