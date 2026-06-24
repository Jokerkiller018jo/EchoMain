const mongoose = require('mongoose');

const groqUserSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    unique: true,
  },
  username: {
    type: String,
    required: true,
  },
  settings: {
    aiModel: {
      type: String,
      default: 'llama3-70b-8192',
    },
    temperature: {
      type: Number,
      default: 0.7,
      min: 0,
      max: 2,
    },
    maxTokens: {
      type: Number,
      default: 500,
    },
    saveHistory: {
      type: Boolean,
      default: true,
    },
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  lastActive: {
    type: Date,
    default: Date.now,
  },
});

// Update lastActive timestamp before saving
groqUserSchema.pre('save', function(next) {
  this.lastActive = Date.now();
  next();
});

// Create or update user by Discord ID
groqUserSchema.statics.findOrCreateUser = async function(userId, username) {
  let user = await this.findOne({ userId });
  
  if (!user) {
    user = new this({
      userId,
      username,
    });
    await user.save();
  }
  
  return user;
};

// Update user settings
groqUserSchema.methods.updateSettings = async function(newSettings) {
  if (newSettings.aiModel) this.settings.aiModel = newSettings.aiModel;
  if (newSettings.temperature !== undefined) this.settings.temperature = newSettings.temperature;
  if (newSettings.maxTokens !== undefined) this.settings.maxTokens = newSettings.maxTokens;
  if (newSettings.saveHistory !== undefined) this.settings.saveHistory = newSettings.saveHistory;
  
  await this.save();
  return this;
};

const GroqUser = mongoose.model('GroqUser', groqUserSchema);

module.exports = GroqUser;
