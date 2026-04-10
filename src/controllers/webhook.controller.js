const crypto = require('crypto');
const Subscription = require('../model/subscription.model');
const userModel = require('../model/user.model');
const chatBotModel = require('../model/chatBot.model');
const { PLANS } = require('../config/plans');

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
        await userModel.findByIdAndUpdate(userId, {
            subscription: planSlug,
            subscriptionId: payload.id,
            chatbotLimit: planDetails.chatbotLimit,
            messageLimit: planDetails.messageLimit
        });
    }
};

const handlePaymentCaptured = async (payload) => {
    const chatbotId = payload?.notes?.chatbotId;
    if (payload?.notes?.type !== 'byok_activation' || !chatbotId) return;

    let updated = await chatBotModel.findOneAndUpdate(
        { _id: chatbotId },
        { paymentStatus: 'paid' },
        { new: true }
    );

    if (!updated) {
        updated = await chatBotModel.findOneAndUpdate(
            { 
                name: payload.notes.chatbotName, 
                userId: payload.notes.userId,
                isBYOK: true 
            },
            { paymentStatus: 'paid' },
            { new: true }
        );
    }

    if (updated) console.log(`[Webhook] ✅ Chatbot Activated: ${updated._id}`);
};

const handleWebhook = async (req, res) => {
    try {
        const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
        const signature = req.headers['x-razorpay-signature'];
        
        const expectedSignature = crypto.createHmac('sha256', secret)
            .update(req.body)
            .digest('hex');

        if (expectedSignature !== signature) return res.status(400).json({ error: 'Invalid signature' });

        const event = JSON.parse(req.body.toString());
        const payload = event.payload?.subscription?.entity || event.payload?.payment?.entity;

        if (!payload) return res.json({ skip: true });

        switch (event.event) {
            case 'subscription.activated':
            case 'subscription.charged':
            case 'subscription.cancelled':
            case 'subscription.expired':
                await handleSubscriptionEvent(event.event, payload);
                break;
            case 'subscription.halted':
                await Subscription.findOneAndUpdate(
                    { razorpaySubId: { $regex: new RegExp(`^${payload.id}$`, 'i') } },
                    { status: 'halted' }
                );
                break;
            case 'payment.captured':
                await handlePaymentCaptured(payload);
                break;
        }

        res.json({ success: true });
    } catch (err) {
        console.error("[Webhook Error]:", err.message);
        res.status(500).json({ error: err.message });
    }
};

module.exports = { handleWebhook };

