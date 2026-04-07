// src/services/google.service.js
const { google } = require('googleapis');
const userModel = require('../model/user.model');

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

/**
 * Ensures tokens are valid for a specific user, refreshing if necessary.
 * Note: Assumes `user` is a Mongoose document.
 */
const getValidTokens = async (user) => {
    if (!user.googleTokens || !user.googleTokens.refresh_token) {
        throw new Error('No Google Workspace connection found.');
    }

    const oauth2Client = getOAuth2Client();
    oauth2Client.setCredentials(user.googleTokens);
    
    // Listen for automatic token updates
    oauth2Client.on('tokens', async (tokens) => {
        console.log(`[Google] 🔄 Automatic token update for ${user.email}`);
        const updatedTokens = {
            ...user.googleTokens,
            ...tokens
        };
        // Update user document directly to avoid race conditions
        await userModel.findByIdAndUpdate(user._id, { googleTokens: updatedTokens });
    });

    try {
        // This will automatically refresh if expired AND we have a refresh_token
        const { token } = await oauth2Client.getAccessToken();
        
        if (!token) {
            throw new Error('Refresh failed - check refresh_token status.');
        }

        return oauth2Client.credentials;
    } catch (error) {
        console.error(`[Google Session Error] for ${user.email}:`, error.message);
        
        // Critical failures: Clear tokens so user can reconnect
        if (
            error.message.includes('invalid_grant') || 
            error.message.includes('expired_token') ||
            error.message.includes('No refresh token')
        ) {
            await userModel.findByIdAndUpdate(user._id, { googleTokens: null });
            throw new Error('Google Workspace session expired. Please re-authenticate.');
        }
        
        throw error;
    }
};

const getAuthUrl = (state, returnTo) => {
    const oauth2Client = getOAuth2Client();
    const scopes = [
        'https://www.googleapis.com/auth/userinfo.profile',
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/spreadsheets.readonly',
        'https://www.googleapis.com/auth/documents.readonly',
        'https://www.googleapis.com/auth/drive.readonly'
    ];
    const combinedState = returnTo ? `${state}|${returnTo}` : state;
    
    return oauth2Client.generateAuthUrl({
        access_type: 'offline', 
        prompt: 'consent', // Explicitly ask for consent to ensure we get a refresh_token
        scope: scopes,
        state: combinedState
    });
};

const getTokens = async (code) => {
    const oauth2Client = getOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);
    return tokens;
};

const readGoogleSheet = async (tokens, spreadsheetId, range = 'A1:Z1000') => {
    const oauth2Client = getOAuth2Client();
    oauth2Client.setCredentials(tokens);
    const sheets = google.sheets({ version: 'v4', auth: oauth2Client });
    
    const response = await sheets.spreadsheets.values.get({ spreadsheetId, range });
    return response.data.values || [];
};

const readGoogleDoc = async (tokens, documentId) => {
    const oauth2Client = getOAuth2Client();
    oauth2Client.setCredentials(tokens);
    const docs = google.docs({ version: 'v1', auth: oauth2Client });
    
    const response = await docs.documents.get({ documentId });
    
    let text = '';
    const content = response.data.body.content;
    if (content) {
        content.forEach(element => {
            if (element.paragraph) {
                element.paragraph.elements.forEach(el => {
                    if (el.textRun && el.textRun.content) {
                        text += el.textRun.content;
                    }
                });
            }
        });
    }
    return text;
};

const listGoogleFiles = async (tokens) => {
    const oauth2Client = getOAuth2Client();
    oauth2Client.setCredentials(tokens);
    const drive = google.drive({ version: 'v3', auth: oauth2Client });
    
    const response = await drive.files.list({
        q: "mimeType='application/vnd.google-apps.spreadsheet' or mimeType='application/vnd.google-apps.document'",
        fields: 'files(id, name, mimeType, modifiedTime)',
        orderBy: 'modifiedTime desc',
        pageSize: 50
    });
    
    return response.data.files || [];
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
    getValidTokens,
    readGoogleSheet,
    readGoogleDoc,
    listGoogleFiles,
    getUserInfo
};
