const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const Channel = require('../../models/groqai/Channel');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('list-channels')
    .setDescription('List all AI channels in this server')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  async execute(interaction) {
    try {
      await interaction.deferReply();
      
      const channels = await Channel.getGuildChannels(interaction.guild.id);
      
      if (!channels || channels.length === 0) {
        return await interaction.editReply({
          content: '❌ No AI channels have been set up in this server.',
          ephemeral: true
        });
      }
      
      const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle('AI Channels')
        .setDescription(`This server has ${channels.length} AI ${channels.length === 1 ? 'channel' : 'channels'}:`)
        .setFooter({ 
          text: 'Echo AI Assistant',
          iconURL: interaction.client.user.displayAvatarURL()
        })
        .setTimestamp();
      
      for (const channel of channels) {
        try {
          const discordChannel = interaction.guild.channels.cache.get(channel.channelId);
          const channelName = discordChannel ? discordChannel.name : 'Unknown Channel';
          
          embed.addFields({
            name: `#${channelName}`,
            value: `• **Model**: ${channel.settings.aiModel}\n• **Setup by**: <@${channel.createdBy}>`
          });
        } catch (error) {
          console.error(`Error getting channel info for ${channel.channelId}:`, error);
          embed.addFields({
            name: `Channel ID: ${channel.channelId}`,
            value: `• **Model**: ${channel.settings.aiModel}\n• **Setup by**: <@${channel.createdBy}>`
          });
        }
      }
      
      embed.addFields({
        name: 'How It Works',
        value: 'The AI will automatically respond to all messages in these channels.'
      });
      
      await interaction.editReply({ embeds: [embed] });
      
    } catch (error) {
      console.error('Error in list-channels command:', error);
      await interaction.editReply({
        content: `❌ Failed to list AI channels: ${error.message}`,
        ephemeral: true
      });
    }
  },
};
