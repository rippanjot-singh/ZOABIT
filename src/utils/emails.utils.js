/**
 * Generates an HTML template for inquiry confirmation sent to the lead.
 */
const inquiryConfirmationTemplate = (name, inquiry) => {
    return `
    <div style="font-family: 'Inter', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1e1e1e; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px;">
        <div style="text-align: center; margin-bottom: 24px;">
            <h1 style="color: #158eff; margin: 0; font-size: 28px; font-weight: 800; letter-spacing: -0.025em;">Zoabit</h1>
            <p style="color: #64748b; margin-top: 4px; font-size: 14px;">Intelligent Assistance</p>
        </div>
        
        <div style="padding: 24px; background-color: #f8fafc; border-radius: 8px;">
            <h2 style="margin-top: 0; font-size: 20px; color: #0f172a;">Thank you, ${name}!</h2>
            <p style="line-height: 1.6; color: #334155;">We've successfully received your inquiry and our team will get back to you shortly.</p>
            
            <div style="margin-top: 20px; padding: 16px; background-color: #ffffff; border-left: 4px solid #158eff; border-radius: 4px;">
                <p style="margin: 0; font-size: 12px; color: #94a3b8; text-transform: uppercase; font-weight: 700; letter-spacing: 0.05em;">Your Message</p>
                <p style="margin: 8px 0 0 0; color: #1e293b; font-style: italic;">"${inquiry}"</p>
            </div>
        </div>
        
        <div style="margin-top: 24px; text-align: center; font-size: 12px; color: #94a3b8;">
            <p>© 2026 Zoabit AI. All rights reserved.</p>
            <p>You received this because you interacted with a Zoabit agent.</p>
        </div>
    </div>
    `;
};

/**
 * Generates an HTML template for notifying the owner of a new lead.
 */
const newLeadNotificationTemplate = (ownerName, leadName, leadEmail, leadPhone, inquiry) => {
    return `
    <div style="font-family: 'Inter', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1e1e1e; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px;">
        <div style="text-align: center; margin-bottom: 24px;">
            <h1 style="color: #158eff; margin: 0; font-size: 28px; font-weight: 800;">Zoabit</h1>
            <p style="color: #64748b; margin-top: 4px; font-size: 14px;">New Lead Alert</p>
        </div>
        
        <div style="padding: 24px; background-color: #f0f9ff; border-radius: 8px; border: 1px solid #bae6fd;">
            <h2 style="margin-top: 0; font-size: 20px; color: #0369a1;">You have a new inquiry!</h2>
            <p style="color: #0c4a6e;">Hello ${ownerName}, a visitor just contacted you via your chatbot.</p>
            
            <table style="width: 100%; margin-top: 20px; border-collapse: collapse;">
                <tr>
                    <td style="padding: 8px 0; font-weight: 600; color: #64748b; width: 100px;">Name:</td>
                    <td style="padding: 8px 0; color: #0f172a;">${leadName}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; font-weight: 600; color: #64748b;">Email:</td>
                    <td style="padding: 8px 0; color: #0f172a;"><a href="mailto:${leadEmail}" style="color: #158eff; text-decoration: none;">${leadEmail}</a></td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; font-weight: 600; color: #64748b;">Phone:</td>
                    <td style="padding: 8px 0; color: #0f172a;">${leadPhone}</td>
                </tr>
            </table>
            
            <div style="margin-top: 20px; padding: 16px; background-color: #ffffff; border-radius: 6px; border: 1px solid #e2e8f0;">
                <p style="margin: 0; font-size: 11px; color: #94a3b8; text-transform: uppercase;">Inquiry Details</p>
                <p style="margin: 8px 0 0 0; line-height: 1.5; color: #1e293b;">${inquiry}</p>
            </div>
            
            <div style="margin-top: 24px; text-align: center;">
                <a href="https://zoabit.online/dashboard/inquiries" style="display: inline-block; padding: 12px 24px; background-color: #158eff; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600;">View in Dashboard</a>
            </div>
        </div>
    </div>
    `;
};

module.exports = {
    inquiryConfirmationTemplate,
    newLeadNotificationTemplate
};
