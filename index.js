const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const screenshot = require('screenshot-desktop');
const cron = require('node-cron');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
require('dotenv').config();

const GROUP_PRESETS = process.env.GROUP_PRESETS ? process.env.GROUP_PRESETS.split(',').map(preset => {
    const trimmed = preset.trim();
    const colonIndex = trimmed.lastIndexOf(':');
    if (colonIndex > 0) {
        const name = trimmed.substring(0, colonIndex).trim();
        const id = trimmed.substring(colonIndex + 1).trim();
        return { name, id };
    } else {
        // Fallback for old format (just ID)
        return { name: trimmed, id: trimmed };
    }
}) : [];
const CRON_SCHEDULE = process.env.CRON_SCHEDULE || '0 * * * *'; // Default every hour
const SAVED_GROUP_FILE = path.join(__dirname, '.saved_group_id');
const PREIMAGE_DIR = path.join(__dirname, 'preimage');
const ENABLE_TEST_SEND = process.env.ENABLE_TEST_SEND === 'true'; // Default false

// Helper functions for saving/loading group ID
function saveGroupId(groupId) {
    try {
        fs.writeFileSync(SAVED_GROUP_FILE, groupId);
        console.log(`Group ID saved: ${groupId}`);
    } catch (error) {
        console.error('Error saving group ID:', error.message);
    }
}

function loadSavedGroupId() {
    try {
        if (fs.existsSync(SAVED_GROUP_FILE)) {
            const savedId = fs.readFileSync(SAVED_GROUP_FILE, 'utf8').trim();
            console.log(`Loaded saved group ID: ${savedId}`);
            return savedId;
        }
    } catch (error) {
        console.error('Error loading saved group ID:', error.message);
    }
    return null;
}

// Helper function to get available images from preimage folder
function getAvailableImages() {
    if (!fs.existsSync(PREIMAGE_DIR)) {
        fs.mkdirSync(PREIMAGE_DIR, { recursive: true });
        console.log('Folder preimage telah dibuat.');
        return [];
    }
    
    try {
        const files = fs.readdirSync(PREIMAGE_DIR).filter(file => {
            const ext = path.extname(file).toLowerCase();
            return ['.png', '.jpg', '.jpeg', '.gif'].includes(ext);
        });
        return files;
    } catch (error) {
        console.error('Error reading preimage folder:', error.message);
        return [];
    }
}

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true, // Run in background without opening browser
        protocolTimeout: 60000,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu',
            '--disable-web-security',
            '--disable-features=VizDisplayCompositor'
        ]
    },
    webVersionCache: {
        type: 'remote',
        remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html',
    }
});

client.on('qr', (qr) => {
    console.log('Scan QR code di bawah ini dengan WhatsApp:');
    qrcode.generate(qr, { small: true });
});

