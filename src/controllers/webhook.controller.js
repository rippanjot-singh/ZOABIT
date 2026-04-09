const crypto = require('crypto');
const Subscription = require('../model/subscription.model');
const userModel = require('../model/user.model');
const chatBotModel = require('../model/chatBot.model');
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
        console.log(`[Webhook] 📥 RAW EVENT: ${event.event}`);

        switch (event.event) {
            case 'subscription.activated':
            case 'subscription.charged': {
                const payload = event.payload?.subscription?.entity;
                if (!payload) {
                    console.warn("[Webhook] ⚠️ No subscription payload found in entity");
                    return res.json({ skip: true });
                }
                const userId = payload.notes?.userId;
                const planSlug = payload.notes?.planName?.toLowerCase();
                console.log(`[Webhook] 💳 Sub Event: ${event.event} | User: ${userId} | Plan: ${planSlug}`);

                const updateData = {
                    status: 'active',
                    currentPeriodStart: new Date(payload.current_start * 1000),
                    currentPeriodEnd: new Date(payload.current_end * 1000),
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
                break;
            }

            case 'subscription.halted': {
                const payload = event.payload?.subscription?.entity;
                if (!payload) return res.json({ skip: true });
                console.log(`[Webhook] ⛔ Sub Halted: ${payload.id}`);
                await Subscription.findOneAndUpdate(
                    { razorpaySubId: { $regex: new RegExp(`^${payload.id}$`, 'i') } }, 
                    { status: 'halted' }
                );
                break;
            }

            case 'subscription.cancelled':
            case 'subscription.expired': {
                const payload = event.payload?.subscription?.entity;
                if (!payload) return res.json({ skip: true });
                const userId = payload.notes?.userId;
                console.log(`[Webhook] ❌ Sub Cancelled: ${payload.id}`);

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
                break;
            }

            case 'payment.captured': {
                const paymentPayload = event.payload?.payment?.entity;
                console.log(`[Webhook] 💰 Payment Captured Event: ${paymentPayload?.id}`);
                const chatbotId = paymentPayload?.notes?.chatbotId;
                
                if (paymentPayload?.notes?.type === 'byok_activation' && chatbotId) {
                    // Use findOne to be more explicit
                    const updated = await chatBotModel.findOneAndUpdate(
                        { _id: chatbotId },
                        { paymentStatus: 'paid' },
                        { new: true }
                    );

                    if (updated) {
                        console.log(`[Webhook] ✅ BYOK Chatbot Activated by ID: ${chatbotId} (${updated.name})`);
                    } else {
                        console.warn(`[Webhook] ⚠️ Chatbot NOT found by ID: ${chatbotId}. Trying fallback by name...`);
                        
                        // Fallback: Try finding by name and userId
                        const fallbackBot = await chatBotModel.findOneAndUpdate(
                            { 
                                name: paymentPayload.notes.chatbotName, 
                                userId: paymentPayload.notes.userId,
                                isBYOK: true 
                            },
                            { paymentStatus: 'paid' },
                            { new: true }
                        );

                        if (fallbackBot) {
                            console.log(`[Webhook] ✅ BYOK Chatbot Activated by Fallback: ${fallbackBot._id} (${fallbackBot.name})`);
                        } else {
                            console.error(`[Webhook] ❌ CRITICAL: No chatbot found by ID or Name!`);
                        }
                    }
                } else {
                    console.log(`[Webhook] ℹ️ Non-BYOK payment or missing notes. Skipping activation.`);
                }
                break;
            }

            case 'payment.refunded':
                console.log(`[Webhook] 💸 Payment Refunded`);
                break;
        }

        res.json({ success: true });
    } catch (err) {
        console.error("[Webhook Error]:", err.message);
        res.status(500).json({ error: err.message });
    }
}

module.exports = { handleWebhook };
