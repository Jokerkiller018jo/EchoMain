const mongoose = require('mongoose');

const channelSchema = new mongoose.Schema({
  guildId: {
    type: String,
    required: true,
    index: true,
  },
  channelId: {
    type: String,
    required: true,
    index: true,
  },
  createdBy: {
    type: String,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  settings: {
    aiModel: {
      type: String,
      default: 'llama3-70b-8192',
    },
    systemPrompt: {
      type: String,
      default: 'You are a helpful AI assistant. Keep responses concise and informative.',
    }
  }
});

// Create a compound index for uniqueness
channelSchema.index({ guildId: 1, channelId: 1 }, { unique: true });

// Find existing AI channel or create a new one
channelSchema.statics.findOrCreateChannel = async function(guildId, channelId, userId) {
  try {
    let channel = await this.findOne({ guildId, channelId });
    
    if (!channel) {
      channel = new this({
        guildId,
        channelId,
        createdBy: userId,
      });
      await channel.save();
    }
    
    return channel;
  } catch (error) {
    console.error('Error in findOrCreateChannel:', error);
    throw error;
  }
};

// Remove a channel
channelSchema.statics.removeChannel = async function(guildId, channelId) {
  try {
    const result = await this.deleteOne({ guildId, channelId });
    return result.deletedCount > 0;
  } catch (error) {
    console.error('Error in removeChannel:', error);
    throw error;
  }
};

// Get all AI channels for a guild
channelSchema.statics.getGuildChannels = async function(guildId) {
  try {
    return await this.find({ guildId });
  } catch (error) {
    console.error('Error in getGuildChannels:', error);
    throw error;
  }
};

// Check if a channel is an AI channel
channelSchema.statics.isAIChannel = async function(guildId, channelId) {
  try {
    const channel = await this.findOne({ guildId, channelId });
    return !!channel;
  } catch (error) {
    console.error('Error in isAIChannel:', error);
    return false;
  }
};

// Update channel settings
channelSchema.methods.updateSettings = async function(newSettings) {
  if (newSettings.aiModel) this.settings.aiModel = newSettings.aiModel;
  if (newSettings.systemPrompt) this.settings.systemPrompt = newSettings.systemPrompt;
  
  await this.save();
  return this;
};

const Channel = mongoose.model('AIChannel', channelSchema);

module.exports = Channel;
