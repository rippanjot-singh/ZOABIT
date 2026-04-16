

/**
 * Verifies if the request origin is allowed for a specific chatbot.
 * @param {string} origin - Request origin header.
 * @param {Object} chatBot - Chatbot document.
 * @returns {boolean}
 */
/**
 * Helper to match a URL against a pattern (supports * wildcard)
 */
const matchPattern = (url, pattern) => {
    if (!pattern || !url) return false;
    
    // If no wildcard, use simple inclusion
    if (!pattern.includes('*')) return url.includes(pattern);

    // Special case: Pattern ends with /* (most common for 'anything after')
    if (pattern.endsWith('/*')) {
        const prefix = pattern.slice(0, -1); // everything except the *
        const parts = url.split(prefix);
        // It matches only if the prefix exists AND there is at least one character after it
        return parts.length > 1 && parts[1].length > 0;
    }

    // General case: Convert wildcard pattern to Regex
    const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&');
    const regexStr = escaped.replace(/\\\*/g, '.*');
    const regex = new RegExp(regexStr, 'i');
    
    return regex.test(url);
};

const isDomainVerified = (req, chatBot) => {
    const origin = req?.headers?.origin || '';
    const referer = req?.headers?.referer || '';
    const queryUrl = req?.query?.currentUrl || '';

    // Important: check both origin and referer/currentUrl
    const urlToCheck = queryUrl || referer || origin;

    // 1. Block restricted domains/paths first
    if (chatBot.restrictedDomains && chatBot.restrictedDomains.length > 0) {
        if (chatBot.restrictedDomains.some(pattern => matchPattern(urlToCheck, pattern))) {
            return false;
        }
    }

    // 2. Allow our own dashboard requests unconditionally (unless explicitly restricted above)
    const frontend_url = process.env.FRONTEND_URL ? process.env.FRONTEND_URL.replace(/^https?:\/\/(www\.)?/, "") : "";
    const isDashboardRequest = origin.includes('localhost') || origin.includes('127.0.0.1') || (frontend_url.length > 0 && origin.includes(frontend_url));

    if (isDashboardRequest) return true;

    // 3. If no verified domains exist, allow all (except restricted)
    if (!chatBot.verifiedDomains || chatBot.verifiedDomains.length === 0) return true;

    // 4. Finally, check against verified list
    return chatBot.verifiedDomains.some(pattern => matchPattern(urlToCheck, pattern));
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

const generateSlug = (name) => {
    return name
        .toLowerCase()
        .replace(/[^\w ]+/g, '')
        .replace(/ +/g, '-');
};

module.exports = {
    isDomainVerified,
    isBYOKActive,
    generateSlug
};
