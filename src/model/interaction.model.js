const mongoose = require('mongoose');

const interactionSchema = new mongoose.Schema({
    chatbotId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'chatBot',
        required: true,
        index: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'user',
        required: true,
        index: true
    },
    question: {
        type: String,
        required: true
    },
    response: {
        type: String,
        required: true
    },
    sentiment: {
        type: String,
        enum: ['positive', 'negative', 'neutral', 'unknown'],
        default: 'unknown'
    },
    topic: {
        type: String,
        default: 'General inquiry'
    },
    responseTime: {
        type: Number // in ms
    },
    isResolved: {
        type: Boolean,
        default: true
    }
}, { timestamps: true });

const interactionModel = mongoose.model('interaction', interactionSchema);

module.exports = interactionModel;
