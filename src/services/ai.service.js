const { ChatMistralAI } = require("@langchain/mistralai");
const { ChatGoogleGenerativeAI } = require("@langchain/google-genai");
const { ChatOpenAI } = require("@langchain/openai");
const { ChatAnthropic } = require("@langchain/anthropic");
const { decrypt } = require("../utils/apiEncrypt.utils");
const { createInquiryTool } = require("./ai.tools");

/**
 * Universal AI Model Factory
 */
function getChatModel(chatBot) {
    const provider = (chatBot.provider || 'mistral-ai').toLowerCase();
    const modelName = chatBot.model;
    
    // 1. Resolve API Key strictly from Database
    if (!chatBot.EncryptedKey) {
        throw new Error(`No API Key found in database for chatbot: ${chatBot.name}`);
    }

    const apiKey = decrypt(chatBot.EncryptedKey).trim();

    // 2. Initialize Model
    const config = {
        apiKey,
        maxOutputTokens: 2048,
        temperature: 0.7
    };

    let model;
    switch (provider) {
        case 'google':
            model = new ChatGoogleGenerativeAI({
                ...config,
                model: modelName || "gemini-2.0-flash",
                apiVersion: "v1beta"
            });
            break;

        case 'openai':
            model = new ChatOpenAI({
                ...config,
                modelName: modelName || "gpt-4o-mini"
            });
            break;

        case 'anthropic':
            model = new ChatAnthropic({
                ...config,
                modelName: modelName || "claude-3-haiku-20240307"
            });
            break;

        default:
            model = new ChatMistralAI({
                ...config,
                model: modelName || "open-mistral-nemo"
            });
            break;
    }

    return {
        model,
        modelWithTools: model.bindTools([createInquiryTool])
    };
}

function buildModelWithTools(chatBot, integrationTools = []) {
    const { model, modelWithTools } = getChatModel(chatBot);
    if (integrationTools.length === 0) return modelWithTools;
    return model.bindTools([createInquiryTool, ...integrationTools]);
}

module.exports = { getChatModel, buildModelWithTools };
