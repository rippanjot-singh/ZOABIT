const chatBotModel = require("../model/chatBot.model");
const userModel = require("../model/user.model");
const { buildModelWithTools } = require("../services/ai.service");
const { SystemMessage, ToolMessage, HumanMessage, AIMessage } = require("@langchain/core/messages");
const { createInquiryTool, buildIntegrationTools } = require("../services/ai.tools");
const { encrypt } = require("../utils/apiEncrypt.utils");
const { checkAndResetQuota, isQuotaExceeded } = require("../utils/usage.utils");
const { isDomainVerified, isBYOKActive } = require("../utils/bot.utils");
const { chatBotSchema, updateChatBotSchema, askChatBotSchema } = require("../validators/chatBot.validator");

const staticTools = {
    createInquiry: createInquiryTool
};

async function askChatBotController(req, res) {
    try {
        const validated = askChatBotSchema.parse(req.body);
        const { chatbotId } = req.params;
        const { question, history = [] } = validated;

        const chatBot = await chatBotModel.findById(chatbotId).populate("userId");
        if (!chatBot) return res.status(404).json({ success: false, message: 'Chatbot not found' });

        if (!chatBot.userId) {
            return res.status(500).json({ success: false, message: "System Error: Chatbot owner record missing." });
        }

        // Quota Management
        await checkAndResetQuota(chatBot.userId);
        if (isQuotaExceeded(chatBot.userId)) {
            return res.status(403).json({
                success: false,
                message: "This account has reached its message limit.",
                messageCount: chatBot.userId.messageCount
            });
        }

        // Feature Guards
        if (!isBYOKActive(chatBot)) {
            return res.status(403).json({
                success: false,
                message: "BYOK Chatbot inactive. Please complete the activation payment.",
                data: { chatbotId }
            });
        }

        if (!isDomainVerified(req.headers.origin, chatBot)) {
            return res.status(403).json({
                success: false,
                message: "This domain is not authorized to use this widget.",
                data: { chatbotId, origin: req.headers.origin }
            });
        }

        const integrationTools = await buildIntegrationTools(chatBot.integrations || [], chatBot.userId._id);
        const allToolsMap = { ...staticTools };
        for (const t of integrationTools) allToolsMap[t.name] = t;

        const chatModel = buildModelWithTools(chatBot, integrationTools);
        
        const integrationContext = (chatBot.integrations || []).length > 0
            ? `\n\nYou have access to the following live data tools:\n` +
              chatBot.integrations.map(i => `- "${i.name}": (${i.provider}) ${i.description}`).join('\n')
            : '';

        const messages = [
            new SystemMessage(
                `${chatBot.prompt || 'You are a helpful AI assistant.'}\n` +
                `Identity: Your name is "${chatBot.name}".\n` +
                `Context: chatbotId="${chatbotId}", userId="${chatBot.userId._id}".\n` +
                integrationContext
            ),
            ...history.map(msg => msg.role === "user" ? new HumanMessage(msg.content) : new AIMessage(msg.content)),
            new HumanMessage(question)
        ];

        let response = await chatModel.invoke(messages);

        if (response.tool_calls?.length > 0) {
            const toolResults = await Promise.all(response.tool_calls.map(async (toolCall) => {
                const toolToExecute = allToolsMap[toolCall.name];
                const result = toolToExecute 
                    ? await toolToExecute.invoke(toolCall.args)
                    : `Error: Tool "${toolCall.name}" not found.`;
                return new ToolMessage({ tool_call_id: toolCall.id, content: typeof result === "string" ? result : JSON.stringify(result) });
            }));
            response = await chatModel.invoke([...messages, response, ...toolResults]);
        }

        // Update Analytics
        if(!chatBot.isBYOK){
            chatBot.userId.messageCount += 1;
            await chatBot.userId.save();
        }

        const today = new Date().toISOString().split('T')[0];
        chatBot.totalMessages = (chatBot.totalMessages || 0) + 1;
        if (!chatBot.analytics) chatBot.analytics = [];
        const dayEntry = chatBot.analytics.find(a => a.date === today);
        if (dayEntry) dayEntry.messages += 1;
        else chatBot.analytics.push({ date: today, messages: 1 });
        if (chatBot.analytics.length > 30) chatBot.analytics.shift();
        await chatBot.save();

        res.status(200).json({ success: true, data: response.content, messageCount: chatBot.userId.messageCount });
    } catch (error) {
        console.error("[Chat Controller Error]:", error);
        
        // Handle Zod validation errors (400)
        if (error.name === 'ZodError') {
            return res.status(400).json({ success: false, message: error.errors[0].message });
        }

        // Handle specific AI Quota/Rate Limit errors (429)
        if (error.status === 429 || error.message?.includes('429') || error.message?.includes('quota')) {
            return res.status(429).json({ 
                success: false, 
                message: "AI quota exceeded for this model. Try switching providers (e.g., to Mistral) or wait a minute.",
                error: "Rate limit reached" 
            });
        }

        res.status(500).json({ 
            success: false, 
            message: "Failed to generate response.", 
            error: error.message || "Unknown error" 
        });
    }
}

