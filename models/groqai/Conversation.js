const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true,
  },
  channelId: {
    type: String,
    required: true,
    index: true,
  },
  messages: [{
    role: {
      type: String,
      enum: ['system', 'user', 'assistant'],
      required: true,
    },
    content: {
      type: String,
      required: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
  }],
  lastMessageId: {
    type: String,
    default: null,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
});

// Update updatedAt timestamp before saving
conversationSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Add message to conversation
conversationSchema.methods.addMessage = async function(role, content) {
  this.messages.push({
    role,
    content,
    timestamp: new Date(),
  });
  
  await this.save();
  return this;
};

// Update last message ID
conversationSchema.methods.updateLastMessageId = async function(messageId) {
  this.lastMessageId = messageId;
  await this.save();
  return this;
};

// Format messages for API consumption (removing MongoDB's _id fields)
conversationSchema.methods.getFormattedMessages = function() {
  return this.messages.map(msg => ({
    role: msg.role,
    content: msg.content
  }));
};

// Clear conversation history
conversationSchema.methods.clearHistory = async function() {
  // Keep system messages
  this.messages = this.messages.filter(msg => msg.role === 'system');
  await this.save();
  return this;
};

// Get active conversation or create new one
conversationSchema.statics.getOrCreateConversation = async function(userId, channelId) {
  let conversation = await this.findOne({
    userId,
    channelId,
    isActive: true,
  });
  
  if (!conversation) {
    conversation = new this({
      userId,
      channelId,
      messages: [{
        role: 'system',
        content: 'You are a helpful AI assistant integrated with Discord. You provide concise and accurate responses.',
      }],
    });
    await conversation.save();
  }
  
  return conversation;
};

const Conversation = mongoose.model('Conversation', conversationSchema);

module.exports = Conversation;
