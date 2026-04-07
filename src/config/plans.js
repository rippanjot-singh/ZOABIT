const PLANS = {
    free: {
        name: 'Free',
        chatbotLimit: 1,
        messageLimit: 100,
        price: 0
    },
    starter: {
        name: 'Starter',
        chatbotLimit: 2,
        messageLimit: 1500,
        price: 17900 // ₹179 in paise
    },
    pro: {
        name: 'Pro',
        chatbotLimit: 4,
        messageLimit: 4000,
        price: 29900 // ₹299 in paise
    },
    enterprise: {
        name: 'Enterprise',
        chatbotLimit: 15,
        messageLimit: 20000,
        price: 89900 // ₹899 in paise
    }
};

module.exports = { PLANS };
