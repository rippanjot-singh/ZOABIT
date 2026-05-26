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
        price: 1500 //$15 in cents
    },
    pro: {
        name: 'Pro',
        chatbotLimit: 4,
        messageLimit: 4000,
        price: 2900 // $29 in cents
    },
    enterprise: {
        name: 'Enterprise',
        chatbotLimit: 15,
        messageLimit: 20000,
        price: 7900 // $79 in cents
    }
};

module.exports = { PLANS };
