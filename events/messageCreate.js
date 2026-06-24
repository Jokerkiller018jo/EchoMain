const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionsBitField } = require('discord.js');
const StickyMessage = require('../models/stickyMessage/stickyMessage');
const BotConfig = require('../models/config/config');
const AutoResponder = require('../models/autoResponder/autoresponder');
const DisabledCommand = require('../models/commands/DisabledCommands'); 
const cmdIcons = require('../UI/icons/commandicons');
const { logLevel } = require('../config.json');

const ServerConfig = require('../models/serverConfig/schema');
const { handleFaqMessage } = require('../handlers/faqHandler');
const handleGroqAI = require('./groqAiHandler');

const XP = require('../models/xp/schema');
const Count = require('../models/count/schema');
const fs = require('fs');
const path = require('path');


const xpCooldowns = new Map();
const COOLDOWN_TIME = 60000; 
const XP_MIN = 15;
const XP_MAX = 25;

const calculateLevelInfo = (level) => {
    const minXP = (level * level) * 100;
    const maxXP = ((level + 1) * (level + 1)) * 100;
    return { minXP, maxXP };
};


const mathExpressions = [
    { text: '0', value: 0 },
    { text: '1', value: 1 },
    { text: '2', value: 2 },
    { text: '3', value: 3 },
    { text: '4', value: 4 },
    { text: '5', value: 5 },
    { text: '6', value: 6 },
    { text: '7', value: 7 },
    { text: '8', value: 8 },
    { text: '9', value: 9 },
    { text: '10', value: 10 },
    { text: '2+2', value: 4 },
    { text: '5-2', value: 3 },
    { text: '3*2', value: 6 },
    { text: '10/2', value: 5 },
    { text: '4+3', value: 7 },
    { text: '8-5', value: 3 },
    { text: '9*1', value: 9 },
    { text: '12/4', value: 3 },
    { text: '5+5', value: 10 },
    { text: '6-6', value: 0 },
    { text: '2*4', value: 8 },
    { text: '15/3', value: 5 },
    { text: '7+2', value: 9 },
    { text: '9-3', value: 6 }
];


const checkAutoResponder = async (message) => {
    if (message.author.bot || !message.guild) return;

    try {
        const aiHandled = await handleGroqAI(message, client);
        if (aiHandled) return;
    } catch (aiError) {
        console.error('Groq AI handler error:', aiError);
    }

    try {
        const faqHandled = await handleFaqMessage(message);
        const responders = await AutoResponder.find({ 
            guildId: message.guild.id 
        });

        for (const responder of responders) {
            let matches = false;

            switch (responder.matchType) {
                case 'exact':
                    matches = message.content.toLowerCase() === responder.trigger.toLowerCase();
                    break;
                case 'contains':
                    matches = message.content.toLowerCase().includes(responder.trigger.toLowerCase());
                    break;
                case 'startsWith':
                    matches = message.content.toLowerCase().startsWith(responder.trigger.toLowerCase());
                    break;
            }

            if (matches) {
                await message.reply(responder.response);
               
                break;
            }
        }
    } catch (error) {
        console.error('Error checking auto responder:', error);
    }
};

