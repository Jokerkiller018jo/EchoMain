const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('aihelp')
    .setDescription('Display information about AI assistant commands and features'),

  async execute(interaction) {
    const helpEmbed = new EmbedBuilder()
      .setColor('#5865F2')
      .setTitle('Echo AI Assistant')
      .setDescription('Here are the available AI commands and features:')
      .addFields(
        { 
          name: '💬 AI Chat Commands', 
          value: '`/chat [message]` - Chat with the AI assistant\n`/aiclear` - Clear your conversation history'
        },
        { 
          name: '🔧 User Settings', 
          value: '`/aisettings` - Configure your AI preferences' 
        },
        { 
          name: '📋 Channel Management', 
          value: '`/setup-channel` - Set up a channel for AI auto-responses\n`/remove-channel` - Remove AI from a channel\n`/list-channels` - List all AI channels in this server' 
        },
        { 
          name: '❓ Help & Info', 
          value: '`/aihelp` - Display this help information' 
        },
        { 
          name: '🔘 Response Buttons', 
          value: '🔄 **Regenerate**: Create a new response' 
        },
        {
          name: '📝 Using AI Channels',
          value: 'Once a channel is set up with `/setup-channel`, the AI will automatically respond to messages in that channel.'
        },
        {
          name: 'ℹ️ About',
          value: 'This bot uses the Groq AI API (Llama-3 model) for fast and free AI responses.'
        }
      )
      .setFooter({ 
        text: 'Echo AI Assistant',
        iconURL: interaction.client.user.displayAvatarURL()
      })
      .setTimestamp();

    await interaction.reply({
      embeds: [helpEmbed],
      ephemeral: false,
    });
  },
};
