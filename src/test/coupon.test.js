const couponModel = require('../model/coupon.model');
const { connectDB } = require('../config/db');

async function createCoupon(code, offerId, discountType = 'percentage', discountValue = 0) {
    await connectDB();
    const coupon = await couponModel.create({
        code,
        offerId,
        discountType,
        discountValue
    });
    console.log(coupon);
}

createCoupon('ADMINFOREVER', 'offer_ScHvDPrQsG3aND', 'percentage', 99);