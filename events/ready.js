const { REST, Routes, ActivityType, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const { clientId, token } = require('../config.json');
const fs = require('fs');
const path = require('path');
const config = require('../config.json');
const AntiSpam = require('../models/antimodules/antiSpam');
const Giveaway = require('../models/giveaways/Giveaway');

module.exports = {
    name: 'ready',
    once: true,
    async execute(client) {
        console.log('\x1b[35m[ STARTUP ]\x1b[0m Bot process initiated.');

        // Initialize user cache efficiently
        await client.users.fetch({ cache: true }).catch(() => {});
        console.log(`\x1b[36m[ CACHE ]\x1b[0m Pre-fetched user cache.`);

        // Setup commands map if it doesn't exist
        if (!client.commands) {
            client.commands = new Map();
        }

        // --- Load Slash Commands ---
        const commands = [];
        const commandsPath = path.join(__dirname, '../commands');
        
        try {
            const commandFolders = fs.readdirSync(commandsPath);

            for (const folder of commandFolders) {
                const folderPath = path.join(commandsPath, folder);
                const fileNames = fs.readdirSync(folderPath);

                for (const file of fileNames) {
                    if (file.endsWith('.js')) {
                        const filePath = path.join(folderPath, file);
                        const command = require(filePath);
                        
                        // Register command in collections
                        client.commands.set(command.name, command);
                        
                        // Use provided slashCommand object or fallback to the command object itself
                        const slashData = command.slashCommand || command;
                        
                        // Ensure it has data to register
                        if (slashData && slashData.name) {
                            commands.push(slashData);
                        } else {
                            console.warn(`\x1b[33m[ WARNING ]\x1b[0m Command at ${filePath} is missing required data for slash command registration.`);
                        }
                    }
                }
            }

            console.log(`\x1b[36m[ COMMANDS ]\x1b[0m Loaded \x1b[32m${commands.length}\x1b[0m slash commands locally.`);

            // Register with Discord API
            const rest = new REST({ version: '10' }).setToken(token);
            
            try {
                const data = await rest.put(
                    Routes.applicationCommands(clientId),
                    { body: commands }
                );
                console.log(`\x1b[36m[ DISCORD API ]\x1b[0m Successfully registered \x1b[32m${data.length}\x1b[0m application commands globally.`);
            } catch (error) {
                console.error('\x1b[31m[ DISCORD API ERROR ]\x1b[0m Failed to register commands:', error);
            }
        } catch (error) {
            console.error('\x1b[31m[ SYSTEM ERROR ]\x1b[0m Failed to load or register commands:', error);
        }

        // --- Presence Configuration ---
        if (config.botPresence && config.botPresence.activities && config.botPresence.activities.length > 0) {
            let currentActivityIndex = 0;
            const activities = config.botPresence.activities;

            const updatePresence = () => {
                const activity = activities[currentActivityIndex];
                
                // Replace placeholders
                const name = activity.name
                    .replace('{servers}', client.guilds.cache.size)
                    .replace('{users}', client.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0));

                client.user.setPresence({
                    activities: [{
                        name: name,
                        type: ActivityType[activity.type] || ActivityType.Playing
                    }],
                    status: config.botPresence.status || 'online',
                });

                currentActivityIndex = (currentActivityIndex + 1) % activities.length;
            };

            updatePresence();
            setInterval(updatePresence, 300000); // Update every 5 minutes
            console.log('\x1b[36m[ PRESENCE ]\x1b[0m Presence rotation active.');
        } else {
            console.log('\x1b[33m[ PRESENCE ]\x1b[0m No presence activities configured.');
        }

        // --- Start Handlers ---
        try {
            const startYouTubeNotifications = require('./youTubeHandler');
            startYouTubeNotifications(client);

            const startTwitchNotifications = require('./twitchHandler');
            startTwitchNotifications(client);
            
            const startFacebookNotifications = require('./facebookHandler');
            startFacebookNotifications(client);
            
            const startInstagramNotifications = require('./instagramHandler');
            startInstagramNotifications(client);

            console.log('\x1b[36m[ SERVICES ]\x1b[0m All notification handlers started successfully.');
        } catch (error) {
            console.error('\x1b[31m[ SYSTEM ERROR ]\x1b[0m Error initializing notification handlers:', error);
        }

        // Initialize AntiSpam module map
        client.antiSpamSettings = new Map();
        try {
            const settings = await AntiSpam.find({});
            settings.forEach(setting => {
                client.antiSpamSettings.set(setting.guildId, {
                    enabled: setting.enabled,
                    logChannel: setting.logChannelId
                });
            });
            console.log(`\x1b[36m[ SECURITY ]\x1b[0m AntiSpam config loaded for ${settings.length} servers.`);
        } catch (error) {
            console.error("\x1b[31m[ SYSTEM ERROR ]\x1b[0m Error fetching AntiSpam settings:", error);
        }

        // Connect Riffy Player if enabled
        if (config.excessCommands && config.excessCommands.music) {
            try {
                if (client.riffy && typeof client.riffy.init === 'function') {
                    // Use standard init without bot user override since that caused errors
                    client.riffy.init(client.user.id);
                    console.log('\x1b[35m[ MUSIC ]\x1b[0m Riffy music client initialized.');
                } else {
                    console.warn('\x1b[33m[ MUSIC ]\x1b[0m Riffy client exists but init function not found or failed.');
                }
            } catch (error) {
                console.error('\x1b[31m[ MUSIC ERROR ]\x1b[0m Failed to initialize Riffy:', error);
            }
        } else {
            console.log('\x1b[33m[ MUSIC ]\x1b[0m Music module is disabled in config.');
        }

        // Restart active giveaways
        try {
            const activeGiveaways = await Giveaway.find({ ended: false });
            
            for (const giveaway of activeGiveaways) {
                const channel = client.channels.cache.get(giveaway.channelId);
                if (!channel) continue;
                
                try {
                    const message = await channel.messages.fetch(giveaway.messageId);
                    if (!message) continue;
                    
                    const timeLeft = giveaway.endTime - Date.now();
                    
                    if (timeLeft <= 0) {
                        // End immediately if time passed
                        endGiveaway(client, giveaway, message);
                    } else {
                        // Schedule end for remaining time
                        setTimeout(() => {
                            endGiveaway(client, giveaway, message);
                        }, timeLeft);
                    }
                } catch (err) {
                    console.error(`Could not fetch giveaway message: ${err.message}`);
                }
            }
            if (activeGiveaways.length > 0) {
                console.log(`\x1b[36m[ GIVEAWAY ]\x1b[0m Resumed ${activeGiveaways.length} active giveaways.`);
            }
        } catch (error) {
            console.error('\x1b[31m[ SYSTEM ERROR ]\x1b[0m Failed to resume giveaways:', error);
        }

        // Log final ready state
        const readyTimestamp = new Date().toLocaleString();
        console.log(`\x1b[32m[ SUCCESS ]\x1b[0m ${client.user.tag} is fully online and ready!`);
        console.log(`\x1b[36m[ INFO ]\x1b[0m Servers: \x1b[32m${client.guilds.cache.size}\x1b[0m | Users: \x1b[32m${client.users.cache.size}\x1b[0m`);
    },
};

