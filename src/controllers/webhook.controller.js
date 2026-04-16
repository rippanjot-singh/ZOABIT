const crypto = require('crypto');
const Subscription = require('../model/subscription.model');
const userModel = require('../model/user.model');
const chatBotModel = require('../model/chatBot.model');
const { PLANS } = require('../config/plans');
const { generateSlug } = require('../utils/bot.utils');

const handleSubscriptionEvent = async (event, payload) => {
    const userId = payload.notes?.userId;
    const planSlug = payload.notes?.planName?.toLowerCase();
    
    const updateData = {
        status: event.includes('activated') || event.includes('charged') ? 'active' : 'cancelled',
        currentPeriodStart: payload.current_start ? new Date(payload.current_start * 1000) : undefined,
        currentPeriodEnd: payload.current_end ? new Date(payload.current_end * 1000) : undefined,
    };
    
    await Subscription.findOneAndUpdate(
        { razorpaySubId: { $regex: new RegExp(`^${payload.id}$`, 'i') } },
        updateData
    );

    if (userId && PLANS[planSlug]) {
        const planDetails = PLANS[planSlug];
        const updateFields = {
            subscription: planSlug,
            subscriptionId: payload.id,
            chatbotLimit: planDetails.chatbotLimit,
            messageLimit: planDetails.messageLimit
        };

        // Reset message count on billing events (activation or renewal)
        if (event === 'subscription.activated' || event === 'subscription.charged') {
            updateFields.messageCount = 0;
            updateFields.lastResetDate = new Date();
            console.log(`[Webhook] 🔄 Reseting Quota for User: ${userId} (${planSlug})`);
        }

        await userModel.findByIdAndUpdate(userId, updateFields);
    }
};

const handlePaymentCaptured = async (payload) => {
    const type = payload?.notes?.type;
    const userId = payload?.notes?.userId;

    if (type === 'chat_addon' && userId) {
        const messagesToAdd = parseInt(payload.notes.messagesToAdd);
        await userModel.findByIdAndUpdate(userId, {
            $inc: { extraMessages: messagesToAdd }
        });
        console.log(`[Webhook] 💬 Added ${messagesToAdd} messages to User: ${userId}`);
        return;
    }

    const { chatbotId, chatbotName } = payload?.notes || {};

    if (type === 'byok_new_activation' && userId && chatbotName) {
        // Create the bot from scratch after payment
        let slug = generateSlug(chatbotName);
        const existing = await chatBotModel.findOne({ slug });
        if (existing) slug = `${slug}-${Math.random().toString(36).slice(2, 6)}`;

        const newBot = await chatBotModel.create({
            name: chatbotName,
            userId,
            isBYOK: true,
            paymentStatus: 'paid',
            slug
        });
        console.log(`[Webhook] 🆕 BYOK Bot Created & Activated: ${newBot._id}`);
        return;
    }

    if (type !== 'byok_activation' || (type === 'byok_activation' && !chatbotId)) return;

    const updated = await chatBotModel.findOneAndUpdate(
        { _id: chatbotId },
        { paymentStatus: 'paid' },
        { new: true }
    );

    if (updated) console.log(`[Webhook] ✅ Chatbot Activated: ${updated._id}`);
};

const handleWebhook = async (req, res) => {
    try {
        const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
        const signature = req.headers['x-razorpay-signature'];
        
        const expectedSignature = crypto.createHmac('sha256', secret)
            .update(req.body)
            .digest('hex');

        if (expectedSignature !== signature) {
            console.error("[Webhook] ❌ Signature Mismatch. Check RAZORPAY_WEBHOOK_SECRET.");
            return res.status(400).json({ error: 'Invalid signature' });
        }

        const event = JSON.parse(req.body.toString());
        const paymentEntity = event.payload?.payment?.entity;
        const orderEntity = event.payload?.order?.entity;
        const subEntity = event.payload?.subscription?.entity;

        const payload = subEntity || paymentEntity || orderEntity;
        
        // Merge notes from order if missing in payment
        if (paymentEntity && orderEntity && (!paymentEntity.notes || Object.keys(paymentEntity.notes).length === 0)) {
            paymentEntity.notes = orderEntity.notes;
        }

        if (!payload) {
            console.log(`[Webhook] ⚠️ No payload found for event: ${event.event}`);
            return res.json({ skip: true });
        }

        console.log(`[Webhook] 🔔 Event Received: ${event.event}`, {
            id: payload.id,
            type: payload.notes?.type,
            userId: payload.notes?.userId
        });

        switch (event.event) {
            case 'subscription.activated':
            case 'subscription.charged':
            case 'subscription.cancelled':
            case 'subscription.expired':
                await handleSubscriptionEvent(event.event, subEntity || payload);
                break;
            case 'subscription.halted':
                await Subscription.findOneAndUpdate(
                    { razorpaySubId: { $regex: new RegExp(`^${payload.id}$`, 'i') } },
                    { status: 'halted' }
                );
                break;
            case 'payment.captured':
                await handlePaymentCaptured(paymentEntity || payload);
                break;
        }

        res.json({ success: true });
    } catch (err) {
        console.error("[Webhook Error]:", err.message);
        res.status(500).json({ error: err.message });
    }
};

module.exports = { handleWebhook };