module.exports = {
    name: 'messageCreate',
    async execute(message, client) {
     
        if (message.author.bot) return;

     
        await checkAutoResponder(message);

     
        if (client.afkHandler) {
            await client.afkHandler.handleAFKRemoval(message);
            await client.afkHandler.handleMentions(message);
        }
        
    
        if (!message.guild) return;


        try {
            const countConfig = await Count.findOne({ guildId: message.guild.id });
            if (countConfig && countConfig.channelId === message.channel.id) {
           
                let numberValue = null;
                const numberStr = message.content.trim();
                
                if (/^-?\d+$/.test(numberStr)) {
                    numberValue = parseInt(numberStr, 10);
                } else {
                 
                    const expression = mathExpressions.find(e => 
                        e.text.replace(/\s+/g, '') === numberStr.replace(/\s+/g, '')
                    );
                    if (expression) {
                        numberValue = expression.value;
                    }
                }

                if (numberValue !== null) {
               
                    const expectedNumber = countConfig.currentNumber + 1;
                    
                    if (numberValue !== expectedNumber) {
                      
                        if (countConfig.resetOnFail) {
                            countConfig.currentNumber = 0;
                            countConfig.lastUserId = null;
                            countConfig.highestNumber = Math.max(countConfig.highestNumber || 0, countConfig.currentNumber);
                            await countConfig.save();

                            const failEmbed = new EmbedBuilder()
                                .setTitle('❌ Count Failed!')
                                .setDescription(`**${message.author.username}** messed up the count! They counted \`${numberValue}\` instead of \`${expectedNumber}\`.\n\nThe count has been reset to **0**. Start again at **1**!`)
                                .setColor('#ff0000')
                                .setThumbnail('https://i.imgur.com/8Qq8M9L.png');
                            
                            await message.channel.send({ embeds: [failEmbed] });
                            await message.react('❌').catch(() => {});
                        } else {
                            await message.delete().catch(() => {});
                        }
                        return; 
                    }

              
                    if (message.author.id === countConfig.lastUserId) {
                        await message.delete().catch(() => {});
                        return; 
                    }

               
                    countConfig.currentNumber = expectedNumber;
                    countConfig.lastUserId = message.author.id;
                    countConfig.totalCounts = (countConfig.totalCounts || 0) + 1;
                    countConfig.highestNumber = Math.max(countConfig.highestNumber || 0, expectedNumber);
                    
                 
                    const userStatsIndex = countConfig.userStats.findIndex(s => s.userId === message.author.id);
                    if (userStatsIndex > -1) {
                        countConfig.userStats[userStatsIndex].counts += 1;
                    } else {
                        countConfig.userStats.push({ userId: message.author.id, counts: 1 });
                    }

                    await countConfig.save();
                    
               
                    const reactions = ['✅', '🔢', '📈', '🚀', '🌟', '🎯'];
                    const randomReaction = reactions[Math.floor(Math.random() * reactions.length)];
                    await message.react(randomReaction).catch(() => {});

               
                    if (expectedNumber > 0 && expectedNumber % 100 === 0) {
                        const milestoneEmbed = new EmbedBuilder()
                            .setTitle('🎉 Milestone Reached!')
                            .setDescription(`Incredible job! We've reached **${expectedNumber}**!`)
                            .setColor('#00ff00')
                            .setFooter({ text: 'Keep up the great counting!' });
                        await message.channel.send({ embeds: [milestoneEmbed] });
                    }
                    
                    return; 
                } else {
             
                    if (countConfig.deleteNonNumbers) {
                        await message.delete().catch(() => {});
                        return;
                    }
                }
            }
        } catch (error) {
            console.error('Error in counting system:', error);
        }

       
        try {
            const guildId = message.guild.id;
            const channelId = message.channel.id;
            
            const stickyMessage = await StickyMessage.findOne({ guildId, channelId });

            if (stickyMessage) {
                const now = Date.now();
                
         
                const timeDiff = now - (stickyMessage.lastUpdated || 0);
                const countDiff = stickyMessage.messageCount || 0;
                
              
                if (timeDiff >= (stickyMessage.cooldown || 5000) || countDiff >= (stickyMessage.messageThreshold || 5)) {
                 
                    if (stickyMessage.lastMessageId) {
                        try {
                            const oldMessage = await message.channel.messages.fetch(stickyMessage.lastMessageId);
                            if (oldMessage && oldMessage.deletable) {
                                await oldMessage.delete();
                            }
                        } catch (error) {
                            // Ignored if old message not found
                        }
                    }

             
                    const embed = new EmbedBuilder()
                        .setDescription(stickyMessage.content)
                        .setColor('#ffcc00') 
                        .setFooter({ text: '📌 Sticky Message' });

             
                    if (stickyMessage.embedMode === 'embed') {
                        const newMsg = await message.channel.send({ embeds: [embed] });
                        stickyMessage.lastMessageId = newMsg.id;
                    } else {
                        const newMsg = await message.channel.send({ content: `**📌 Sticky:**\n${stickyMessage.content}` });
                        stickyMessage.lastMessageId = newMsg.id;
                    }

                 
                    stickyMessage.lastUpdated = now;
                    stickyMessage.messageCount = 0;
                    await stickyMessage.save();
                } else {
                   
                    stickyMessage.messageCount = countDiff + 1;
                    await stickyMessage.save();
                }
            }
        } catch (error) {
            console.error('Error handling sticky message:', error);
        }

    
        if (!message.content.startsWith(client.prefix || '!')) {
            try {
             
                const botConfig = await BotConfig.findOne({});
                const isSystemOn = botConfig ? botConfig.xpSystemOn : true;
                
                if (isSystemOn) {
                    const userId = message.author.id;
                    const guildId = message.guild.id;
                    const cooldownKey = `${guildId}-${userId}`;

                 
                    if (!xpCooldowns.has(cooldownKey) || Date.now() - xpCooldowns.get(cooldownKey) > COOLDOWN_TIME) {
                        const xpGain = Math.floor(Math.random() * (XP_MAX - XP_MIN + 1)) + XP_MIN;

                        let userXP = await XP.findOne({ userId, guildId });

                        if (!userXP) {
                            userXP = new XP({
                                userId,
                                guildId,
                                xp: xpGain,
                                level: 0
                            });
                        } else {
                            userXP.xp += xpGain;

                            const currentLevelInfo = calculateLevelInfo(userXP.level);

                            if (userXP.xp >= currentLevelInfo.maxXP) {
                                userXP.level += 1;
                                userXP.xp = 0; 
                                
                                const nextLevelInfo = calculateLevelInfo(userXP.level);
                                const maxXP = nextLevelInfo.maxXP;

                                const levelUpEmbed = new EmbedBuilder()
                                    .setAuthor({
                                        name: 'Level Up!',
                                        iconURL: cmdIcons.checkIcon 
                                    })
                                    .setDescription(`Congratulations **${message.author.username}**, you have reached level **${userXP.level}**! 🎉\nNext level requires ${maxXP} XP.`)
                                    .setColor('#00FF00');

                                message.channel.send({ embeds: [levelUpEmbed] });
                            }
                        }

                        await userXP.save();

                 
                        xpCooldowns.set(cooldownKey, Date.now());
                    }
                }
            } catch (error) {
                console.error('Error in XP system:', error);
            }
        }
        
    
        const prefix = client.prefix || '!';
        if (!message.content.startsWith(prefix)) return;

        const args = message.content.slice(prefix.length).trim().split(/ +/);
        const commandName = args.shift().toLowerCase();

   
        let command = client.commands.get(commandName);

   
        if (!command) {
            command = client.commands.find(cmd => cmd.aliases && cmd.aliases.includes(commandName));
        }

        if (command) {
            try {
                if (logLevel >= 3) { 
                    console.log(`Executing prefix command: ${commandName}`);
                }
                
                if (command.isSlashOnly) {
                    if (logLevel >= 2) { 
                        console.log(`Prefix command attempted for slash-only command: ${commandName}`);
                    }
                    return message.reply(`The \`${commandName}\` command is slash-only. Please use \`/${commandName}\` instead.`);
                }
                
            
                const isDisabled = await DisabledCommand.findOne({
                    guildId: message.guild.id,
                    commandName: command.name
                });
                
                if (isDisabled) {
                    return message.reply(`❌ The \`${commandName}\` command is disabled in this server.`);
                }
                
                if (command.executePrefix) {
                    await command.executePrefix(message, args, client);
                } else if (command.execute) {
                    await command.execute(message, client);
                } else {
                    console.error(`Command ${commandName} is missing an execution method.`);
                    if (logLevel >= 1) { 
                        message.reply(`Error: The command \`${commandName}\` is not configured properly.`);
                    }
                }
            } catch (error) {
                console.error(`Error executing prefix command ${commandName}:`, error);
                message.reply('There was an error trying to execute that command!').catch(err => console.error('Failed to send error reply:', err));
            }
        }
    }
};
