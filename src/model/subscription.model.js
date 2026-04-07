const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'user',
        required: true
    },
    razorpaySubId: {
        type: String,
        required: true,
        unique: true
    },
    razorpayPlanId: {
        type: String,
        required: true
    },
    status: {
        type: String,
        enum: ['created', 'active', 'halted', 'cancelled', 'expired'],
        default: 'created'
    },
    currentPeriodStart: {
        type: Date,
    },
    currentPeriodEnd: {
        type: Date,
    },
    planName: {
        type: String,
    },
}, { timestamps: true });

module.exports = mongoose.model('Subscription', subscriptionSchema);