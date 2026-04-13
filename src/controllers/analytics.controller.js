const chatBotModel = require("../model/chatBot.model");
const userModel = require("../model/user.model");
const inquiryModel = require("../model/inquiry.model");

const getGlobalAnalytics = async (req, res) => {
    try {
        const userId = req.user.userId;
        const bots = await chatBotModel.find({ userId });
        
        // Count total inquiries for this user
        const totalInquiries = await inquiryModel.countDocuments({ userId });

        // Aggregate totals
        let totalMessages = 0;
        let botStats = [];
        let combinedChartData = {};

        bots.forEach(bot => {
            totalMessages += (bot.totalMessages || 0);

            // Per bot breakdown
            botStats.push({
                _id: bot._id,
                name: bot.name,
                total: bot.totalMessages || 0
            });

            // Aggregate for multi-line charts
            (bot.analytics || []).forEach(day => {
                if (!combinedChartData[day.date]) {
                    combinedChartData[day.date] = { date: day.date, total: 0 };
                }
                // Store by both ID and Name (for tooltips/keys)
                combinedChartData[day.date][bot._id] = day.messages;
                combinedChartData[day.date][bot.name] = day.messages; 
                combinedChartData[day.date].total += day.messages;
            });
        });
        const managed = bots.filter(bot => !bot.isBYOK);

        // Convert chart data to sorted array
        const timeSeries = Object.values(combinedChartData)
            .sort((a, b) => new Date(a.date) - new Date(b.date));

        res.json({
            success: true,
            data: {
                totalMessages,
                totalChatbots: bots.length,
                totalInquiries,
                botStats,
                timeSeries,
                managedBots: managed.length
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = { getGlobalAnalytics };
