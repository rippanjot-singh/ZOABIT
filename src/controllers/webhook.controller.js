const crypto = require('crypto');
const Subscription = require('../model/subscription.model');
const userModel = require('../model/user.model');
const { PLANS } = require('../config/plans');

const handleWebhook = async (req, res) => {
    try {
        const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
        const signature = req.headers['x-razorpay-signature'];
        
        // 1. Verify signature
        const expectedSignature = crypto.createHmac('sha256', secret)
            .update(req.body) // req.body is the RAW buffer from express.raw()
            .digest('hex');

        if (expectedSignature !== signature) {
            console.warn("[Webhook] ❌ Invalid signature.");
            return res.status(400).json({ error: 'Invalid signature' });
        }

        const event = JSON.parse(req.body.toString());
        console.log(`[Webhook] ✅ Received Event: ${event.event}`);

        const payload = event.payload?.subscription?.entity;
        if (!payload) return res.json({ skip: true });

        const userId = payload.notes?.userId;
        const planSlug = payload.notes?.planName?.toLowerCase();
        console.log(`[Webhook] Data -> User: ${userId}, Plan: ${planSlug}, SubID: ${payload.id}`);

        switch (event.event) {
            case 'subscription.activated':
            case 'subscription.charged':
                const updateData = {
                    status: 'active',
                    currentPeriodStart: new Date(payload.current_start * 1000),
                    currentPeriodEnd: new Date(payload.current_end * 1000),
                };
                
                const sub = await Subscription.findOneAndUpdate(
                    { razorpaySubId: { $regex: new RegExp(`^${payload.id}$`, 'i') } }, 
                    updateData
                );
                if (!sub) console.warn(`[Webhook] ⚠️ No database entry found for SubID: ${payload.id}`);

                if (userId && PLANS[planSlug]) {
                    const planDetails = PLANS[planSlug];
                    await userModel.findByIdAndUpdate(userId, {
                        subscription: planSlug,
                        subscriptionId: payload.id,
                        chatbotLimit: planDetails.chatbotLimit,
                        messageLimit: planDetails.messageLimit
                    });
                    console.log(`[Webhook] User ${userId} upgraded to ${planSlug}`);
                }
                break;

            case 'subscription.halted':
                await Subscription.findOneAndUpdate(
                    { razorpaySubId: { $regex: new RegExp(`^${payload.id}$`, 'i') } }, 
                    { status: 'halted' }
                );
                console.log(`[Webhook] ⛔ Subscription Halted: ${payload.id}`);
                break;

            case 'subscription.cancelled':
            case 'subscription.expired':
                await Subscription.findOneAndUpdate(
                    { razorpaySubId: { $regex: new RegExp(`^${payload.id}$`, 'i') } }, 
                    { status: 'cancelled' }
                );
                if (userId) {
                    await userModel.findByIdAndUpdate(userId, {
                        subscription: 'free',
                        subscriptionId: "",
                        chatbotLimit: PLANS.free.chatbotLimit,
                        messageLimit: PLANS.free.messageLimit
                    });
                }
                console.log(`[Webhook] ❌ Subscription Cancelled: ${payload.id} for user ${userId}`);
                break;

            case 'payment.refunded':
                console.log(`[Webhook] 💸 Payment Refunded: ${payload.id}`);
                break;
        }

        res.json({ success: true });
    } catch (err) {
        console.error("[Webhook Error]:", err.message);
        res.status(500).json({ error: err.message });
    }
}

module.exports = { handleWebhook };
