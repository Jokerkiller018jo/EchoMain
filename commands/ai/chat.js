const { SlashCommandBuilder } = require('discord.js');
const { createErrorEmbed, createActionButtons } = require('../../utils/groqEmbedUtils');
const { generateChatCompletion } = require('../../services/groqService');
const GroqUser = require('../../models/groqai/GroqUser');
const Conversation = require('../../models/groqai/Conversation');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('chat')
    .setDescription('Chat with the AI assistant')
    .addStringOption(option =>
      option.setName('message')
        .setDescription('Your message to the AI')
        .setRequired(true)),

  async execute(interaction) {
    await interaction.deferReply();

    try {
      const userMessage = interaction.options.getString('message');
      const userId = interaction.user.id;
      const channelId = interaction.channelId;
      const username = interaction.user.username;

      // Get or create user in database
      const user = await GroqUser.findOrCreateUser(userId, username);
      
      // Get or create conversation
      const conversation = await Conversation.getOrCreateConversation(userId, channelId);
      
      // Add the user's message to the conversation
      await conversation.addMessage('user', userMessage);
      
      // Generate AI response
      const aiResponse = await generateChatCompletion(conversation.getFormattedMessages(), {
        model: user.settings.aiModel,
        temperature: user.settings.temperature,
        maxTokens: user.settings.maxTokens,
      });
      
      // Add the AI's response to the conversation
      await conversation.addMessage('assistant', aiResponse);
      
      // Create action buttons
      const actionRow = createActionButtons();
      
      // Send the response
      await interaction.editReply({
        content: aiResponse,
        components: [actionRow],
      });
    } catch (error) {
      console.error('Error in chat command:', error);
      
      const errorEmbed = createErrorEmbed(`Failed to process your request: ${error.message}`);
      
      await interaction.editReply({
        embeds: [errorEmbed],
      });
    }
  },
};
