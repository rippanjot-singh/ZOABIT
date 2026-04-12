const { z } = require('zod');

const createBYOKOrderSchema = z.object({
    chatbotName: z.string().min(1, "Chatbot name is required")
});

const createSubscriptionSchema = z.object({
    planId: z.string().min(1, "Plan ID is required"),
    userId: z.string().min(1, "User ID is required"),
    planName: z.enum(['free', 'starter', 'pro', 'enterprise']),
    offerId: z.string().optional()
});

const cancelSubscriptionSchema = z.object({
    subscriptionId: z.string().min(1, "Subscription ID is required")
});

const createChatAddonOrderSchema = z.object({
    amount: z.number().min(99, "Minimum order amount is ₹99"),
    couponCode: z.string().optional()
});

module.exports = {
    createBYOKOrderSchema,
    createSubscriptionSchema,
    cancelSubscriptionSchema,
    createChatAddonOrderSchema
};
