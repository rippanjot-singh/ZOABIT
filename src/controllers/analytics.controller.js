const chatBotModel = require("../model/chatBot.model");
const userModel = require("../model/user.model");
const inquiryModel = require("../model/inquiry.model");
const interactionModel = require("../model/interaction.model");

const getGlobalAnalytics = async (req, res) => {
    try {
        const userId = req.user.userId;
        const bots = await chatBotModel.find({ userId });
        
        // Count total inquiries for this user
        const totalInquiries = await inquiryModel.countDocuments({ userId });

        // Get all interactions for advanced metrics
        const interactions = await interactionModel.find({ userId });
        
        // Advanced Metrics Aggregation
        let totalResponseTime = 0;
        let resolvedCount = 0;
        let sentimentStats = { positive: 0, neutral: 0, negative: 0 };
        let topicStats = {};

        interactions.forEach(inter => {
            totalResponseTime += (inter.responseTime || 0);
            if (inter.isResolved) resolvedCount++;
            if (sentimentStats[inter.sentiment] !== undefined) sentimentStats[inter.sentiment]++;
            
            topicStats[inter.topic] = (topicStats[inter.topic] || 0) + 1;
        });

        const avgResponseTime = interactions.length > 0 ? (totalResponseTime / interactions.length / 1000).toFixed(2) : 0;
        const resolutionRate = interactions.length > 0 ? ((resolvedCount / interactions.length) * 100).toFixed(1) : 0;

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
                managedBots: managed.length,
                // New Advanced Data
                avgResponseTime,
                resolutionRate,
                sentimentStats,
                topicStats,
                totalInteractions: interactions.length
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = { getGlobalAnalytics };
