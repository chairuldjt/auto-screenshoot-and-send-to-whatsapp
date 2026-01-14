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
    console.log('Sync wait done, checking for saved group...');

    let selectedGroupId = loadSavedGroupId();

    if (!selectedGroupId) {
        // No saved group, prompt for manual input
        console.log('No saved group found.');
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
        console.log(`Using saved group ID: ${selectedGroupId}`);
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
            caption: `Screenshot ${new Date().toLocaleString()}`,
            sendSeen: false  // Disable sendSeen to avoid markedUnread error
        });
        console.log('Screenshot sent successfully');
    } catch (error) {
        console.error('Error sending screenshot:', error.message);
        // Don't crash the app, just log the error
    }
}