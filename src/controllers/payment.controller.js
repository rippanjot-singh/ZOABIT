const razorpay = require('../config/razorpay');
const chatBotModel = require('../model/chatBot.model');
const couponModel = require('../model/coupon.model');
const { generateSlug } = require('../utils/bot.utils');
const { createBYOKOrderSchema, createChatAddonOrderSchema } = require('../validators/payment.validator');

const createBYOKOrder = async (req, res) => {
    try {
        const validated = createBYOKOrderSchema.parse(req.body);
        const { chatbotName, chatbotId } = validated;
        const userId = req.user.userId;

        let bot;
        let type = 'byok_activation';

        if (chatbotId) {
            // Reuse existing bot — verify ownership and eligibility
            bot = await chatBotModel.findOne({ _id: chatbotId, userId, isBYOK: true });
            if (!bot) return res.status(404).json({ success: false, message: 'BYOK bot not found or access denied.' });
            if (bot.paymentStatus === 'paid') return res.status(400).json({ success: false, message: 'This bot is already activated.' });
        } else {
            // Fresh creation flow (from AgentTypeModal)
            // We NO LONGER create the bot here to avoid "ghost" entries if payment is cancelled.
            // We'll create it in the webhook after payment is captured.
            type = 'byok_new_activation';
        }

        const options = {
            amount: 1200,
            currency: 'USD',
            receipt: chatbotId ? `byok_${chatbotId}` : `byok_new_${userId.toString().slice(-6)}_${Date.now()}`,
            notes: {
                type,
                userId,
                chatbotId: chatbotId || 'new',
                chatbotName: chatbotName
            }
        };

        const order = await razorpay.orders.create(options);

        res.status(200).json({
            success: true,
            orderId: order.id,
            chatbotId: chatbotId || null,
            amount: order.amount,
            currency: order.currency,
            keyId: process.env.RAZORPAY_KEY_ID
        });
    } catch (error) {
        if (error.name === 'ZodError') return res.status(400).json({ success: false, message: error.errors[0].message });
        console.error('[Razorpay Order Export Error]:', error);
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

        const messagesToAdd = Math.floor((amount / 9) * 1200);

        const options = {
            amount: Math.round(finalAmount * 100), // to paise
            currency: 'USD',
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
