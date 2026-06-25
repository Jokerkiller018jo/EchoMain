const Module = require('module');
const path = require('path');
const fs = require('fs');

// Tiny 1x1 transparent PNG buffer for fallback image responses
const transparent1x1 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');

// Mock Generator Classes
class MockProfileCardGenerator {
    async generateCard() { return transparent1x1; }
    async generateProfileCard() { return transparent1x1; }
}

class MockWelcomeCardGenerator {
    async generateCard() { return transparent1x1; }
    async generateWelcomeCard() { return transparent1x1; }
}

class MockRankCardGenerator {
    async generateCard() { return transparent1x1; }
    async generateRankCard() { return transparent1x1; }
}

class MockBirthdayCardGenerator {
    async generateCard() { return transparent1x1; }
    async generateBirthdayCard() { return transparent1x1; }
}

class MockEnhancedMusicCard {
    async generateCard() { return transparent1x1; }
    async generateMusicCard() { return transparent1x1; }
}

async function mockDynamicCard() {
    return transparent1x1;
}

// Fallbacks registry for UI files (in case they are completely missing from the upload)
const fallbacks = {
    colors: {
        reset: '\x1b[0m',
        bright: '\x1b[1m',
        dim: '\x1b[2m',
        cyan: '\x1b[36m',
        green: '\x1b[32m',
        yellow: '\x1b[33m',
        magenta: '\x1b[35m',
        gray: '\x1b[90m',
        red: '\x1b[31m',
        blue: '\x1b[36m'
    },
    commandicons: {
        dotIcon: 'https://cdn.discordapp.com/emojis/915658913850998794.gif',
        serverinfoIcon: 'https://cdn.discordapp.com/emojis/942629018296025128.gif',
        YouTubeIcon: 'https://cdn.discordapp.com/emojis/1229455855192379514.png',
        FaceBookIcon: 'https://cdn.discordapp.com/emojis/788969884062711818.png',
        TwitchIcon: 'https://cdn.discordapp.com/emojis/1229455826356404275.gif',
        InstagramIcon: 'https://cdn.discordapp.com/emojis/1188371472104837191.png',
        msgIcon: 'https://cdn.discordapp.com/emojis/915167284648116244.png',
        rippleIcon: 'https://cdn.discordapp.com/emojis/903301195307843595.gif',
        levelUpIcon: 'https://cdn.discordapp.com/emojis/908223980438163476.gif',
        titleIcon: 'https://cdn.discordapp.com/emojis/908223980438163476.gif',
        SSRRIcon: 'https://cdn.discordapp.com/emojis/1334648756649590805.png',
        PollIcon: 'https://i.ibb.co/j9ddStvs/polling.png'
    },
    musicicons: {
        footerIcon: 'https://cdn.discordapp.com/emojis/865916418909536276.gif', 
        correctIcon: 'https://cdn.discordapp.com/emojis/1087275448951648387.gif', 
        playerIcon: 'https://cdn.discordapp.com/emojis/834814432365248563.gif',
        wrongIcon: 'https://cdn.discordapp.com/attachments/1230824451990622299/1236666647000125490/9596-wrong.gif?ex=667e0dd0&is=667cbc50&hm=5e30a7f4ad283075fb7430de42fb7985a13eac81f4323110272875ef007fb786&',
        pauseresumeIcon: 'https://cdn.discordapp.com/emojis/836145735254540339.gif',
        playIcon: 'https://cdn.discordapp.com/attachments/1230824451990622299/1236664581364125787/music-play.gif?ex=669c5e64&is=669b0ce4&hm=b081d67248271167b5aec2e07a2c9c848e16bfa5ba4bdb2067221b0d259c1b38&',
        loopIcon: 'https://cdn.discordapp.com/emojis/749272851529334795.gif',
        beatsIcon: 'https://cdn.discordapp.com/emojis/928310693416009828.gif',
        alertIcon: 'https://cdn.discordapp.com/emojis/996431685358981201.gif',
        skipIcon: 'https://cdn.discordapp.com/emojis/938388856095514654.gif',
        stopIcon: 'https://cdn.discordapp.com/emojis/1021628438441902100.gif',
        volumeIcon: 'https://cdn.discordapp.com/emojis/1040824501711159397.gif'
    },
    ticketicons: {
        mainIcon: 'https://cdn.discordapp.com/emojis/1081651089339858954.gif', 
        correctIcon: 'https://cdn.discordapp.com/emojis/819446784647757834.gif', 
        correctrIcon: 'https://cdn.discordapp.com/attachments/1230824451990622299/1236802049190920202/4104-verify-red.gif?ex=66a5702b&is=66a41eab&hm=5f38fab7b9dab73a6250db1a5e149b94bcdd49b19d6b70e38253fa2b2470615f&',
        heartIcon: 'https://cdn.discordapp.com/attachments/1230824451990622299/1230824519220985896/6280-2.gif?ex=66a571e8&is=66a42068&hm=0761d49758b73e8bbe8785e7998acfd2f1f79b4f623f024072468d4420cc102e&',
        modIcon: 'https://cdn.discordapp.com/emojis/805980519644004372.gif',
        pingIcon: 'https://cdn.discordapp.com/emojis/981302000694210620.gif'
    },
    loghandlers: {
        footerIcon: 'https://cdn.discordapp.com/emojis/910243817217736756.gif', 
        joinIcon: 'https://cdn.discordapp.com/emojis/877479021909245983.gif',
        leaveIcon: 'https://cdn.discordapp.com/emojis/982501821371273227.gif',
        removedIcon: 'https://cdn.discordapp.com/emojis/915892891870691378.gif',
        assignedIcon: 'https://cdn.discordapp.com/emojis/708375601790058596.gif',
        badgeIcon: 'https://cdn.discordapp.com/emojis/900574077750763542.gif',
        nickIcon: 'https://cdn.discordapp.com/emojis/820971058089820200.gif',
        modIcon: 'https://cdn.discordapp.com/emojis/1052751247582699621.gif',
        staffIcon: 'https://cdn.discordapp.com/emojis/959519696057692210.gif',
        msgIcon: 'https://cdn.discordapp.com/emojis/977175346405330984.gif'
    },
    profilecardgenerator: { ProfileCardGenerator: MockProfileCardGenerator },
    welcomecardgenerator: { WelcomeCardGenerator: MockWelcomeCardGenerator },
    rankcardgenerator: { RankCardGenerator: MockRankCardGenerator },
    birthdaycardgenerator: { BirthdayCardGenerator: MockBirthdayCardGenerator },
    enhancedmusiccard: { EnhancedMusicCard: MockEnhancedMusicCard },
    dynamiccard: { dynamicCard: mockDynamicCard }
};

