const { Events } = require('discord.js');
const ServerConfig = require('../models/nqn/nqn');

module.exports = {
  name: Events.MessageCreate,
  async execute(message) {
    if (message.author.bot || message.system || message.channel.type === 'DM') return;

    try {

      const serverConfig = await ServerConfig.findOne({ serverId: message.guild.id });
      if (!serverConfig || !serverConfig.status) return; 

      const msg = message.content;
      
    
      const hasCustomEmoji = /<a?:[a-zA-Z0-9_]+:[0-9]+>/.test(msg);
      if (hasCustomEmoji) {
      
        const emojiRegex = /<a?:[a-zA-Z0-9_]+:([0-9]+)>/g;
        let match;
        const validEmojis = [];
        
        while ((match = emojiRegex.exec(msg)) !== null) {
          const emojiId = match[1];
          if (message.guild.emojis.cache.has(emojiId) || message.client.emojis.cache.has(emojiId)) {
            validEmojis.push(match[0]);
          }
        }
        
    
        const cleanedMsg = msg.replace(/<a?:[a-zA-Z0-9_]+:[0-9]+>/g, '').trim();
        const hasTextAfterEmojiRemoval = cleanedMsg.length > 0;
        
       
        if (validEmojis.length > 0 && !hasTextAfterEmojiRemoval) {
          return;
        }
      }

      const isMention = /^<@!?[0-9]+>$/.test(msg);
      if (isMention) return; 
      
  
      const emojiNameRegex = /(?<!<a?):([a-zA-Z0-9_]+):(?![0-9]+>)/g;
      
      let matchCount = 0;
      let newMsg = msg.replace(emojiNameRegex, (match, emojiName) => {
        matchCount++;
      
        let emoji = message.guild.emojis.cache.find(e => e.name.toLowerCase() === emojiName.toLowerCase());
        

        if (!emoji) {
          emoji = message.client.emojis.cache.find(e => e.name.toLowerCase() === emojiName.toLowerCase());
        }

        if (emoji) {
          return emoji.toString();
        }
        return match; 
      });

  
      if (msg === newMsg || matchCount === 0) return;

   
      try {
        await message.delete();
      } catch (err) {
        console.error(`Missing permissions to delete message in guild ${message.guild.id}`);
        return; 
      }
      
  
      const displayName = message.member?.nickname || message.author.displayName || message.author.username;
      
   
      const webhooks = await message.channel.fetchWebhooks();
      let webhook = webhooks.find(wh => wh.token);

      if (!webhook) {
        try {
          webhook = await message.channel.createWebhook({
            name: 'Echo NQN',
            avatar: message.client.user.displayAvatarURL(),
          });
        } catch (err) {
          console.error(`Missing permissions to create webhook in guild ${message.guild.id}`);
          
          return;
        }
      }

      await webhook.send({
        content: newMsg,
        username: displayName,
        avatarURL: message.author.displayAvatarURL({ dynamic: true }),
      });

    } catch (error) {
      console.error('NQN Error:', error);
    }
  },
};
