// src/services/google.service.js
const { google } = require('googleapis');

/**
 * Creates a configured OAuth2 client.
 */
const getOAuth2Client = () => {
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:5000/api/google/callback';
    return new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        redirectUri
    );
};

const getAuthUrl = (state, returnTo) => {
    const oauth2Client = getOAuth2Client();
    const scopes = [
        'https://www.googleapis.com/auth/userinfo.profile',
        'https://www.googleapis.com/auth/userinfo.email'
    ];
    const combinedState = returnTo ? `${state}|${returnTo}` : state;
    
    return oauth2Client.generateAuthUrl({
        access_type: 'online', 
        scope: scopes,
        state: combinedState
    });
};

const getTokens = async (code) => {
    const oauth2Client = getOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);
    return tokens;
};

const getUserInfo = async (tokens) => {
    const oauth2Client = getOAuth2Client();
    oauth2Client.setCredentials(tokens);
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const response = await oauth2.userinfo.get();
    return response.data;
};

module.exports = {
    getOAuth2Client,
    getAuthUrl,
    getTokens,
    getUserInfo
};
