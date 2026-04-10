const razorpay = require('../config/razorpay');
const chatBotModel = require('../model/chatBot.model');
const { createBYOKOrderSchema } = require('../validators/payment.validator');

const createBYOKOrder = async (req, res) => {
    try {
        const validated = createBYOKOrderSchema.parse(req.body);
        const { chatbotName } = validated;
        const userId = req.user.userId;

        const initialBot = await chatBotModel.create({
            name: chatbotName,
            userId: userId,
            isBYOK: true,
            paymentStatus: 'not-paid',
            provider: 'Mistral-Ai',
            model: 'open-mistral-nemo',
            prompt: 'You are a helpful AI assistant.',
            greeting: 'Hello! How can I help you today?',
            style: {
                brandColor: { primary: '#2563eb', secondary: '#1d4ed8', accent: '#3b82f6' },
                textColor: '#0f172a',
                bgColor: '#ffffff',
                corner: 'rounded',
                icon: 'rounded',
                replyStyle: { textColor: '#1e293b', bgColor: 'transparent', replyType: 'bubble' },
                senderStyle: { textColor: '#ffffff', bgColor: '#2563eb', senderType: 'bubble' }
            }
        });

        const options = {
            amount: 14900, 
            currency: 'INR',
            receipt: `byok_${initialBot._id}`,
            notes: {
                type: 'byok_activation',
                userId: userId,
                chatbotId: initialBot._id.toString(),
                chatbotName: chatbotName
            }
        };

        const order = await razorpay.orders.create(options);

        res.status(200).json({
            success: true,
            orderId: order.id,
            chatbotId: initialBot._id,
            amount: order.amount,
            currency: order.currency,
            keyId: process.env.RAZORPAY_KEY_ID
        });
    } catch (error) {
        if (error.name === 'ZodError') return res.status(400).json({ success: false, message: error.errors[0].message });
        console.error("[Razorpay Order Export Error]:", error);
        res.status(500).json({ error: error.message });
    }
};

module.exports = { createBYOKOrder };

