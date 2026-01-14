const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const screenshot = require('screenshot-desktop');
const cron = require('node-cron');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
require('dotenv').config();

const GROUP_ID = process.env.GROUP_ID || '120363423652785425@g.us'; // Default fallback
const CRON_SCHEDULE = process.env.CRON_SCHEDULE || '0 * * * *'; // Default every hour
const SAVED_GROUP_FILE = path.join(__dirname, '.saved_group_id');

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

        const savedGroupId = loadSavedGroupId();

        console.log('\n=== PILIH GRUP UNTUK MENGIRIM SCREENSHOT ===');

        if (savedGroupId) {
            console.log(`Grup tersimpan sebelumnya: ${savedGroupId}`);
            console.log('1. Gunakan grup tersimpan');
        }

        const groups = chats ? chats.filter(chat => chat.isGroup) : [];
        const startIndex = savedGroupId ? 2 : 1;

        if (groups.length > 0) {
            console.log('\nGrup yang tersedia:');
            groups.forEach((group, index) => {
                console.log(`${startIndex + index}. ${group.name} (ID: ${group.id._serialized})`);
            });
        } else {
            console.log('\nGrup yang tersedia:');
            console.log('Tidak ada grup ditemukan.');
        }

        console.log('\n0. Masukkan Group ID secara manual');

        const maxChoice = startIndex + groups.length - 1;
        const promptText = savedGroupId ?
            'Pilih nomor grup atau 0 untuk manual: ' :
            'Pilih nomor grup (1-' + groups.length + ') atau 0 untuk manual: ';

        rl.question(promptText, (answer) => {
            const choice = parseInt(answer.trim());

            if (savedGroupId && choice === 1) {
                console.log(`Menggunakan grup tersimpan: ${savedGroupId}`);
                rl.close();
                resolve(savedGroupId);
            } else if (choice === 0) {
                rl.question('Masukkan Group ID (contoh: 120363423652785425@g.us): ', (groupId) => {
                    const cleanId = groupId.trim();
                    saveGroupId(cleanId);
                    rl.close();
                    resolve(cleanId);
                });
            } else if (groups.length > 0 && choice >= startIndex && choice <= maxChoice) {
                const selectedGroup = groups[choice - startIndex];
                console.log(`Grup dipilih: ${selectedGroup.name}`);
                saveGroupId(selectedGroup.id._serialized);
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

    // Check if this is a fresh start (no auth folder)
    const fs = require('fs');
    const path = require('path');
    const authPath = path.join(__dirname, '.wwebjs_auth');
    const isFreshStart = !fs.existsSync(authPath);

    if (isFreshStart) {
        console.log('Detected fresh start (no auth folder), using manual input mode...');
        // Wait longer for fresh start: 60 seconds
        await new Promise(resolve => setTimeout(resolve, 60000));
        console.log('Sync wait done (60s), skipping getChats for reliability...');
    } else {
        console.log('Auth folder found, attempting normal mode...');
        // Normal wait: 5 seconds
        await new Promise(resolve => setTimeout(resolve, 5000));
        console.log('Sync wait done (5s), checking for saved group...');
    }

    let selectedGroupId = null;
    const savedGroupId = loadSavedGroupId();

    if (savedGroupId) {
        console.log(`Found saved group ID: ${savedGroupId}`);
        // Ask if user wants to use saved group or choose new one
        selectedGroupId = await promptGroup(null); // Pass null to indicate we have saved group
    } else {
        if (isFreshStart) {
            // Fresh start: directly use manual input
            console.log('Fresh start detected, using manual input for reliability...');
            console.log('Silakan masukkan Group ID secara manual.');
            const rl = readline.createInterface({
                input: process.stdin,
                output: process.stdout
            });
            selectedGroupId = await new Promise((resolve) => {
                rl.question('Masukkan Group ID (contoh: 120363423652785425@g.us): ', (groupId) => {
                    const cleanId = groupId.trim();
                    saveGroupId(cleanId);
                    rl.close();
                    resolve(cleanId);
                });
            });
        } else {
            // Normal start: give user choice
            console.log('No saved group found.');
            console.log('Pilih cara mendapatkan grup:');
            console.log('1. Coba dapatkan grup otomatis (mungkin perlu waktu)');
            console.log('2. Masukkan Group ID secara manual (cepat)');

            const rl = readline.createInterface({
                input: process.stdin,
                output: process.stdout
            });

            selectedGroupId = await new Promise((resolve) => {
                rl.question('Pilih 1 atau 2: ', async (choice) => {
                    rl.close();

                    if (choice.trim() === '2') {
                        // Manual input
                        console.log('Silakan masukkan Group ID secara manual.');
                        const manualRl = readline.createInterface({
                            input: process.stdin,
                            output: process.stdout
                        });
                        manualRl.question('Masukkan Group ID (contoh: 120363423652785425@g.us): ', (groupId) => {
                            const cleanId = groupId.trim();
                            saveGroupId(cleanId);
                            manualRl.close();
                            resolve(cleanId);
                        });
                    } else {
                        // Try auto
                        console.log('Mencoba mendapatkan daftar chat...');

                        let chats = null;

                        // Try to get chats with faster retry attempts
                        for (let attempt = 1; attempt <= 3; attempt++) {
                            try {
                                console.log(`Attempt ${attempt}/3 to get chats...`);
                                // Set a shorter timeout for getChats
                                const timeoutPromise = new Promise((_, reject) =>
                                    setTimeout(() => reject(new Error('getChats timeout')), 10000)
                                );
                                chats = await Promise.race([client.getChats(), timeoutPromise]);
                                console.log(`Successfully retrieved ${chats.length} chats`);
                                break;
                            } catch (error) {
                                console.log(`Attempt ${attempt} failed: ${error.message}`);
                                if (attempt < 3) {
                                    const waitTime = attempt * 3000; // Faster wait: 3s, 6s
                                    console.log(`Waiting ${waitTime/1000} seconds before retry...`);
                                    await new Promise(resolve => setTimeout(resolve, waitTime));
                                }
                            }
                        }

                        if (!chats) {
                            console.log('\nGagal mendapatkan daftar chat otomatis.');
                            console.log('Silakan masukkan Group ID secara manual.');
                            const manualRl = readline.createInterface({
                                input: process.stdin,
                                output: process.stdout
                            });
                            manualRl.question('Masukkan Group ID (contoh: 120363423652785425@g.us): ', (groupId) => {
                                const cleanId = groupId.trim();
                                saveGroupId(cleanId);
                                manualRl.close();
                                resolve(cleanId);
                            });
                        } else {
                            // Get chats successful, let user choose group
                            const chosenId = await promptGroup(chats);
                            resolve(chosenId);
                        }
                    }
                });
            });
        }
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