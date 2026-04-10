const { getAuthUrl, getTokens, getValidTokens, readGoogleSheet, readGoogleDoc, listGoogleFiles, getUserInfo } = require('../services/google.service');
const userModel = require("../model/user.model");
const { generateToken, setAuthCookie } = require('../utils/auth.utils');
const jwt = require('jsonwebtoken');

const processTokens = (existing, incoming) => {
    const merged = { ...existing, ...incoming };
    if (!incoming.refresh_token && existing?.refresh_token) merged.refresh_token = existing.refresh_token;
    if (!merged.expiry_date && incoming.expires_in) merged.expiry_date = Date.now() + (incoming.expires_in * 1000);
    return merged;
};

async function authGoogleController(req, res) {
    try {
        const { state, returnTo } = req.query;
        res.redirect(getAuthUrl(state, returnTo));
    } catch (error) {
        res.status(500).json({ message: "Error generating Google Auth URL", error: error.message });
    }
}

async function googleCallbackController(req, res) {
    try {
        const { code, state } = req.query;
        if (!code) return res.status(400).json({ message: "Authorization code missing." });
        
        let currentState = state;
        let returnTo = '/dashboard';

        if (state?.includes('|')) {
            const [s, r] = state.split('|');
            currentState = s;
            returnTo = r;
        }

        const tokens = await getTokens(code);
        
        if (currentState === 'login') {
            const profile = await getUserInfo(tokens);
            const { email, name } = profile;
            
            let user = await userModel.findOne({ email });
            if (!user) {
                user = await userModel.create({
                    name,
                    email,
                    password: Math.random().toString(36).slice(-10),
                    isGoogleUser: true,
                    googleTokens: processTokens({}, tokens),
                    isOnboarded: false
                });
            } else {
                user.googleTokens = processTokens(user.googleTokens, tokens);
                await user.save();
            }
            
            const authToken = generateToken(user, "180d");
            setAuthCookie(res, authToken, 180);

            const frontendUrl = process.env.FRONTEND_URL;
            return res.redirect(`${frontendUrl}${returnTo}`);
        }

        if (currentState === 'connect') {
            const token = req.cookies.token;
            if (!token) return res.status(401).json({ message: "Session expired." });

            const decodedToken = jwt.verify(token, process.env.JWT_SECRET);
            const user = await userModel.findById(decodedToken.userId);
            
            if (user) {
                user.googleTokens = processTokens(user.googleTokens, tokens);
                await user.save();
            }

            const frontendUrl = process.env.FRONTEND_URL;
            return res.redirect(`${frontendUrl}${returnTo}`);
        }

        res.status(200).json({ success: true });
    } catch (error) {
        res.status(500).json({ message: "Error during Google callback", error: error.message });
    }
}

async function listGoogleFilesController(req, res) {
    try {
        const user = await userModel.findById(req.user.userId);
        if (!user?.googleTokens) return res.status(200).json({ success: false, data: [] });
        
        const validTokens = await getValidTokens(user);
        const files = await listGoogleFiles(validTokens);
        res.status(200).json({ success: true, data: files });
    } catch (error) {
        const isAuthError = error.message.includes('No Google Workspace connection found') || 
                          error.message.includes('Please re-authenticate');
        res.status(isAuthError ? 401 : 500).json({ success: false, message: error.message, reauthRequired: isAuthError });
    }
}

async function importGoogleDataController(req, res) {
    try {
        const { documentId, type, range } = req.body; 
        const user = await userModel.findById(req.user.userId);
        if (!user?.googleTokens) return res.status(401).json({ message: "Workspace not connected" });

        const validTokens = await getValidTokens(user);
        let text = '';
        if (type === 'sheet') {
            const rows = await readGoogleSheet(validTokens, documentId, range);
            text = rows.map(r => r.join(' | ')).join('\n');
        } else if (type === 'doc') {
            text = await readGoogleDoc(validTokens, documentId);
        } else return res.status(400).json({ message: "Invalid type" });
        
        res.status(200).json({ success: true, textLength: text.length });
    } catch (error) {
        const isAuthError = error.message.includes('No Google Workspace connection found') || 
                          error.message.includes('Please re-authenticate');
        res.status(isAuthError ? 401 : 500).json({ success: false, error: error.message, reauthRequired: isAuthError });
    }
}

module.exports = {
   authGoogleController,
   googleCallbackController,
   importGoogleDataController,
   listGoogleFilesController
};

