const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const screenshot = require('screenshot-desktop');
const cron = require('node-cron');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
require('dotenv').config();

const GROUP_ID = '120363423652785425@g.us'; // Default fallback
const CRON_SCHEDULE = process.env.CRON_SCHEDULE || '0 * * * *'; // Default every hour

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: false, // Changed to false to see browser and select group
        protocolTimeout: 60000, // Increase timeout to 60 seconds
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu'
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

async function promptGroup(chats) {
    return new Promise((resolve) => {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        console.log('\n=== PILIH GRUP UNTUK MENGIRIM SCREENSHOT ===');
        console.log('Grup yang tersedia:');

        const groups = chats.filter(chat => chat.isGroup);
        if (groups.length === 0) {
            console.log('Tidak ada grup ditemukan. Masukkan Group ID secara manual:');
            rl.question('Masukkan Group ID (contoh: 120363423652785425@g.us): ', (groupId) => {
                rl.close();
                resolve(groupId.trim());
            });
            return;
        }

        groups.forEach((group, index) => {
            console.log(`${index + 1}. ${group.name} (ID: ${group.id._serialized})`);
        });

        console.log('\n0. Masukkan Group ID secara manual');

        rl.question('\nPilih nomor grup (1-' + groups.length + ') atau 0 untuk manual: ', (answer) => {
            const choice = parseInt(answer.trim());

            if (choice === 0) {
                rl.question('Masukkan Group ID (contoh: 120363423652785425@g.us): ', (groupId) => {
                    rl.close();
                    resolve(groupId.trim());
                });
            } else if (choice >= 1 && choice <= groups.length) {
                const selectedGroup = groups[choice - 1];
                console.log(`Grup dipilih: ${selectedGroup.name}`);
                rl.close();
                resolve(selectedGroup.id._serialized);
            } else {
                console.log('Pilihan tidak valid, menggunakan grup default.');
                rl.close();
                resolve(GROUP_ID);
            }
        });
    });
}

client.on('ready', async () => {
    console.log('Client is ready! Waiting for sync...');

    // Wait 15 seconds for sync (increased from 10)
    await new Promise(resolve => setTimeout(resolve, 15000));
    console.log('Sync wait done, attempting to get chats...');

    let selectedGroupId = null;
    let chats = null;

    // Try to get chats with retry mechanism
    for (let attempt = 1; attempt <= 3; attempt++) {
        try {
            console.log(`Attempt ${attempt}/3 to get chats...`);
            chats = await client.getChats();
            console.log(`Successfully retrieved ${chats.length} chats`);
            break;
        } catch (error) {
            console.log(`Attempt ${attempt} failed: ${error.message}`);
            if (attempt < 3) {
                console.log('Waiting 10 seconds before retry...');
                await new Promise(resolve => setTimeout(resolve, 10000));
            }
        }
    }

    // If getChats failed, allow manual input
    if (!chats) {
        console.log('\nGagal mendapatkan daftar chat otomatis.');
        console.log('Silakan masukkan Group ID secara manual.');
        selectedGroupId = await promptGroup([]);
    } else {
        // Get chats successful, let user choose group
        selectedGroupId = await promptGroup(chats);
    }

    if (!selectedGroupId) {
        console.log('Tidak ada grup dipilih, menggunakan fallback default.');
        selectedGroupId = GROUP_ID;
    }

    console.log(`Grup target: ${selectedGroupId}`);

    // Test send screenshot once
    console.log('Taking initial screenshot...');
    const filepath = await takeScreenshot();
    console.log(`Screenshot saved: ${filepath}`);
    await sendScreenshot(selectedGroupId, filepath);
    console.log('Initial screenshot sent successfully');

    // Schedule every hour (or custom schedule from .env)
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
            caption: `Screenshot ${new Date().toLocaleString()}`,
            sendSeen: false  // Disable sendSeen to avoid markedUnread error
        });
        console.log('Screenshot sent successfully');
    } catch (error) {
        console.error('Error sending screenshot:', error.message);
        // Don't crash the app, just log the error
    }
}