// Case-insensitive path resolver for Linux (case-sensitive OS)
function resolveCaseInsensitive(basePath, relativePath) {
    const parts = relativePath.split(/[/\\]/);
    let currentPath = basePath;
    
    for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        if (part === '.' || part === '') continue;
        if (part === '..') {
            currentPath = path.dirname(currentPath);
            continue;
        }
        
        if (!fs.existsSync(currentPath)) return null;
        
        const files = fs.readdirSync(currentPath);
        const isLast = (i === parts.length - 1);
        
        let matched = files.find(f => f.toLowerCase() === part.toLowerCase());
        
        // If it is the last segment, it could be a filename without extension
        if (!matched && isLast) {
            matched = files.find(f => {
                const ext = path.extname(f);
                const nameWithoutExt = path.basename(f, ext);
                return nameWithoutExt.toLowerCase() === part.toLowerCase();
            });
        }
        
        if (!matched) return null;
        currentPath = path.join(currentPath, matched);
    }
    return currentPath;
}

const originalRequire = Module.prototype.require;
Module.prototype.require = function (id) {
    // 1. Intercept mongoose / mongodb calls
    if (id === 'mongoose' || id === 'mongodb') {
        return originalRequire.call(this, path.join(__dirname, 'mongoose-postgres'));
    }
    
    // 2. Intercept relative imports and try case-insensitive resolution if they fail
    if (id.startsWith('.') || id.startsWith('..')) {
        try {
            return originalRequire.apply(this, arguments);
        } catch (e) {
            if (e.code === 'MODULE_NOT_FOUND') {
                const parentDir = path.dirname(this.filename);
                const correctedPath = resolveCaseInsensitive(parentDir, id);
                if (correctedPath) {
                    return originalRequire.call(this, correctedPath);
                }
                
                // 3. Fallbacks if the module is still not found and belongs to UI
                const lowerId = id.toLowerCase();
                for (const key of Object.keys(fallbacks)) {
                    if (lowerId.endsWith(key) || lowerId.endsWith(`${key}.js`) || lowerId.includes(`ui/${key}`)) {
                        console.warn(`[HIJACK] Fallback triggered for missing UI module: ${id}`);
                        return fallbacks[key];
                    }
                }
            }
            throw e;
        }
    }
    
    return originalRequire.apply(this, arguments);
};

console.log('[HIJACK] Successfully redirected mongoose and mongodb to Postgres DB wrapper.');
