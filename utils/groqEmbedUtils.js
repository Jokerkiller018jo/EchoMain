const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

/**
 * Create a styled embed for AI responses
 */
function createResponseEmbed(content, options = {}) {
  const embed = new EmbedBuilder()
    .setColor(options.color || '#5865F2')
    .setDescription(content)
    .setFooter({
      text: options.footer || 'Echo AI Assistant',
      iconURL: options.footerIcon,
    });
  
  if (options.title) embed.setTitle(options.title);
  if (options.thumbnail) embed.setThumbnail(options.thumbnail);
  if (options.image) embed.setImage(options.image);
  if (options.author) {
    embed.setAuthor({
      name: options.author.name,
      iconURL: options.author.icon,
      url: options.author.url,
    });
  }
  if (options.timestamp) embed.setTimestamp();
  
  return embed;
}

/**
 * Create a styled embed for errors
 */
function createErrorEmbed(errorMessage) {
  return new EmbedBuilder()
    .setColor('#ED4245')
    .setTitle('Error')
    .setDescription(errorMessage)
    .setFooter({ text: 'Echo AI Assistant' })
    .setTimestamp();
}

/**
 * Create a loading embed
 */
function createLoadingEmbed() {
  return new EmbedBuilder()
    .setColor('#5865F2')
    .setDescription('⏳ Processing your request...')
    .setFooter({ text: 'Echo AI Assistant' });
}

/**
 * Create navigation buttons for long responses
 */
function createNavigationButtons() {
  const row = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('prev_page')
        .setLabel('Previous')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('⬅️'),
      new ButtonBuilder()
        .setCustomId('next_page')
        .setLabel('Next')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('➡️'),
      new ButtonBuilder()
        .setCustomId('delete_message')
        .setLabel('Delete')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('🗑️'),
    );
  
  return row;
}

/**
 * Create action buttons for AI responses
 */
function createActionButtons() {
  const row = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('regenerate')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('🔄')
    );
  
  return row;
}

module.exports = {
  createResponseEmbed,
  createErrorEmbed,
  createLoadingEmbed,
  createNavigationButtons,
  createActionButtons,
};
