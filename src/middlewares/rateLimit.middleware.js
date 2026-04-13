const rateLimit = require('express-rate-limit');

/**
 * Global API Rate Limiter
 * Applied to all routes to prevent basic DDoS and brute force.
 */
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 500, // Limit each IP to 100 requests per windowMs
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    message: {
        success: false,
        message: "Too many requests from this IP, please try again after 15 minutes."
    }
});

/**
 * Strict Chatbox Limiter
 * Applied to the "Ask Chatbot" endpoint to prevent spamming AI costs.
 * 10 messages per minute.
 */
const chatLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 10, // Limit each IP to 10 requests per minute
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res, next, options) => {
        res.status(429).json({
            success: false,
            message: "Slow down! You've reached the message limit for this minute. Reach out to our human team if you need urgent help.",
            isRateLimit: true
        });
    }
});

/**
 * Password/Auth Limiter
 * Stricter limit for login/register to prevent brute force.
 */
const authLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10, // 10 attempts per hour
    message: {
        success: false,
        message: "Too many login attempts. Please try again in an hour."
    }
});

module.exports = {
    apiLimiter,
    chatLimiter,
    authLimiter
};
