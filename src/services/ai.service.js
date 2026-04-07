const { createInquiryTool } = require("./ai.tools");
const { ChatMistralAI } = require("@langchain/mistralai");

const model = new ChatMistralAI({
    apiKey: process.env.MISTRAL_API_KEY,
    model: "open-mistral-nemo",
    maxOutputTokens: 2048,
});

// Base model with always-available static tools
const modelWithTools = model.bindTools([createInquiryTool]);

/**
 * Creates a per-request model with both static tools and dynamic integration tools.
 * 
 * @param {Array} integrationTools - Array of LangChain tool instances built from chatbot integrations
 * @returns LangChain model bound with all tools
 */
function buildModelWithTools(integrationTools = []) {
    if (integrationTools.length === 0) return modelWithTools;
    return model.bindTools([createInquiryTool, ...integrationTools]);
}

module.exports = { model, modelWithTools, buildModelWithTools };
