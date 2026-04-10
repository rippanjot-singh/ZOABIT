const { z } = require('zod');

const chatBotSchema = z.object({
    name: z.string().min(1, "Name is required"),
    description: z.string().optional(),
    prompt: z.string().optional(),
    provider: z.string().optional(),
    model: z.string().optional(),
    style: z.object({
        brandColor: z.object({
            primary: z.string().optional(),
            secondary: z.string().optional(),
            accent: z.string().optional()
        }).optional(),
        textColor: z.string().optional(),
        bgColor: z.string().optional(),
        corner: z.enum(['rounded', 'square']).optional(),
        icon: z.enum(['rounded', 'square']).optional(),
        replyStyle: z.object({
            textColor: z.string().optional(),
            bgColor: z.string().optional(),
            replyType: z.enum(['bubble', 'text']).optional()
        }).optional(),
        senderStyle: z.object({
            textColor: z.string().optional(),
            bgColor: z.string().optional(),
            senderType: z.enum(['bubble', 'text']).optional()
        }).optional()
    }).optional(),
    greeting: z.string().optional(),
    faq: z.array(z.object({
        question: z.string(),
        answer: z.string()
    })).optional(),
    position: z.enum(['bottom-right', 'bottom-left']).optional(),
    integrations: z.array(z.object({
        provider: z.string().optional(),
        fileId: z.string().optional(),
        name: z.string().optional(),
        description: z.string().optional()
    })).optional(),
    verifiedDomains: z.array(z.string()).max(2, "Maximum 2 domains allowed").optional(),
    isBYOK: z.boolean().optional(),
    api: z.string().optional()
});

const updateChatBotSchema = chatBotSchema.partial();

const askChatBotSchema = z.object({
    question: z.string().min(1, "Question is required"),
    history: z.array(z.object({
        role: z.enum(['user', 'assistant', 'system']),
        content: z.string()
    })).optional()
});

module.exports = {
    chatBotSchema,
    updateChatBotSchema,
    askChatBotSchema
};
