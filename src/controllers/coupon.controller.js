const couponModel = require('../model/coupon.model');

const validateCoupon = async (req, res) => {
    try {
        const { code } = req.body;
        console.log(`[Coupon] 🎫 Validating code: "${code}"`);
        
        if (!code) return res.status(400).json({ success: false, message: "Coupon code is required" });

        // Case-insensitive search using regex
        const coupon = await couponModel.findOne({ code: { $regex: new RegExp(`^${code}$`, 'i') } });
        
        if (!coupon) {
            console.log(`[Coupon] ❌ Invalid code: "${code}"`);
            return res.status(404).json({ success: false, message: "Invalid coupon code" });
        }

        console.log(`[Coupon] ✅ Valid: "${coupon.code}" (offerId: ${coupon.offerId})`);
        res.status(200).json({ 
            success: true, 
            data: {
                code: coupon.code,
                offerId: coupon.offerId,
                discountType: coupon.discountType,
                discountValue: coupon.discountValue
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = { validateCoupon };
