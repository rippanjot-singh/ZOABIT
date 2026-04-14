const { getAuthUrl, getTokens, getUserInfo } = require('../services/google.service');
const userModel = require("../model/user.model");
const { generateToken, setAuthCookie } = require('../utils/auth.utils');

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
                    isOnboarded: false
                });
            }
            
            const authToken = generateToken(user, "180d");
            setAuthCookie(res, authToken, 180);

            const frontendUrl = process.env.FRONTEND_URL;
            return res.redirect(`${frontendUrl}${returnTo}`);
        }

        res.status(200).json({ success: true });
    } catch (error) {
        res.status(500).json({ message: "Error during Google callback", error: error.message });
    }
}

module.exports = {
   authGoogleController,
   googleCallbackController
};

