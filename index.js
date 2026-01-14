const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const screenshot = require('screenshot-desktop');
const cron = require('node-cron');
const fs = require('fs');
const path = require('path');
const inquirer = require('inquirer');

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
    const groups = chats.filter(chat => chat.isGroup).map(chat => ({ name: chat.name, value: chat.id._serialized }));
    if (groups.length === 0) {
        console.log('Tidak ada grup ditemukan.');
        return null;
    }
    const answer = await inquirer.prompt([{
        type: 'list',
        name: 'groupId',
        message: 'Pilih grup untuk kirim screenshot:',
        choices: groups
    }]);
    return answer.groupId;
}

client.on('ready', async () => {
    console.log('Client is ready! Waiting for sync...');

    // Wait 10 seconds for sync
    await new Promise(resolve => setTimeout(resolve, 10000));
    console.log('Sync wait done, getting chats...');

    try {
        console.log('Calling client.getChats()...');

        // Add timeout for getChats operation
        const chatsPromise = client.getChats();
        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('getChats timed out after 30 seconds')), 30000)
        );

        const chats = await Promise.race([chatsPromise, timeoutPromise]);
        console.log(`Total chats: ${chats.length}`);

        if (chats.length === 0) {
            console.log('No chats found. Please make sure you have chats in WhatsApp.');
            return;
        }

        // Prompt pilih grup
        const selectedGroupId = await promptGroup(chats);
        if (!selectedGroupId) {
            console.log('Tidak ada grup dipilih. Bot berhenti.');
            return;
        }
        console.log(`Grup dipilih: ${selectedGroupId}`);

        // Test send screenshot sekali
        console.log('Taking screenshot...');
        const filepath = await takeScreenshot();
        console.log(`Screenshot saved: ${filepath}`);
        await sendScreenshot(selectedGroupId, filepath);
        console.log('Test screenshot sent');

        // Schedule setiap jam
        cron.schedule('0 * * * *', async () => {
            try {
                const filepath = await takeScreenshot();
                await sendScreenshot(selectedGroupId, filepath);
                console.log('Screenshot sent');
            } catch (error) {
                console.error('Error:', error);
            }
        });

        console.log('Bot started. Screenshot will be taken every hour.');
    } catch (error) {
        console.error('Error in ready event:', error);
        console.error('Error details:', error.message);

        if (error.message.includes('timed out') || error.message.includes('timeout')) {
            console.log('\n🔄 Timeout detected. Possible solutions:');
            console.log('1. Check your internet connection');
            console.log('2. Try restarting the application');
            console.log('3. Make sure WhatsApp Web is accessible');
            console.log('4. If problem persists, try running with headless: false to see browser');
        }

        console.error('Stack trace:', error.stack);
        return;
    }
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