const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    password: {
        type: String,
        required: true,
        trim: true
    },
    chatbotLimit: {
        type: Number,
        default: 1
    },
    messageLimit: {
        type: Number,
        default: 100
    },
    messageCount: {
        type: Number,
        default: 0
    },
    lastResetDate: {
        type: Date,
        default: Date.now
    },
    subscription: {
        type: String,
        enum: ['free', 'starter', 'pro', 'enterprise'],
        default: 'free'
    },
    subscriptionId: {
        type: String,
        default: ''
    },
    isGoogleUser: {
        type: Boolean,
        default: false
    },
    googleTokens: {
        access_token: String,
        refresh_token: String,
        expiry_date: Number,
        scope: String,
        token_type: String
    },
    isOnboarded: {
        type: Boolean,
        default: false
    }
}, { timestamps: true });

userSchema.pre('save', async function () {
    if (!this.isModified('password')) {
        return;
    }
    const hash = await bcrypt.hash(this.password, 10);
    this.password = hash;

    return;
})

userSchema.methods.comparePassword = async function (password) {
    return await bcrypt.compare(password, this.password);
}

const userModel = mongoose.model('user', userSchema);

module.exports = userModel;