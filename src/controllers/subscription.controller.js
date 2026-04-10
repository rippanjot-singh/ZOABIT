const razorpay = require('../config/razorpay');
const Subscription = require('../model/subscription.model');
const userModel = require('../model/user.model');
const { PLANS } = require('../config/plans');
const { createSubscriptionSchema, cancelSubscriptionSchema } = require('../validators/payment.validator');

const createSubscription = async (req, res) => {
    try {
        const validated = createSubscriptionSchema.parse(req.body);
        const { planId, userId, planName } = validated;

        const subscription = await razorpay.subscriptions.create({
            plan_id: planId,
            customer_notify: 1,
            total_count: 12,
            notes: { userId, planName }
        });

        await Subscription.create({
            userId,
            razorpaySubId: subscription.id,
            razorpayPlanId: planId,
            planName,
            status: 'created',
        });

        res.json({
            subscriptionId: subscription.id,
            keyId: process.env.RAZORPAY_KEY_ID,
        });
    } catch (err) {
        if (err.name === 'ZodError') return res.status(400).json({ success: false, message: err.errors[0].message });
        console.error("[Razorpay Subscription Create Error]:", err);
        res.status(500).json({ error: err.error?.description || err.message });
    }
};

const getSubscription = async (req, res) => {
    try {
        const sub = await Subscription.findOne({ userId: req.params.userId });
        res.json(sub);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const cancelSubscription = async (req, res) => {
    try {
        const validated = cancelSubscriptionSchema.parse(req.body);
        const { subscriptionId } = validated;
        const cleanSubId = subscriptionId.trim();

        try {
            await razorpay.subscriptions.cancel(cleanSubId, false);
        } catch (rzpErr) {
            const errorDesc = rzpErr.error?.description || rzpErr.description || rzpErr.message;
            if (!errorDesc?.toLowerCase().includes('already cancelled')) {
                const userWarning = errorDesc?.includes('invalid') ? "Invalid ID." : errorDesc;
                return res.status(400).json({ error: userWarning });
            }
        }

        const sub = await Subscription.findOneAndUpdate(
            { razorpaySubId: { $regex: new RegExp(`^${cleanSubId}$`, "i") } },
            { status: 'cancelled' },
            { new: true }
        );

        if (sub?.userId) {
            await userModel.findByIdAndUpdate(sub.userId, {
                subscription: 'free',
                subscriptionId: "",
                chatbotLimit: PLANS.free.chatbotLimit,
                messageLimit: PLANS.free.messageLimit
            });
        }

        res.json({ success: true, message: "Subscription cancelled successfully." });
    } catch (err) {
        if (err.name === 'ZodError') return res.status(400).json({ success: false, message: err.errors[0].message });
        console.error("[Razorpay Cancel Error]:", err);
        res.status(500).json({ error: "Internal server error during cancellation." });
    }
};

module.exports = { createSubscription, getSubscription, cancelSubscription };