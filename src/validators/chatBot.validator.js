const { z } = require('zod');

const chatBotSchema = z.object({
    name: z.string().min(1, "Name is required"),
    prompt: z.string().optional(),
    provider: z.string().optional(),
    model: z.string().optional(),
    style: z.object({
        brandColor: z.object({
            primary: z.string(),
            secondary: z.string(),
            accent: z.string()
        }).optional(),
        textColor: z.string().optional(),
        bgColor: z.string().optional(),
        corner: z.enum(['rounded', 'square']).optional(),
        icon: z.enum(['rounded', 'square']).optional()
    }).optional(),
    greeting: z.string().optional(),
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
