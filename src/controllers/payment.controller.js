const razorpay = require('../config/razorpay');
const chatBotModel = require('../model/chatBot.model');
const couponModel = require('../model/coupon.model');
const { createBYOKOrderSchema, createChatAddonOrderSchema } = require('../validators/payment.validator');

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

const createChatAddonOrder = async (req, res) => {
    try {
        const validated = createChatAddonOrderSchema.parse(req.body);
        const { amount, couponCode } = validated;
        const userId = req.user.userId;

        let finalAmount = amount;
        let offerId = null;

        if (couponCode) {
            const coupon = await couponModel.findOne({ code: couponCode.toUpperCase() });
            if (coupon) {
                if (coupon.discountType === 'percentage') {
                    finalAmount = amount - (amount * (coupon.discountValue / 100));
                } else if (coupon.discountType === 'flat') {
                    finalAmount = Math.max(0, amount - coupon.discountValue);
                }
                offerId = coupon.offerId;
            }
        }

        const messagesToAdd = Math.floor((amount / 99) * 1200);

        const options = {
            amount: Math.round(finalAmount * 100), // to paise
            currency: 'INR',
            receipt: `ca_${userId.toString().slice(-6)}_${Date.now()}`,
            notes: {
                type: 'chat_addon',
                userId: userId,
                amount: amount,
                messagesToAdd: messagesToAdd
            }
        };

        if (offerId) {
            options.offer_id = offerId;
        }

        const order = await razorpay.orders.create(options);

        res.status(200).json({
            success: true,
            orderId: order.id,
            amount: order.amount,
            currency: order.currency,
            keyId: process.env.RAZORPAY_KEY_ID,
            messagesToAdd: messagesToAdd
        });
    } catch (error) {
        if (error.name === 'ZodError') return res.status(400).json({ success: false, message: error.errors[0].message });
        console.error("[Razorpay Chat Addon Order Error]:", error);
        res.status(500).json({ 
            success: false, 
            message: "Razorpay Order Creation Failed", 
            error: error.message,
            stack: error.stack,
            details: error.error // Razorpay specific error field
        });
    }
};

module.exports = { createBYOKOrder, createChatAddonOrder };
