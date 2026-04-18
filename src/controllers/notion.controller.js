const { getNotionAuthUrl, getNotionTokens, searchNotion } = require("../services/notion.service");
const userModel = require("../model/user.model");

/**
 * Redirects user to Notion OAuth page.
 */
async function authNotionController(req, res) {
    try {
        const { state, returnTo } = req.query;
        // Merge state and returnTo if both provided
        const finalState = returnTo ? `${state}|${returnTo}` : state;
        res.redirect(getNotionAuthUrl(finalState));
    } catch (error) {
        res.status(500).json({ message: "Error generating Notion Auth URL", error: error.message });
    }
}

/**
 * Handles the redirect from Notion after authorization.
 */
async function notionCallbackController(req, res) {
    try {
        const { code, state } = req.query;
        if (!code) return res.status(400).json({ message: "Authorization code missing." });

        let currentState = state;
        let returnTo = '/dashboard/create-agent'; // default fallback

        if (state?.includes('|')) {
            const [s, r] = state.split('|');
            currentState = s;
            returnTo = r;
        }

        const tokens = await getNotionTokens(code);
        
        const token = req.cookies.token;
        if (!token) return res.status(401).json({ message: "Session expired during Notion connection." });

        const jwt = require('jsonwebtoken');
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        const user = await userModel.findById(decoded.userId);
        if (user) {
            user.notionTokens = tokens;
            await user.save();
        }

        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        res.redirect(`${frontendUrl}${returnTo}`);
    } catch (error) {
        console.error("[Notion Callback Error]:", error);
        res.status(500).send("Authentication failed. " + error.message);
    }
}

/**
 * Searches Notion using the logged-in user's token.
 */
async function searchNotionController(req, res) {
    try {
        const user = await userModel.findById(req.user.userId);
        if (!user?.notionTokens?.access_token) {
            // Fallback to system key if provided and user hasn't connected
            if (process.env.NOTION_API_KEY) {
                const results = await searchNotion(process.env.NOTION_API_KEY);
                return res.status(200).json({ success: true, data: results, isSystemKey: true });
            }
            return res.status(401).json({ success: false, message: "Notion not connected.", reconnect: true });
        }

        const results = await searchNotion(user.notionTokens.access_token);
        res.status(200).json({ success: true, data: results });
    } catch (error) {
        console.error("[Notion Controller Error]:", error);
        res.status(500).json({ success: false, message: error.message });
    }
}

/**
 * Clears the user's Notion tokens.
 */
async function disconnectNotionController(req, res) {
    try {
        const user = await userModel.findById(req.user.userId);
        if (user) {
            user.notionTokens = undefined;
            await user.save();
        }
        res.status(200).json({ success: true, message: "Notion disconnected successfully" });
    } catch (error) {
        console.error("[Notion Disconnect Error]:", error);
        res.status(500).json({ success: false, message: error.message });
    }
}

module.exports = {
    authNotionController,
    notionCallbackController,
    searchNotionController,
    disconnectNotionController
};
