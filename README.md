# Auto Screenshot WhatsApp Bot

Bot sederhana yang mengambil screenshot layar secara otomatis setiap jam dan mengirimkannya ke grup WhatsApp yang ditentukan. Bot berjalan sepenuhnya di background tanpa membuka browser.

## Instalasi

1. Install dependencies:
   ```
   npm install
   ```

2. Jalankan bot:
   ```
   npm start
   ```

3. **Input Group ID**: Masukkan ID grup WhatsApp tempat screenshot akan dikirim
4. **Scan QR**: Bot akan menampilkan QR code untuk login WhatsApp
5. **Bot berjalan**: Setelah login berhasil, bot akan berjalan di background

## Konfigurasi Grup

Bot menggunakan **input manual Group ID** untuk kemudahan dan reliability:

- **Pertama kali**: Masukkan Group ID secara manual
- **Selanjutnya**: Bot otomatis menggunakan Group ID yang tersimpan
- **Format ID**: `120363423652785425@g.us`

### Cara Mendapatkan Group ID:

1. **WhatsApp Web**: Buka grup → URL akan berisi ID
2. **Contoh**: `https://web.whatsapp.com/group/120363423652785425@g.us`
3. **Copy ID**: Bagian setelah `/group/`
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

- Bot berjalan di background sepenuhnya tanpa membuka browser WhatsApp.
- Pastikan Node.js terinstall.
- Bot akan mengambil screenshot setiap jam secara default.
- Setelah input Group ID pertama kali, bot akan mengingatnya untuk penggunaan selanjutnya.
- File `.saved_group_id` berisi ID grup yang dipilih (tidak di-commit ke Git).