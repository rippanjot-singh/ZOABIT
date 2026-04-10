/**
 * Checks and resets user message quota if a month has passed.
 * @param {Object} user - User document.
 * @returns {Promise<boolean>} - True if reset happened.
 */
const checkAndResetQuota = async (user) => {
    const now = new Date();
    const lastReset = new Date(user.lastResetDate || user.createdAt || now);
    const thirtyDaysInMs = 30 * 24 * 60 * 60 * 1000;

    if (now - lastReset >= thirtyDaysInMs) {
        user.messageCount = 0;
        user.lastResetDate = now;
        await user.save();
        return true;
    }
    return false;
};

/**
 * Validates if the user has reached their message limit.
 * @param {Object} user - User document.
 * @returns {boolean} - True if limit is reached.
 */
const isQuotaExceeded = (user) => {
    return user.messageCount >= user.messageLimit;
};

module.exports = {
    checkAndResetQuota,
    isQuotaExceeded
};
