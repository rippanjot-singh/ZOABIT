/**
 * Verifies if the request origin is allowed for a specific chatbot.
 * @param {string} origin - Request origin header.
 * @param {Object} chatBot - Chatbot document.
 * @returns {boolean}
 */
const isDomainVerified = (origin, chatBot) => {
    const isDashboardRequest = origin?.includes('localhost') || origin?.includes('127.0.0.1');

    if (isDashboardRequest) return true;
    if (!chatBot.verifiedDomains || chatBot.verifiedDomains.length === 0) return true;

    const cleanOrigin = origin?.replace(/^https?:\/\//i, '');
    return chatBot.verifiedDomains.some(domain => cleanOrigin === domain);
};

/**
 * Checks if a BYOK bot is active (paid).
 * @param {Object} chatBot - Chatbot document.
 * @returns {boolean}
 */
const isBYOKActive = (chatBot) => {
    if (!chatBot.isBYOK) return true;
    return chatBot.paymentStatus === 'paid';
};

module.exports = {
    isDomainVerified,
    isBYOKActive
};
