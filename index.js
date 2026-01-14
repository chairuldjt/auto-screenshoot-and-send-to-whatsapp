const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const screenshot = require('screenshot-desktop');
const cron = require('node-cron');
const fs = require('fs');
const path = require('path');
// Removed inquirer import - no longer needed

const GROUP_ID = '120363423652785425@g.us'; // Placeholder, akan diubah prompt

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
    // This function is no longer used since we skip getChats
    console.log('promptGroup function is deprecated - using fallback mode');
    return null;
}

client.on('ready', async () => {
    console.log('Client is ready! Waiting for sync...');

    // Wait 15 seconds for sync (increased from 10)
    await new Promise(resolve => setTimeout(resolve, 15000));
    console.log('Sync wait done, skipping getChats and using fallback mode...');

    // Direct fallback mode - skip getChats entirely
    console.log('Using fallback group ID...');
    const fallbackGroupId = '120363423652785425@g.us'; // Use the previously selected group
    console.log(`Using fallback group: ${fallbackGroupId}`);

    // Test send screenshot sekali with fallback
    console.log('Taking screenshot...');
    const filepath = await takeScreenshot();
    console.log(`Screenshot saved: ${filepath}`);
    await sendScreenshot(fallbackGroupId, filepath);
    console.log('Test screenshot sent with fallback group');

    // Schedule setiap jam dengan fallback
    cron.schedule('0 * * * *', async () => {
        try {
            const filepath = await takeScreenshot();
            await sendScreenshot(fallbackGroupId, filepath);
            console.log('Screenshot sent to fallback group');
        } catch (error) {
            console.error('Error in cron job:', error);
        }
    });

    console.log('Bot started with fallback group. Screenshot will be taken every hour.');
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