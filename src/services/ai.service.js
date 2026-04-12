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
    let provider = (chatBot.provider || 'mistral-ai').toLowerCase();
    let modelName = chatBot.model;
    
    // Safety guard: retroactively fix any non-BYOK agents saved with wrong providers
    if (!chatBot.isBYOK) {
        provider = 'mistral-ai';
        modelName = 'open-mistral-nemo';
    }
    
    // 1. Resolve API Key (Database for BYOK, Env for standard)
    let apiKey = '';
    
    // Safety check for encrypted key format
    if (chatBot.EncryptedKey && chatBot.EncryptedKey.includes(':')) {
        try {
            apiKey = decrypt(chatBot.EncryptedKey).trim();
        } catch (err) {
            console.error("[Decrypt Error]:", err.message);
        }
    }
    
    if (!apiKey && !chatBot.isBYOK) {
        // Fallback to system env keys based on provider
        apiKey = provider.includes('google') ? process.env.GOOGLE_GENERATIVE_AI_API_KEY :
                 provider.includes('openai') ? process.env.OPENAI_API_KEY :
                 provider.includes('anthropic') ? process.env.ANTHROPIC_API_KEY :
                 process.env.MISTRAL_API_KEY;
    }


    if (!apiKey) {
        throw new Error(`No API Key configured for provider: ${provider}`);
    }

    // 2. Initialize Model
    const config = {
        apiKey,
        maxOutputTokens: 2048,
        temperature: 0.7,
        maxRetries: 1 // Don't hang on rate limits
    };

    let model;
    if (provider.includes('google')) {
        model = new ChatGoogleGenerativeAI({
            ...config,
            model: modelName || "gemini-2.0-flash",
            apiVersion: "v1beta"
        });
    } else if (provider.includes('openai')) {
        model = new ChatOpenAI({
            ...config,
            modelName: modelName || "gpt-4o-mini"
        });
    } else if (provider.includes('anthropic')) {
        model = new ChatAnthropic({
            ...config,
            modelName: modelName || "claude-3-haiku-20240307"
        });
    } else {
        // Default to Mistral for everything else (mistral-ai, etc.)
        model = new ChatMistralAI({
            ...config,
            model: modelName || "open-mistral-nemo"
        });
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
