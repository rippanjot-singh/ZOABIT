const mongoose = require('mongoose');

const chatBotSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'user',
        required: true
    },
    name: {
        type: String,
        required: true
    },
    description: {
        type: String,
    },
    prompt: {
        type: String,
        default: ''
    },
    model: {
        type: String,
        default: 'open-mistral-nemo'
    },
    style: {
        brandColor: {
            primary: {
                type: String,
                default: '#158effff'
            },
            secondary: {
                type: String,
                default: '#003ba8ff'
            },
            accent: {
                type: String,
                default: '#53d7ffff'
            }
        },
        textColor: {
            type: String,
            default: '#000000'
        },
        bgColor: {
            type: String,
            default: '#ffffff'
        },
        corner: {
            type: String,
            enum: ['rounded', 'square'],
            default: 'rounded'
        },
        icon: {
            type: String,
            enum: ['rounded', 'square'],
            default: 'rounded'
        },
        replyStyle: {
            textColor: {
                type: String,
                default: '#1e1e1e'
            },
            bgColor: {
                type: String,
                default: 'transparent'
            },
            replyType: {
                type: String,
                enum: ['bubble', 'text'],
                default: 'bubble'
            }
        },
        senderStyle: {
            textColor: {
                type: String,
                default: '#ffffff'
            },
            bgColor: {
                type: String,
                default: '#158effff'
            },
            senderType: {
                type: String,
                enum: ['bubble', 'text'],
                default: 'bubble'
            }
        }
    },
    greeting: {
        type: String,
        default: 'Hello! How can I help you today?'
    },
    faq: {
        type: Array,
        default: []
    },
    position: {
        type: String,
        enum: ['bottom-right', 'bottom-left'],
        default: 'bottom-right'
    },
    isBYOK: {
        type: Boolean,
        default: false
    },
    scrappedData: {
        type: String,
        default: ''
    },
    verifiedDomains: {
        type: [String],
        default: [],
        validate: {
            validator: function (domains) {
                return domains.length <= 2;
            },
            message: "You can only add up to 2 domains"
        }
    },
    integrations: [{
        provider: { type: String }, // e.g., 'google_sheets'
        fileId: { type: String },
        name: { type: String },
        description: { type: String }
    }],
    totalMessages: {
        type: Number,
        default: 0
    },
    analytics: [{
        date: { type: String }, // Format: YYYY-MM-DD
        messages: { type: Number, default: 0 }
    }]
}, { timestamps: true });

const chatBotModel = mongoose.models.chatBot || mongoose.model('chatBot', chatBotSchema);

module.exports = chatBotModel;