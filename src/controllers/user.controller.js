const user = require('../model/user.model');
const chatBotModel = require('../model/chatbot.model');
const inquiryModel = require('../model/inquiry.model');

async function isOnboarded(req, res) {
    try {
        const { id } = req.params;
        const updatedUser = await user.findByIdAndUpdate(id, { isOnboarded: true }, { new: true });
        res.status(200).json({ message: "User onBoarded successfully", user: updatedUser });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}

async function getDashboardData(req, res) {
    try {
        const { userId } = req.user;
        const foundUser = await user.findById(userId)
        const chatbots = await chatBotModel.find({ userId: userId });
        const totalChatbots = chatbots.length;
        const totalInquiries = await inquiryModel.countDocuments({ chatbotId: { $in: chatbots.map(chatbot => chatbot._id) } });
        const totalChats = chatbots.reduce((acc, chatbot) => acc + (chatbot.messageCount || 0), 0);
        res.status(200).json({ message: "User data fetched successfully", user: foundUser, chatbots, totalChatbots, totalInquiries, totalChats });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}

module.exports = {
    isOnboarded,
    getDashboardData
}