// Helper function to end giveaways when resumed
async function endGiveaway(client, giveawayData, message) {
    try {
        // Find giveaway again to ensure it hasn't ended manually
        const currentData = await Giveaway.findById(giveawayData._id);
        if (!currentData || currentData.ended) return;
        
        const winnersCount = currentData.winners;
        const participants = currentData.participants;
        
        let winners = [];
        if (participants.length > 0) {
            const shuffled = participants.sort(() => 0.5 - Math.random());
            winners = shuffled.slice(0, Math.min(winnersCount, participants.length));
        }
        
        const embed = EmbedBuilder.from(message.embeds[0])
            .setTitle(`${currentData.prize} (Ended)`)
            .setColor('#71368a')
            .setDescription(`**Ended:** <t:${Math.floor(Date.now() / 1000)}:R>\n**Hosted by:** <@${currentData.hostId}>\n\n**Winners:** ${winners.length > 0 ? winners.map(id => `<@${id}>`).join(', ') : 'No valid participants.'}`);
            
        const button = new ButtonBuilder()
            .setCustomId('join_giveaway')
            .setLabel('Giveaway Ended')
            .setEmoji('🎉')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(true);
            
        const participantButton = new ButtonBuilder()
            .setCustomId('view_participants')
            .setLabel(`Participants: ${participants.length}`)
            .setStyle(ButtonStyle.Primary)
            .setDisabled(false); // Still allow viewing after end
            
        const row = new ActionRowBuilder().addComponents(button, participantButton);
        
        await message.edit({ embeds: [embed], components: [row] });
        
        if (winners.length > 0) {
            await message.reply(`Congratulations ${winners.map(id => `<@${id}>`).join(', ')}! You won the **${currentData.prize}**!`);
        } else {
            await message.reply('Giveaway ended! No valid participants to choose a winner from.');
        }
        
        currentData.ended = true;
        await currentData.save();
        
    } catch (error) {
        console.error('Error ending resumed giveaway:', error);
    }
}
