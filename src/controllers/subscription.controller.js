const razorpay = require('../config/razorpay');
const Subscription = require('../model/subscription.model');
const userModel = require('../model/user.model');
const { PLANS } = require('../config/plans');

const createSubscription = async (req, res) => {
    const { planId, userId, planName } = req.body;

    try {
        const subscription = await razorpay.subscriptions.create({
            plan_id: planId,
            customer_notify: 1,
            total_count: 12,
            notes: {
                userId,
                planName // 'starter', 'pro', or 'enterprise'
            }
        });

        // Save to DB
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
        console.error("[Razorpay Subscription Create Error]:", err);
        res.status(500).json({ error: err.error?.description || err.message });
    }
};

const getSubscription = async (req, res) => {
    const sub = await Subscription.findOne({ userId: req.params.userId });
    res.json(sub);
};

const cancelSubscription = async (req, res) => {
    const { subscriptionId } = req.body;

    if (!subscriptionId) {
        return res.status(400).json({ error: "Missing subscription ID." });
    }

    try {
        const cleanSubId = subscriptionId.trim();
        console.log(`[Subscription] 🌀 Attempting to cancel (Exact ID): ${cleanSubId}`);

        // 2. Cancel in Razorpay (false = cancel IMMEDIATELY)
        try {
            console.log(`[Razorpay] 📤 Sending cancellation request for: ${cleanSubId}`);
            await razorpay.subscriptions.cancel(cleanSubId, false);
        } catch (rzpErr) {
            console.error("[Razorpay Error Detail]:", rzpErr);
            const errorDesc = rzpErr.error?.description || rzpErr.description || rzpErr.message;
            
            // Only allow downgrade if it's ALREADY cancelled on RZP
            if (errorDesc?.toLowerCase().includes('already cancelled')) {
                console.log("[Razorpay] Subscription is already cancelled in RZP, proceeding with local cleanup.");
            } else {
                // For 'Invalid ID' or other errors, we STOP and fail.
                const userWarning = errorDesc?.includes('invalid') 
                    ? "Invalid ID. Check your Razorpay Dashboard manually to ensure you aren't being charged." 
                    : errorDesc;
                return res.status(400).json({ error: userWarning });
            }
        }

        // 3. Find sub record for detailed tracking
        const sub = await Subscription.findOne({ 
            razorpaySubId: { $regex: new RegExp(`^${cleanSubId}$`, "i") } 
        });

        // 4. Update in DB (Case-insensitive)
        await Subscription.findOneAndUpdate(
            { razorpaySubId: { $regex: new RegExp(`^${cleanSubId}$`, "i") } },
            { status: 'cancelled' }
        );

        // 5. Instantly Downgrade User Profile
        if (sub && sub.userId) {
            await userModel.findByIdAndUpdate(sub.userId, {
                subscription: 'free',
                subscriptionId: "",
                chatbotLimit: PLANS.free.chatbotLimit,
                messageLimit: PLANS.free.messageLimit
            });
            console.log(`[Subscription] ✅ Account ${sub.userId} successfully reverted to Free.`);
        }

        res.json({ success: true, message: "Subscription will be cancelled at the end of the current period." });
    } catch (err) {
        console.error("[Razorpay Cancel Error]:", err);
        res.status(500).json({ error: "Internal server error during cancellation." });
    }
};

module.exports = { createSubscription, getSubscription, cancelSubscription };