const mongoose = require('mongoose');

const couponSchema = new mongoose.Schema({
    code: { type: String, required: true, unique: true },
    offerId: { type: String, required: true },
    discountType: { type: String, enum: ['percentage', 'flat'], default: 'percentage' },
    discountValue: { type: Number, default: 0 },
}, { timestamps: true });

const couponModel = mongoose.model('coupon', couponSchema);

module.exports = couponModel;