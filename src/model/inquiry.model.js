const mongoose = require('mongoose');

const inquirySchema = new mongoose.Schema({
    name: {
        type: String
    },
    phone: {
        type: String
    },
    email: {
        type: String
    },
    inquiry: {
        type: String
    },
    chatbotId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'chatBot'
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'user'
    }
}, { timestamps: true });

const inquiryModel = mongoose.model('inquiry', inquirySchema);

module.exports = inquiryModel;