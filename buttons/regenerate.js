const { createErrorEmbed, createActionButtons } = require('../utils/groqEmbedUtils');
const { generateChatCompletion } = require('../services/groqService');
const GroqUser = require('../models/groqai/GroqUser');
const Conversation = require('../models/groqai/Conversation');

module.exports = {
  customId: 'regenerate',

  async execute(interaction) {
    await interaction.deferUpdate();
    
    try {
      const userId = interaction.user.id;
      const channelId = interaction.channelId;
      const username = interaction.user.username;
      
      const user = await GroqUser.findOrCreateUser(userId, username);
      const conversation = await Conversation.getOrCreateConversation(userId, channelId);
      
      // Remove the last assistant message to regenerate
      if (conversation.messages.length > 0 && conversation.messages[conversation.messages.length - 1].role === 'assistant') {
        conversation.messages.pop();
        await conversation.save();
      }
      
      const aiResponse = await generateChatCompletion(conversation.getFormattedMessages(), {
        model: user.settings.aiModel,
        temperature: user.settings.temperature + 0.2,
        maxTokens: user.settings.maxTokens,
      });
      
      await conversation.addMessage('assistant', aiResponse);
      
      const actionRow = createActionButtons();
      
      await interaction.editReply({
        content: aiResponse,
        components: [actionRow],
        embeds: []
      });
    } catch (error) {
      console.error('Error in regenerate button:', error);
      
      const errorEmbed = createErrorEmbed(`Failed to generate new response: ${error.message}`);
      
      await interaction.editReply({
        embeds: [errorEmbed],
        components: [],
      });
    }
  },
};
