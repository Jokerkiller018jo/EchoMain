const fs = require('fs');
const path = require('path');
const configPath = path.join(__dirname, '../config.json');

const loadLanguage = () => {
    try {
        const configData = fs.readFileSync(configPath, 'utf8');
        const config = JSON.parse(configData);
        const languagePath = path.join(__dirname, `../languages/${config.language}.json`);
        
        if (fs.existsSync(languagePath)) {
            const langData = fs.readFileSync(languagePath, 'utf8');
            return JSON.parse(langData);
        } else {
            console.error(`Language file for ${config.language} not found!`);
            return {};
        }
    } catch (err) {
        console.error('Error loading config or language file:', err);
        return {};
    }
};

module.exports = loadLanguage();