async function createChatBotController(req, res) {
    try {
        const validated = chatBotSchema.parse(req.body);
        const user = await userModel.findById(req.user.userId);
        const chatbots = await chatBotModel.find({ userId: req.user.userId });
        const managedChatbots = chatbots.filter(c => !c.isBYOK);

        if (managedChatbots.length >= user.chatbotLimit) {
            return res.status(403).json({ success: false, message: "Chatbot limit reached." });
        }

        const EncryptedKey = validated.api ? encrypt(validated.api) : '';
        const chatbot = await chatBotModel.create({
            ...validated,
            EncryptedKey,
            userId: req.user.userId
        });
        res.status(201).json({ success: true, data: chatbot });
    } catch (error) {
        if (error.name === 'ZodError') return res.status(400).json({ success: false, message: error.errors[0].message });
        res.status(500).json({ success: false, message: error.message });
    }
}

async function getChatBotsController(req, res) {
    try {
        const chatbots = await chatBotModel.find({ userId: req.user.userId });
        res.status(200).json({ success: true, data: chatbots });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
}

async function getChatBotController(req, res) {
    try {
        const chatbot = await chatBotModel.findOne({ _id: req.params.chatbotId, userId: req.user.userId });
        if (!chatbot) return res.status(404).json({ success: false, message: "Not found" });
        res.status(200).json({ success: true, data: chatbot });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
}

async function updateChatBotController(req, res) {
    try {
        const validated = updateChatBotSchema.parse(req.body);
        if (validated.api && validated.api !== '********************************') {
            validated.EncryptedKey = encrypt(validated.api);
            delete validated.api;
        } else delete validated.api;

        const chatbot = await chatBotModel.findOneAndUpdate(
            { _id: req.params.chatbotId, userId: req.user.userId },
            validated,
            { new: true }
        );
        res.status(200).json({ success: true, data: chatbot });
    } catch (error) {
        if (error.name === 'ZodError') return res.status(400).json({ success: false, message: error.errors[0].message });
        res.status(500).json({ success: false, message: error.message });
    }
}

async function deleteChatBotController(req, res) {
    try {
        await chatBotModel.findOneAndDelete({ _id: req.params.chatbotId, userId: req.user.userId });
        res.status(200).json({ success: true, message: "Deleted successfully" });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
}

async function getWidgetConfigController(req, res) {
    try {
        const chatbot = await chatBotModel.findById(req.params.chatbotId).select("name style welcomeMessage prompt model integrations position faq greeting");
        if (!chatbot) return res.status(404).json({ success: false, message: "Not found" });
        res.status(200).json({ success: true, data: chatbot });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
}

module.exports = {
    askChatBotController,
    createChatBotController,
    getChatBotsController,
    getChatBotController,
    deleteChatBotController,
    updateChatBotController,
    getWidgetConfigController
};