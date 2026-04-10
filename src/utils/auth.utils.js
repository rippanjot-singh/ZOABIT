const jwt = require('jsonwebtoken');

/**
 * Generates a JWT token for a user.
 * @param {Object} user - User object containing _id and email.
 * @param {string} expiresIn - Optional expiration time (default: '3d').
 * @returns {string} - Signed JWT token.
 */
const generateToken = (user, expiresIn = '3d') => {
    return jwt.sign(
        { userId: user._id, email: user.email },
        process.env.JWT_SECRET,
        { expiresIn }
    );
};

/**
 * Sets a secure authentication cookie on the response.
 * @param {Object} res - Express response object.
 * @param {string} token - JWT token.
 * @param {number} days - Number of days until expiry (default: 3).
 */
const setAuthCookie = (res, token, days = 3) => {
    res.cookie("token", token, {
        httpOnly: true,
        secure: process.env.COOKIE_SECURE === "true",
        sameSite: "lax",
        path: "/",
        maxAge: days * 24 * 60 * 60 * 1000
    });
};

module.exports = {
    generateToken,
    setAuthCookie
};
