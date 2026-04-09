const userModel = require("../model/user.model")
const jwt = require('jsonwebtoken');
const { getAuthUrl, getTokens, getUserInfo } = require('../services/google.service');

//-------------- REGISTER USER --------------//
async function userRegisterController(req, res) {
    try {
        const { name, email, password } = req.body;

        const isUserExists = await userModel.findOne({
            email: email
        })

        if (isUserExists) {
            return res.status(422).json({ message: "User already exists", status: 'failed' })
        }

        const user = await userModel.create({
            name,
            email,
            password,
        });

        const token = jwt.sign({ userId: user._id, email: user.email }, process.env.JWT_SECRET, {
            expiresIn: "3d"
        })
        res.cookie("token", token, {
            httpOnly: true,
            secure: process.env.COOKIE_SECURE === "true",
            sameSite: "lax",
            path: "/",
            maxAge: 3 * 24 * 60 * 60 * 1000 // 3 days
        });


        return res.status(201).json({ message: "User created successfully", status: 'success', user, isNewUser: true })
    } catch (error) {
        process.stdout.write("SIGNUP ERROR: " + error.stack + "\n");
        return res.status(500).json({ message: "Internal server error", status: 'failed', error: error.message })
    }
}

//-------------- LOGIN USER --------------//
async function userLoginController(req, res) {
    try {
        const { email, password } = req.body;
        const user = await userModel.findOne({
            email: email
        }).select("+password");
        if (!user) {
            return res.status(404).json({ message: "User not found", status: 'failed', user })
        }
        const isPasswordValid = await user.comparePassword(password);
        if (!isPasswordValid) {
            return res.status(401).json({ message: "Invalid password", status: 'failed' })
        }
        const token = jwt.sign({ userId: user._id, email: user.email }, process.env.JWT_SECRET, {
            expiresIn: "3d"
        })
        res.cookie("token", token, {
            httpOnly: true,
            secure: process.env.COOKIE_SECURE === "true",
            sameSite: "lax",
            path: "/",
            maxAge: 3 * 24 * 60 * 60 * 1000 // 3 days
        });

        return res.status(200).json({ message: "User logged in successfully", status: 'success', user, token: token })
    } catch (error) {
        return res.status(500).json({ message: "Internal server error", status: 'failed', error: error.message })
    }
}

//-------------- LOGOUT USER --------------//
async function userLogoutController(req, res) {
    try {
        res.clearCookie("token")
        return res.status(200).json({ message: "User logged out successfully", status: 'success' })
    } catch (error) {
        return res.status(500).json({ message: "Internal server error", status: 'failed', error: error.message })
    }
}

async function me(req, res) {
    try {
        const user = await userModel.findById(req.user.userId).select("-password")
        if (!user) {
            return res.status(404).json({ message: "User not found", status: 'failed' })
        }
        return res.status(200).json({ message: "User verified successfully", status: 'success', user })
    } catch (error) {
        return res.status(500).json({ message: "Internal server error", status: 'failed', error: error.message })
    }
}

async function googleLoginController(req, res) {
    try {
        const url = getAuthUrl();
        res.status(200).json({ url });
    } catch (error) {
        res.status(500).json({ message: "Error generating Google Auth URL", error: error.message });
    }
}

async function googleCallbackLoginController(req, res) {
    try {
        const { code } = req.query;
        if (!code) {
            return res.status(400).json({ message: "Authorization code missing." });
        }
        
        const tokens = await getTokens(code);
        const profile = await getUserInfo(tokens);
        
        const email = profile.email;
        const name = profile.name;
        
        let user = await userModel.findOne({ email });
        
        if (!user) {
            user = await userModel.create({
                name,
                email,
                password: Math.random().toString(36).slice(-10), // Random password for Google users
                isGoogleUser: true
            });
        }
        
        const token = jwt.sign({ userId: user._id, email: user.email }, process.env.JWT_SECRET, {
            expiresIn: "3d"
        });
        
        res.cookie("token", token, {
            httpOnly: true,
            secure: process.env.COOKIE_SECURE === "true",
            sameSite: "lax",
            path: "/",
            maxAge: 3 * 24 * 60 * 60 * 1000 // 3 days
        });

        const frontendUrl = process.env.FRONTEND_URL;
        if (!frontendUrl) throw new Error('FRONTEND_URL env variable is not set');
        const redirectUrl = user.isOnboarded ? `${frontendUrl}/dashboard` : `${frontendUrl}/onboarding`;
        res.redirect(redirectUrl);
    } catch (error) {
         res.status(500).json({ message: "Error during Google login callback", error: error.message });
    }
}

module.exports = {
    userRegisterController,
    userLoginController,
    userLogoutController,
    me,
    googleLoginController,
    googleCallbackLoginController
}
