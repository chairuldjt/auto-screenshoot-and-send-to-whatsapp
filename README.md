# Auto Screenshot WhatsApp Bot

Bot ini menggunakan whatsapp-web.js untuk mengambil screenshot layar penuh setiap jam dan mengirimkannya ke grup WhatsApp tertentu.

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

## Konfigurasi

- Ganti `GROUP_ID` di `index.js` dengan ID grup WA Anda.
- Screenshot disimpan di folder `screenshots/`.

## Environment

- Salin `.env.example` menjadi `.env` dan isi nilai `GROUP_ID` serta `CRON_SCHEDULE` jika perlu.
- Jangan commit berkas `.env` yang berisi kredensial atau sesi.

## Sessions / Auth

- Library menyimpan sesi WhatsApp di folder `auth_info_baileys/`. Folder ini sudah ditambahkan ke `.gitignore`.
- Jangan men-commit atau membagikan isi `auth_info_baileys/` karena berisi kredensial sesi.
- Untuk memulihkan sesi pada mesin lain, salin secara lokal folder `auth_info_baileys/` ke direktori proyek (tidak melalui repo).

## Catatan

- Bot berjalan di background setelah login.
- Pastikan Node.js terinstall.