client.on('ready', async () => {
    console.log('Client is ready! Waiting for sync...');

    // Wait 10 seconds for sync
    await new Promise(resolve => setTimeout(resolve, 10000));
    console.log('Sync wait done, showing group selection menu...');

    // Always show group selection menu
    console.log('\n=== Auto Screenshot WhatsApp Bot ===');
    console.log('Pilih opsi untuk Group ID:');

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    // Show preset options if available
    let optionIndex = 1;
    if (GROUP_PRESETS.length > 0) {
        console.log('\nPreset Groups:');
        GROUP_PRESETS.forEach((preset, index) => {
            console.log(`${optionIndex}. ${preset.name}`);
            optionIndex++;
        });
    }

    console.log('\nOther Options:');
    const manualOption = optionIndex++;
    console.log(`${manualOption}. Masukkan Group ID secara manual`);
    const clearOption = optionIndex++;
    console.log(`${clearOption}. Hapus sesi tersimpan (clear saved group)`);
    const logoutOption = optionIndex++;
    console.log(`${logoutOption}. Logout WhatsApp (hapus session login WA)`);

    const choice = await new Promise((resolve) => {
        rl.question('\nPilih nomor opsi: ', (answer) => {
            resolve(parseInt(answer.trim()));
        });
    });

    let selectedGroupId;

    if (choice >= 1 && choice < manualOption) {
        // Selected a preset
        const presetIndex = choice - 1;
        selectedGroupId = GROUP_PRESETS[presetIndex].id;
        console.log(`Selected preset group: ${GROUP_PRESETS[presetIndex].name} (${selectedGroupId})`);
        saveGroupId(selectedGroupId);
    } else if (choice === manualOption) {
        // Manual input
        selectedGroupId = await new Promise((resolve) => {
            rl.question('Masukkan Group ID (contoh: 120363423652785425@g.us): ', (groupId) => {
                const cleanId = groupId.trim();
                saveGroupId(cleanId);
                rl.close();
                resolve(cleanId);
            });
        });
    } else if (choice === clearOption) {
        // Clear saved session
        if (fs.existsSync(SAVED_GROUP_FILE)) {
            fs.unlinkSync(SAVED_GROUP_FILE);
            console.log('Sesi tersimpan telah dihapus.');
        } else {
            console.log('Tidak ada sesi tersimpan untuk dihapus.');
        }
        console.log('Silakan restart bot untuk memilih grup baru.');
        process.exit(0);
    } else if (choice === logoutOption) {
        // Logout WhatsApp (delete session)
        const authDir = path.join(__dirname, 'auth_info_baileys');
        if (fs.existsSync(authDir)) {
            fs.rmSync(authDir, { recursive: true, force: true });
            console.log('Session login WhatsApp telah dihapus.');
        } else {
            console.log('Tidak ada session WhatsApp yang tersimpan.');
        }
        console.log('Silakan restart bot untuk melakukan scan QR code baru.');
        process.exit(0);
    } else {
        console.log('Pilihan tidak valid. Menggunakan input manual.');
        selectedGroupId = await new Promise((resolve) => {
            rl.question('Masukkan Group ID (contoh: 120363423652785425@g.us): ', (groupId) => {
                const cleanId = groupId.trim();
                saveGroupId(cleanId);
                rl.close();
                resolve(cleanId);
            });
        });
    }

    rl.close();

    console.log(`Grup target: ${selectedGroupId}`);

    // Ask for mode selection
    console.log('\n=== Pilih Mode Pengiriman ===');
    console.log('1. Realtime Screenshot Mode (ambil screenshot & kirim sesuai jadwal)');
    console.log('2. Send Prepared Image Mode (kirim gambar yang sudah disiapkan)');

    const modeRl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    const modeChoice = await new Promise((resolve) => {
        modeRl.question('\nPilih mode (1 atau 2): ', (answer) => {
            resolve(parseInt(answer.trim()));
        });
    });

    modeRl.close();

    if (modeChoice === 1) {
        // Realtime Screenshot Mode
        console.log('Mode: Realtime Screenshot');
        
        // Send test screenshot if enabled
        if (ENABLE_TEST_SEND) {
            try {
                console.log('Sending test screenshot...');
                const testFilepath = await takeScreenshot();
                await sendScreenshot(selectedGroupId, testFilepath);
                console.log('Test screenshot sent successfully');
            } catch (error) {
                console.error('Error sending test screenshot:', error);
            }
        }
        
        cron.schedule(CRON_SCHEDULE, async () => {
            try {
                const filepath = await takeScreenshot();
                await sendScreenshot(selectedGroupId, filepath);
                console.log('Scheduled screenshot sent successfully');
            } catch (error) {
                console.error('Error in cron job:', error);
            }
        });
        console.log(`Bot started successfully. Screenshot will be taken according to schedule: ${CRON_SCHEDULE}`);
    } else if (modeChoice === 2) {
        // Send Prepared Image Mode
        console.log('Mode: Send Prepared Image');
        
        const availableImages = getAvailableImages();
        
        if (availableImages.length === 0) {
            console.error('Tidak ada gambar di folder preimage. Silakan letakkan file gambar (.png, .jpg, .jpeg, .gif) di folder preimage terlebih dahulu.');
            process.exit(1);
        }

        console.log('\nGambar yang tersedia di folder preimage:');
        availableImages.forEach((file, index) => {
            console.log(`${index + 1}. ${file}`);
        });

        const imageRl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        const imageChoice = await new Promise((resolve) => {
            imageRl.question('\nPilih nomor gambar (atau ketik nama file): ', (answer) => {
                resolve(answer.trim());
            });
        });

        imageRl.close();

        let selectedImage;
        const choiceNum = parseInt(imageChoice);

        if (choiceNum > 0 && choiceNum <= availableImages.length) {
            selectedImage = availableImages[choiceNum - 1];
        } else {
            // Anggap sebagai nama file
            selectedImage = imageChoice;
        }

        const fullImagePath = path.join(PREIMAGE_DIR, selectedImage);

        // Check if file exists
        if (!fs.existsSync(fullImagePath)) {
            console.error(`File tidak ditemukan: ${fullImagePath}`);
            process.exit(1);
        }

        console.log(`Gambar yang dipilih: ${selectedImage}`);

        // Send test image if enabled
        if (ENABLE_TEST_SEND) {
            try {
                console.log('Sending test image...');
                await sendScreenshot(selectedGroupId, fullImagePath);
                console.log('Test image sent successfully');
            } catch (error) {
                console.error('Error sending test image:', error);
            }
        }

        // Schedule sending prepared image
        cron.schedule(CRON_SCHEDULE, async () => {
            try {
                await sendScreenshot(selectedGroupId, fullImagePath);
                console.log('Scheduled prepared image sent successfully');
            } catch (error) {
                console.error('Error in cron job:', error);
            }
        });
        console.log(`Bot started successfully. Image will be sent according to schedule: ${CRON_SCHEDULE}`);
    } else {
        console.log('Pilihan mode tidak valid. Menggunakan Realtime Screenshot Mode.');
        
        // Send test screenshot if enabled
        if (ENABLE_TEST_SEND) {
            try {
                console.log('Sending test screenshot...');
                const testFilepath = await takeScreenshot();
                await sendScreenshot(selectedGroupId, testFilepath);
                console.log('Test screenshot sent successfully');
            } catch (error) {
                console.error('Error sending test screenshot:', error);
            }
        }
        
        cron.schedule(CRON_SCHEDULE, async () => {
            try {
                const filepath = await takeScreenshot();
                await sendScreenshot(selectedGroupId, filepath);
                console.log('Scheduled screenshot sent successfully');
            } catch (error) {
                console.error('Error in cron job:', error);
            }
        });
        console.log(`Bot started successfully. Screenshot will be taken according to schedule: ${CRON_SCHEDULE}`);
    }

    console.log('Bot is now running in background. You can close this terminal.');
});

client.initialize();

async function takeScreenshot() {
    const img = await screenshot();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `screenshot_${timestamp}.png`;
    const filepath = path.join(__dirname, 'screenshots', filename);
    // Ensure screenshots directory exists
    const dir = path.dirname(filepath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filepath, img);
    return filepath;
}

async function sendScreenshot(groupId, filepath) {
    try {
        // Check if client is still connected
        if (!client.info || client.info.wid === undefined) {
            console.log('Client not connected, skipping screenshot send');
            return;
        }

        const media = MessageMedia.fromFilePath(filepath);
        await client.sendMessage(groupId, media, {
            caption: `Tes Kirim Gambar Custom`,
            sendSeen: false  // Disable sendSeen to avoid markedUnread error
        });
        console.log('Screenshot sent successfully');
    } catch (error) {
        console.error('Error sending screenshot:', error.message);
        // Don't crash the app, just log the error
    }
}