const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const Conversation = require('../../models/groqai/Conversation');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('aiclear')
    .setDescription('Clear your conversation history with the AI assistant'),

  async execute(interaction) {
    try {
      const userId = interaction.user.id;
      const channelId = interaction.channelId;
      
      const conversation = await Conversation.getOrCreateConversation(userId, channelId);
      await conversation.clearHistory();
      
      const successEmbed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle('Conversation Cleared')
        .setDescription('Your conversation history has been cleared. The AI will no longer remember your previous messages in this channel.')
        .setFooter({ 
          text: 'Echo AI Assistant',
          iconURL: interaction.client.user.displayAvatarURL()
        })
        .setTimestamp();
      
      await interaction.reply({
        embeds: [successEmbed],
        ephemeral: true,
      });
    } catch (error) {
      console.error('Error in aiclear command:', error);
      await interaction.reply({
        content: 'There was an error while clearing your conversation history!',
        ephemeral: true,
      });
    }
  },
};
