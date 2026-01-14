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

## Catatan

- Bot berjalan di background setelah login.
- Pastikan Node.js terinstall.