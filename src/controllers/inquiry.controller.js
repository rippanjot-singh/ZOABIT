const inquiryModel = require("../model/inquiry.model");
const userModel = require("../model/user.model");
const sendMail = require("../services/email.service");
const { newLeadNotificationTemplate } = require("../utils/emails.utils");

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

const createInquiryFromWidget = async (req, res) => {
    try {
        const { name, phone, email, inquiry, chatbotId, userId } = req.body;
        
        const newInquiry = await inquiryModel.create({ name, phone, email, inquiry, chatbotId, userId });
        
        // Notify Owner
        const owner = await userModel.findById(userId);
        if (owner) {
            const ownerHtml = newLeadNotificationTemplate(owner.name, name, email || "N/A", phone, inquiry);
            sendMail(owner.email, "New Lead Captured!", "", ownerHtml);
        }

        res.status(201).json({ success: true, data: newInquiry });
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
    createInquiryFromWidget,
    deleteInquiryController
};
