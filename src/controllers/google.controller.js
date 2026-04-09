const { getAuthUrl, getTokens, getValidTokens, readGoogleSheet, readGoogleDoc, listGoogleFiles, getUserInfo } = require('../services/google.service');
const userModel = require("../model/user.model");
const jwt = require('jsonwebtoken');

// Step 1: Redirect user to Google Auth
async function authGoogleController(req, res) {
    try {
        const { state, returnTo } = req.query;
        const url = getAuthUrl(state, returnTo);
        res.redirect(url);
    } catch (error) {
        console.error("[Google Auth Error]:", error);
        res.status(500).json({ message: "Error generating Google Auth URL", error: error.message });
    }
}

// Step 2: Google Callback (handles login and workspace connect)
async function googleCallbackController(req, res) {
    try {
        const { code, state } = req.query;
        if (!code) {
            return res.status(400).json({ message: "Authorization code missing." });
        }
        
        let currentState = state;
        let returnTo = '/dashboard';

        // Decode return target if provided in state
        if (state && state.includes('|')) {
            const [s, r] = state.split('|');
            currentState = s;
            returnTo = r;
        }

        const tokens = await getTokens(code);
        
        // --- CASE 1: USER LOGIN FLOW ---
        if (currentState === 'login') {
            const profile = await getUserInfo(tokens);
            const { email, name } = profile;
            
            let user = await userModel.findOne({ email });
            
            const processTokens = (existing, incoming) => {
                const merged = { ...existing, ...incoming };
                if (!incoming.refresh_token && existing?.refresh_token) {
                    merged.refresh_token = existing.refresh_token;
                }
                if (!merged.expiry_date && incoming.expires_in) {
                    merged.expiry_date = Date.now() + (incoming.expires_in * 1000);
                }
                return merged;
            };

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
            
            const authToken = jwt.sign({ userId: user._id, email: user.email }, process.env.JWT_SECRET, {
                expiresIn: "180d"
            });
            
            res.cookie("token", authToken, {
                httpOnly: true,
                secure: process.env.COOKIE_SECURE === "true",
                sameSite: "lax",
                path: "/",
                maxAge: 180 * 24 * 60 * 60 * 1000 // 180 days
            });

            const frontendUrl = process.env.FRONTEND_URL;
            if (!frontendUrl) throw new Error('FRONTEND_URL env variable is not set');
            return res.redirect(`${frontendUrl}${returnTo}`);
        }

        // --- CASE 2: WORKSPACE CONNECT FLOW ---
        if (currentState === 'connect') {
            const token = req.cookies.token;
            if (!token) {
                console.warn("[Google Connect]: No session token found in cookies.");
                return res.status(401).json({ message: "Session expired. Please log in again." });
            }

            const decodedToken = jwt.verify(token, process.env.JWT_SECRET);
            const user = await userModel.findById(decodedToken.userId);
            
            if (user) {
                const processTokens = (existing, incoming) => {
                    const merged = { ...existing, ...incoming };
                    if (!incoming.refresh_token && existing?.refresh_token) {
                        merged.refresh_token = existing.refresh_token;
                    }
                    if (!merged.expiry_date && incoming.expires_in) {
                        merged.expiry_date = Date.now() + (incoming.expires_in * 1000);
                    }
                    return merged;
                };
                user.googleTokens = processTokens(user.googleTokens, tokens);
                await user.save();
                console.log(`[Google Connect]: Workspace successfully connected for ${user.email}`);
            }

            const frontendUrl = process.env.FRONTEND_URL;
            if (!frontendUrl) throw new Error('FRONTEND_URL env variable is not set');
            return res.redirect(`${frontendUrl}${returnTo}`);
        }

        // Default fallback (rare)
        res.status(200).json({ success: true, message: "Authenticated successfully" });
    } catch (error) {
        console.error("[Google Callback Error]:", error);
        res.status(500).json({ message: "Error during Google callback processing", error: error.message });
    }
}

// Step 3: Fetch user's Google files (populated Workspace picker)
async function listGoogleFilesController(req, res) {
    try {
        const user = await userModel.findById(req.user.userId);
        if (!user || !user.googleTokens) {
            return res.status(200).json({ success: false, message: "Google Workspace not connected", data: [] });
        }
        
        // Refresh tokens if needed automatically
        const validTokens = await getValidTokens(user);
        const files = await listGoogleFiles(validTokens);
        
        res.status(200).json({ success: true, data: files });
    } catch (error) {
        console.error("[Google File List Error]:", error);
        
        // Use 401 for unauthorized/expired connection errors
        const isAuthError = error.message.includes('No Google Workspace connection found') || 
                          error.message.includes('Please re-authenticate');
                          
        res.status(isAuthError ? 401 : 500).json({ 
            success: false, 
            message: error.message || "Failed to fetch Google Workspace files",
            reauthRequired: isAuthError
        });
    }
}

// Optional: Legacy data import/ingestion flow
async function importGoogleDataController(req, res) {
    try {
        const { documentId, type, range, chatbotUrl } = req.body; 
        const user = await userModel.findById(req.user.userId);
        
        if (!user || !user.googleTokens) {
            return res.status(401).json({ message: "Workspace not connected" });
        }

        const validTokens = await getValidTokens(user);
        let extractedText = '';
        
        if (type === 'sheet') {
            const rows = await readGoogleSheet(validTokens, documentId, range);
            extractedText = rows.map(row => row.join(' | ')).join('\n');
        } else if (type === 'doc') {
            extractedText = await readGoogleDoc(validTokens, documentId);
        } else {
            return res.status(400).json({ message: "Invalid document type" });
        }
        
        res.status(200).json({ 
            success: true,
            message: "Data successfully extracted", 
            textLength: extractedText.length 
        });
    } catch (error) {
        console.error("[Google Data Import Error]:", error);
        const isAuthError = error.message.includes('No Google Workspace connection found') || 
                          error.message.includes('Please re-authenticate');
                          
        res.status(isAuthError ? 401 : 500).json({ 
            success: false, 
            message: "Failed to import Google data", 
            error: error.message,
            reauthRequired: isAuthError
        });
    }
}

module.exports = {
   authGoogleController,
   googleCallbackController,
   importGoogleDataController,
   listGoogleFilesController
};
