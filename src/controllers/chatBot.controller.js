const chatBotModel = require("../model/chatBot.model");
const userModel = require("../model/user.model");
const { buildModelWithTools } = require("../services/ai.service");
const { SystemMessage, ToolMessage, HumanMessage, AIMessage } = require("@langchain/core/messages");
const { createInquiryTool, buildIntegrationTools } = require("../services/ai.tools");
const { encrypt } = require("../utils/apiEncrypt.utils");
const { checkAndResetQuota, isQuotaExceeded } = require("../utils/usage.utils");
const { isDomainVerified, isBYOKActive, generateSlug } = require("../utils/bot.utils");
const { chatBotSchema, updateChatBotSchema, askChatBotSchema } = require("../validators/chatBot.validator");

const interactionModel = require("../model/interaction.model");

const staticTools = {
    createInquiry: createInquiryTool
};

async function askChatBotController(req, res) {
    const startTime = Date.now();
    try {
        const validated = askChatBotSchema.parse(req.body);
        const { chatbotId } = req.params;
        const { question, history = [], isPlayground = false } = validated;

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
        if (chatBot.isActive === false) {
            return res.status(403).json({
                success: false,
                message: "This chatbot is currently inactive.",
                data: { chatbotId }
            });
        }

        if (!isBYOKActive(chatBot)) {
            return res.status(403).json({
                success: false,
                message: "BYOK Chatbot inactive. Please complete the activation payment.",
                data: { chatbotId }
            });
        }

        if (!isDomainVerified(req, chatBot)) {
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
                `${chatBot.prompt || 'You are a professional assistant.'}\n\n` +
                `Identity: Your name is "${chatBot.name}".\n` +
                `Context: chatbotId="${chatbotId}", userId="${chatBot.userId._id}".\n` +
                `${integrationContext}\n\n` +
                `CRITICAL OPERATING RULES (STRICT ADHERENCE REQUIRED):\n` +
                `## IDENTITY & MISSION\n` +
                `You are "${chatBot.name}". Your primary purpose is to identify high-intent users and seamlessly transition them into our lead pipeline via expert-led consultations. You are NOT just a chatbot; you are a sophisticated brand ambassador designed to maximize conversion while providing premium value.\n\n` +
                `## CORE OPERATING PROTOCOLS\n` +
                `1. THE PERSUASION ENGINE (HIGH CONVERSION):\n` +
                `   - Adopt a "Consultative Sales" approach. Every response should demonstrate expertise and build trust, ultimately leading to a request for contact details.\n` +
                `   - AUTHORITY: Frame the human team as the "Subject Matter Experts" who can provide the real, deep-level value that an AI cannot. \n` +
                `   - VALUE PITCH: Use phrases like "To ensure we provide a solution that perfectly aligns with your specific goals, I recommend a quick discovery session with our specialists."\n` +
                `   - NO REDUNDANCY: Never list contact requirements (Name, Phone, etc.) in text. Trigger the structural [FORM] tokens instead. Let the UI handle the mechanics while you handle the psychology.\n\n` +
                `2. DYNAMIC LEAD CAPTURE (FORM LOGIC):\n` +
                `   - [FORM:INQUIRY_BASIC]: Use this when the user's intent is ALREADY CLEAR (e.g., "I want to gain weight", "I need a quote"). It only collects Name, Email, and Phone to minimize friction.\n` +
                `   - [FORM:INQUIRY]: Use this when the user is INTERESTED but has NOT yet specified their exact needs. This includes a "Message/Summary" field for them to elaborate.\n` +
                `   - TOKEN PLACEMENT (CRITICAL): Always place the [FORM] token at the very END of your message. Your persuasive text must come first to build interest before the form appears.\n` +
                `   - PIVOT TECHNIQUE: When interest is detected, do not wait. Suggest the handoff immediately as the logical next step for serious users.\n\n` +
                `3. STRICT NEGATIVE CONSTRAINTS (ZERO TOLERANCE):\n` +
                `   - NO HALLUCINATION: If information is not in the provided context, DO NOT INVENT IT. Instead, use the knowledge gap as a conversion trigger: "That's a specialized detail our team manages directly. Let's get you connected so they can provide that specific information for you."\n` +
                `   - NO FAKE DATA: FORBIDDEN from assuming any user name (like "John"). Do not use placeholders. Address the user professionally (e.g., "Welcome," "Hi there,") until their name is confirmed via a form submission.\n` +
                `   - NO PREMATURE RECORDING: You have NO ability to save data yourself. Never say "I've recorded your interest" or "Noted" until you receive the official [SYSTEM: FORM_SUBMITTED] message.\n\n` +
                `4. OBJECTION HANDLING:\n` +
                `   - If a user is hesitant to share details, emphasize the value: "We respect your privacy. This information is solely used to ensure the right specialist contacts you with the most relevant information for your project."\n\n` +
                `5. MASTER FORM ACKNOWLEDGEMENT (CRITICAL):\n` +
                `   - Once you receive "[SYSTEM: FORM_SUBMITTED]", it is a 100% guarantee of success. \n` +
                `   - YOUR MISSION IS CHANGED: You now HAVE their contact details. DO NOT ask for them again. DO NOT use any [FORM] tokens ever again in this session.\n` +
                `   - RESPONSE: Address them by the name provided in the system message. Be enthusiastic. "Fantastic, [Name]! Your request is now at the top of our specialist's queue. They've been notified and will reach out to you shortly to help you with [User's Goal]."\n` +
                `   - CONTINUATION: Transition back to helping them with their original query or next steps. "In the meantime, let's keep progress moving—were you also curious about...?"\n` +
                `   - FORBIDDEN: NEVER include any technical tokens like "[SYSTEM: ...]" or "[FORM: ...]" in your final output.`
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

        const responseTime = Date.now() - startTime;

        // 1. ADVANCED ANALYTICS: Interaction Logging (Only for Widget/non-playground)
        if (!isPlayground) {
            const { analyzeSentimentAndTopic } = require("../services/ai.service");
            const analysis = await analyzeSentimentAndTopic(chatBot, question, response.content);

            await interactionModel.create({
                chatbotId,
                userId: chatBot.userId._id,
                question,
                response: response.content,
                sentiment: analysis.sentiment || 'neutral',
                topic: analysis.topic || 'General inquiry',
                responseTime,
                isResolved: analysis.isResolved ?? true
            });
        }

        // 2. USAGE BILLING & DAILY ANALYTICS: Only for Managed Bots (not BYOK)
        // This now runs for BOTH Playground and Widget if not BYOK
        if (!chatBot.isBYOK) {
            // Update User Global Count (for plan limits)
            if (chatBot.userId.messageCount >= chatBot.userId.messageLimit) {
                chatBot.userId.extraMessages = Math.max(0, chatBot.userId.extraMessages - 1);
            } else {
                chatBot.userId.messageCount += 1;
            }
            await chatBot.userId.save();

            // Update Chatbot Specific Analytics (Daily Chart)
            const today = new Date().toISOString().split('T')[0];
            chatBot.totalMessages = (chatBot.totalMessages || 0) + 1;
            if (!chatBot.analytics) chatBot.analytics = [];
            const dayEntry = chatBot.analytics.find(a => a.date === today);
            if (dayEntry) {
                dayEntry.messages += 1;
            } else {
                chatBot.analytics.push({ date: today, messages: 1 });
            }
            if (chatBot.analytics.length > 30) chatBot.analytics.shift();
            await chatBot.save();
        }

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

        // Handle Google 503 Service Unavailable (temporary overload)
        if (error.status === 503 || error.message?.includes('503') || error.message?.includes('high demand')) {
            return res.status(503).json({
                success: false,
                message: "Google's AI is currently experiencing high demand. Please try again in a few moments.",
                error: "Service Temporarily Unavailable"
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
        
        // Force server defaults for managed agents
        if (!validated.isBYOK) {
            validated.provider = 'Mistral-Ai';
            validated.model = 'open-mistral-nemo';
        }

        // Determine slug: use provided slug or auto-generate from name
        let slug = validated.slug || generateSlug(validated.name);

        // Guarantee uniqueness by appending random suffix if collision
        const existing = await chatBotModel.findOne({ slug });
        if (existing) slug = `${slug}-${Math.random().toString(36).slice(2, 6)}`;

        const chatbot = await chatBotModel.create({
            ...validated,
            EncryptedKey,
            userId: req.user.userId,
            slug
        });
        res.status(201).json({ success: true, data: chatbot });
    } catch (error) {
        if (error.name === 'ZodError') return res.status(400).json({ success: false, message: error.errors[0].message });
        if (error.code === 11000) return res.status(409).json({ success: false, message: "That slug is already taken. Please choose a different one." });
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
        
        const existingBot = await chatBotModel.findOne({ _id: req.params.chatbotId, userId: req.user.userId });
        if (!existingBot) return res.status(404).json({ success: false, message: "Not found" });

        // Force server defaults for managed agents
        if (!existingBot.isBYOK) {
            validated.provider = 'Mistral-Ai';
            validated.model = 'open-mistral-nemo';
            delete validated.api;
            delete validated.EncryptedKey;
        } else {
            if (validated.api && validated.api !== '********************************') {
                validated.EncryptedKey = encrypt(validated.api);
                delete validated.api;
            } else delete validated.api;
        }

        // If slug is being changed, verify it's not taken by another bot
        if (validated.slug && validated.slug !== existingBot.slug) {
            const slugConflict = await chatBotModel.findOne({ slug: validated.slug, _id: { $ne: req.params.chatbotId } });
            if (slugConflict) return res.status(409).json({ success: false, message: "That slug is already taken. Please choose a different one." });
        }

        const chatbot = await chatBotModel.findOneAndUpdate(
            { _id: req.params.chatbotId, userId: req.user.userId },
            validated,
            { new: true }
        );
        res.status(200).json({ success: true, data: chatbot });
    } catch (error) {
        if (error.name === 'ZodError') return res.status(400).json({ success: false, message: error.errors[0].message });
        if (error.code === 11000) return res.status(409).json({ success: false, message: "That slug is already taken. Please choose a different one." });
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
        const chatbot = await chatBotModel.findById(req.params.chatbotId).select("name userId style welcomeMessage prompt model integrations position faq greeting verifiedDomains restrictedDomains isActive");
        if (!chatbot) return res.status(404).json({ success: false, message: "Not found" });

        // Explicitly block the widget from even loading its config on restricted domains
        if (!isDomainVerified(req, chatbot)) {
            return res.status(403).json({ success: false, message: "Widget disabled for this domain." });
        }

        res.status(200).json({ success: true, data: chatbot });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
}

async function toggleChatBotStatusController(req, res) {
    try {
        const chatbot = await chatBotModel.findOne({ _id: req.params.chatbotId, userId: req.user.userId });
        if (!chatbot) return res.status(404).json({ success: false, message: "Not found" });

        chatbot.isActive = !chatbot.isActive;
        await chatbot.save();

        res.status(200).json({ success: true, data: { isActive: chatbot.isActive } });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
}

async function getPublicChatBotController(req, res) {
    try {
        const { slug } = req.params;
        const chatbot = await chatBotModel.findOne({ slug }).select("name style greeting description integrations position faq greeting isActive isPublic");
        if (!chatbot) return res.status(404).json({ success: false, message: "Chatbot not found" });
        if (!chatbot.isPublic) return res.status(403).json({ success: false, message: "This chatbot is not publicly accessible" });
        if (!chatbot.isActive) return res.status(403).json({ success: false, message: "This chatbot is currently inactive" });
        
        res.status(200).json({ success: true, data: chatbot });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
}

async function findSlugController(req, res) {
    try {
        const { slug } = req.params;
        const { excludeId } = req.query;

        // Validate slug format
        if (!/^[a-z0-9-]+$/.test(slug)) {
            return res.status(400).json({ success: false, message: "Invalid slug format" });
        }

        const query = { slug };
        if (excludeId) {
            query._id = { $ne: excludeId };
        }

        const existing = await chatBotModel.findOne(query);
        res.status(200).json({ success: true, data: { available: !existing } });
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
    getWidgetConfigController,
    toggleChatBotStatusController,
    getPublicChatBotController,
    findSlugController
};