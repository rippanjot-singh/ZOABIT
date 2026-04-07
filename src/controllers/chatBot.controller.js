const chatBotModel = require("../model/chatBot.model");
const { modelWithTools, buildModelWithTools } = require("../services/ai.service");
const { SystemMessage, ToolMessage, HumanMessage, AIMessage } = require("@langchain/core/messages");
const { createInquiryTool, buildIntegrationTools } = require("../services/ai.tools");
const userModel = require("../model/user.model");

// --- STATIC TOOLS (Shared by every chatbot) ---
const staticTools = {
    createInquiry: createInquiryTool
};

/**
 * Main Chat Endpoint: Logic for processing user messages and calling tools.
 */
async function askChatBotController(req, res) {
    try {
        const { chatbotId } = req.params;
        const { question, history = [] } = req.body;

        const chatBot = await chatBotModel.findById(chatbotId).populate("userId", "messageCount messageLimit lastResetDate createdAt");
        if (!chatBot) return res.status(404).json({ success: false, message: 'Chatbot not found' });

        // Auto-Reset Logic (Monthly Anniversary)
        const now = new Date();
        const lastReset = new Date(chatBot.userId.lastResetDate || chatBot.userId.createdAt);
        const thirtyDaysInMs = 30 * 24 * 60 * 60 * 1000;

        if (now - lastReset >= thirtyDaysInMs) {
            chatBot.userId.messageCount = 0;
            chatBot.userId.lastResetDate = now;
            await chatBot.userId.save();
        }

        // Check Account Quota
        if (chatBot.userId.messageCount >= chatBot.userId.messageLimit) {
            return res.status(403).json({
                success: false,
                message: "This account has reached its message limit.",
                data: null,
                messageCount: chatBot.userId.messageCount
            });
        }

        // Domain Verification (Skip for Dashboard/Playground or if no domains set)
        const origin = req.headers.origin;
        const isDashboardRequest = origin?.includes('localhost') || origin?.includes('127.0.0.1'); 
        
        const isVerified = isDashboardRequest || !chatBot.verifiedDomains || chatBot.verifiedDomains.length === 0 ||
            chatBot.verifiedDomains.some(domain => origin?.replace(/^https?:\/\//i, '') === domain);

        if (!isVerified) {
            return res.status(403).json({
                success: false,
                message: "This domain is not authorized to use this widget.",
                data: { chatbotId, origin },
                messageCount: 0
            });
        }

        // --- STEP 1: Build Dynamic Tools Per-Request ---
        const integrationTools = await buildIntegrationTools(chatBot.integrations || [], chatBot.userId._id);
        const allToolsMap = { ...staticTools };
        for (const t of integrationTools) {
            allToolsMap[t.name] = t;
        }

        const chatModel = buildModelWithTools(integrationTools);

        // --- STEP 2: Configure System Prompt ---
        const integrationContext = (chatBot.integrations || []).length > 0
            ? `\n\nYou have access to the following live data tools:\n` +
              chatBot.integrations.map(i => `- "${i.name}": (${i.provider}) ${i.description}`).join('\n') +
              `\nUse these tools whenever the user's question relates to your linked Workspace documents.`
            : '';

        const messages = [
            new SystemMessage(
                `${chatBot.prompt || 'You are a helpful AI assistant.'}\n` +
                `Identity: Your name is "${chatBot.name}".\n` +
                `Context IDs: chatbotId="${chatbotId}", userId="${chatBot.userId._id}".\n` +
                `Instructions: If you lack information, ask for name/phone to save as lead.\n` +
                integrationContext
            ),
            ...history.map(msg => msg.role === "user" ? new HumanMessage(msg.content) : new AIMessage(msg.content)),
            new HumanMessage(question)
        ];

        // --- STEP 3: AI Invocation ---
        let response = await chatModel.invoke(messages);

        // --- STEP 4: Parallel Tool Execution ---
        if (response.tool_calls && response.tool_calls.length > 0) {
            const toolResults = await Promise.all(response.tool_calls.map(async (toolCall) => {
                const toolToExecute = allToolsMap[toolCall.name];
                if (toolToExecute) {
                    const result = await toolToExecute.invoke(toolCall.args);
                    return new ToolMessage({ tool_call_id: toolCall.id, content: typeof result === "string" ? result : JSON.stringify(result) });
                }
                return new ToolMessage({ tool_call_id: toolCall.id, content: `Error: Tool "${toolCall.name}" not found.` });
            }));

            response = await chatModel.invoke([...messages, response, ...toolResults]);
        }

        // 1. Update User Monthly Quota
        chatBot.userId.messageCount += 1;
        await chatBot.userId.save();

        // 2. Update Bot-Specific Analytics
        const today = new Date().toISOString().split('T')[0];
        chatBot.totalMessages = (chatBot.totalMessages || 0) + 1;
        
        // Ensure analytics array exists
        if (!chatBot.analytics) chatBot.analytics = [];
        
        const dayEntry = chatBot.analytics.find(a => a.date === today);
        if (dayEntry) {
            dayEntry.messages += 1;
        } else {
            chatBot.analytics.push({ date: today, messages: 1 });
            // Maintain sliding window of 30 days for performance
            if (chatBot.analytics.length > 30) chatBot.analytics.shift();
        }
        await chatBot.save();

        res.status(200).json({ success: true, data: response.content, messageCount: chatBot.userId.messageCount });
    } catch (error) {
        console.error("[AI Chat Error]:", error);
        res.status(500).json({ success: false, message: "Failed to generate response.", error: error.message });
    }
}

// --- CRUD OPERATORS ---

async function createChatBotController(req, res) {
    try {
        const { name, prompt, model, style, welcomeMessage, verifiedDomains } = req.body;
        const chatbot = await chatBotModel.create({
            name, prompt, model, style, welcomeMessage, verifiedDomains,
            userId: req.user.userId
        });
        res.status(201).json({ success: true, data: chatbot });
    } catch (error) {
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
        const chatbot = await chatBotModel.findOneAndUpdate(
            { _id: req.params.chatbotId, userId: req.user.userId },
            req.body,
            { new: true }
        );
        res.status(200).json({ success: true, data: chatbot });
    } catch (error) {
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