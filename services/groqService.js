const { Groq } = require('groq-sdk');
require('dotenv').config();

// Initialize Groq client
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

const DEFAULTS = {
  model: 'llama3-70b-8192',
  temperature: 0.7,
  maxTokens: 500,
};

/**
 * Generate a chat completion using Groq's API
 * @param {Array} messages - Array of message objects with role and content
 * @param {Object} options - Optional parameters for the API call
 * @returns {Promise<string>} - The AI response text
 */
async function generateChatCompletion(messages, options = {}) {
  try {
    const response = await groq.chat.completions.create({
      model: options.model || DEFAULTS.model,
      messages: messages,
      temperature: options.temperature || DEFAULTS.temperature,
      max_tokens: options.maxTokens || DEFAULTS.maxTokens,
    });

    return response.choices[0].message.content;
  } catch (error) {
    console.error('Error generating chat completion:', error);
    throw new Error(`Failed to generate AI response: ${error.message}`);
  }
}

module.exports = {
  generateChatCompletion,
};
