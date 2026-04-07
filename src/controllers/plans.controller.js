const razorpay = require('../config/razorpay');

const createPlan = async (req, res) => {
  try {
    const plan = await razorpay.plans.create({
      period: 'monthly',
      interval: 1,
      item: {
        name: 'Pro Plan',
        amount: 14900, // INR 149.00 (amount in paise)
        currency: 'INR',
        description: 'Monthly Pro Subscription',
      },
    });
    res.json(plan);
  } catch (err) {
    console.error('Razorpay Plan Create Error:', err);
    res.status(500).json({ 
      error: err.message,
      description: err.error ? err.error.description : 'Unknown Razorpay error'
    });
  }
}

module.exports = { createPlan };
