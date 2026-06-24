const { SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const GroqUser = require('../../models/groqai/GroqUser');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('aisettings')
    .setDescription('Configure your AI assistant settings'),

  async execute(interaction) {
    try {
      const userId = interaction.user.id;
      const username = interaction.user.username;
      
      const user = await GroqUser.findOrCreateUser(userId, username);
      
      const settingsEmbed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle('AI Assistant Settings')
        .setDescription('Configure your AI assistant preferences:')
        .addFields(
          { name: 'Current AI Model', value: user.settings.aiModel },
          { name: 'Temperature', value: user.settings.temperature.toString(), inline: true },
          { name: 'Max Tokens', value: user.settings.maxTokens.toString(), inline: true },
          { name: 'Save History', value: user.settings.saveHistory ? 'Enabled' : 'Disabled', inline: true },
        )
        .setFooter({ 
          text: 'Use the menu below to change settings',
          iconURL: interaction.client.user.displayAvatarURL()
        });
      
      const modelRow = new ActionRowBuilder()
        .addComponents(
          new StringSelectMenuBuilder()
            .setCustomId('groq_select_model')
            .setPlaceholder('Select AI model')
            .addOptions([
              {
                label: 'Llama-3 70B',
                description: 'Most capable model (recommended)',
                value: 'llama3-70b-8192',
                default: user.settings.aiModel === 'llama3-70b-8192',
              },
              {
                label: 'Llama-3 8B',
                description: 'Faster responses',
                value: 'llama3-8b-8192',
                default: user.settings.aiModel === 'llama3-8b-8192',
              },
              {
                label: 'Mixtral 8x7B',
                description: 'Alternative model',
                value: 'mixtral-8x7b-32768',
                default: user.settings.aiModel === 'mixtral-8x7b-32768',
              },
            ]),
        );
      
      const temperatureRow = new ActionRowBuilder()
        .addComponents(
          new StringSelectMenuBuilder()
            .setCustomId('groq_select_temperature')
            .setPlaceholder('Select temperature')
            .addOptions([
              {
                label: 'Low (0.3)',
                description: 'More deterministic responses',
                value: '0.3',
                default: user.settings.temperature === 0.3,
              },
              {
                label: 'Medium (0.7)',
                description: 'Balanced responses',
                value: '0.7',
                default: user.settings.temperature === 0.7,
              },
              {
                label: 'High (1.0)',
                description: 'More creative responses',
                value: '1.0',
                default: user.settings.temperature === 1.0,
              },
            ]),
        );
      
      const buttonRow = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('groq_toggle_history')
            .setLabel(user.settings.saveHistory ? 'Disable History' : 'Enable History')
            .setStyle(user.settings.saveHistory ? ButtonStyle.Danger : ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId('groq_reset_settings')
            .setLabel('Reset to Default')
            .setStyle(ButtonStyle.Secondary),
        );
      
      await interaction.reply({
        embeds: [settingsEmbed],
        components: [modelRow, temperatureRow, buttonRow],
        ephemeral: true,
      });
    } catch (error) {
      console.error('Error in aisettings command:', error);
      await interaction.reply({
        content: 'There was an error while executing this command!',
        ephemeral: true,
      });
    }
  },
};
