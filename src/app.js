const express = require('express');
const cors = require('cors');
const path = require('path');
const app = express();
const plansRoutes = require('./routes/plans.routes');
const subscriptionRoutes = require('./routes/subscription.routes');
const webhookRoutes = require('./routes/webhook.routes');
const authRoutes = require('./routes/auth.routes');
const aiRoutes = require('./routes/ai.routes');
const chatBotRoutes = require('./routes/chatBot.routes');
const googleRoutes = require('./routes/google.routes');
const cookieParser = require('cookie-parser');
const onBoardRoutes = require('./routes/onBoard.routes');
const userRoutes = require('./routes/user.routes');
const analyticsRoutes = require('./routes/analytics.routes');
const inquiryRoutes = require('./routes/inquiry.routes');
const paymentRoutes = require('./routes/payment.routes');
const couponRoutes = require('./routes/coupon.routes');

app.use(cors({
    origin: function (origin, callback) {
        if (!origin) return callback(null, true);
        return callback(null, origin);
    },
    credentials: true,
}));

// Route for webhooks FIRST (must pre-date express.json for raw body access)
app.use('/api/webhook', webhookRoutes);

app.use(express.json());
app.use(cookieParser());

app.use(express.static(path.join(__dirname, "..", "public")));
app.use("/widget", express.static(path.join(__dirname, "..", "widget")));

app.use('/api/auth', authRoutes);
app.use('/api/plans', plansRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/chatbot', chatBotRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/google', googleRoutes);
app.use('/api/onboard', onBoardRoutes);
app.use('/api/user', userRoutes);
app.use('/api/inquiry', inquiryRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/coupons', couponRoutes);

app.get("*name", (req, res) => {
    res.sendFile(path.join(__dirname, "..", "public", "index.html"));
});

module.exports = app;