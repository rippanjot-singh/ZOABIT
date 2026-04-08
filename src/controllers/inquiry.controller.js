const inquiryModel = require("../model/inquiry.model");
const chatBotModel = require("../model/chatBot.model");

const getInquiriesController = async (req, res) => {
    try {
        const inquiries = await inquiryModel.find({ userId: req.user.userId })
            .populate('chatbotId', 'name')
            .sort({ createdAt: -1 });
        
        res.status(200).json({ success: true, data: inquiries });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const deleteInquiryController = async (req, res) => {
    try {
        await inquiryModel.findOneAndDelete({ _id: req.params.id, userId: req.user.userId });
        res.status(200).json({ success: true, message: "Lead deleted successfully" });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    getInquiriesController,
    deleteInquiryController
};
