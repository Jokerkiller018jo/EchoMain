const { createErrorEmbed, createActionButtons } = require('../utils/groqEmbedUtils');
const { generateChatCompletion } = require('../services/groqService');
const GroqUser = require('../models/groqai/GroqUser');
const Channel = require('../models/groqai/Channel');
const Conversation = require('../models/groqai/Conversation');

async function handleGroqAI(message, client) {
    if (message.author.bot || !message.guild) return false;

    try {
        const isAIChannel = await Channel.isAIChannel(message.guild.id, message.channel.id);
        
        if (isAIChannel) {
            await message.channel.sendTyping();
            
            const aiChannel = await Channel.findOne({ 
                guildId: message.guild.id, 
                channelId: message.channel.id 
            });
            
            const userId = message.author.id;
            const channelId = message.channel.id;
            const username = message.author.username;
            
            const user = await GroqUser.findOrCreateUser(userId, username);
            const conversation = await Conversation.getOrCreateConversation(userId, channelId);
            
            if (conversation.messages.length === 1 && conversation.messages[0].role === 'system') {
                conversation.messages[0].content = aiChannel.settings.systemPrompt;
            }
            
            await conversation.addMessage('user', message.content);
            
            const aiResponse = await generateChatCompletion(conversation.getFormattedMessages(), {
                model: aiChannel.settings.aiModel,
                temperature: user.settings.temperature,
                maxTokens: user.settings.maxTokens,
            });
            
            await conversation.addMessage('assistant', aiResponse);
            
            const actionRow = createActionButtons();
            
            await message.reply({
                content: aiResponse,
                components: [actionRow],
                allowedMentions: { repliedUser: false }
            });
            
            return true; // Indicates AI handled the message
        }
    } catch (error) {
        console.error('Error in Groq AI handler:', error);
        
        const errorEmbed = createErrorEmbed(`Failed to process AI response: ${error.message}`);
        await message.reply({
            embeds: [errorEmbed],
            allowedMentions: { repliedUser: false }
        }).catch(console.error);
        
        return true;
    }
    
    return false;
}

module.exports = handleGroqAI;
