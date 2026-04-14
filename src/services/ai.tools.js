const { tool } = require("@langchain/core/tools");
const { z } = require("zod");
const inquiryModel = require("../model/inquiry.model");
const { readGoogleSheet, readGoogleDoc, getValidTokens } = require("./google.service");
const { readNotionPage, readNotionDatabase } = require("./notion.service");
const userModel = require("../model/user.model");
const sendMail = require("./email.service");
const { inquiryConfirmationTemplate, newLeadNotificationTemplate } = require("../utils/emails.utils");

/**
 * Lead Generation Tool: Saves customer info to DB.
 * Always available to every chatbot.
 */
const createInquiryTool = tool(
    async ({ name, phone, email, inquiry, chatbotId, userId }) => {
        try {
            await inquiryModel.create({ name, phone, email, inquiry, chatbotId, userId });
            
            const owner = await userModel.findById(userId);
            if (owner) {
                const ownerHtml = newLeadNotificationTemplate(owner.name, name, email || "N/A", phone, inquiry);
                sendMail(owner.email, "New Lead Captured!", "", ownerHtml);
            }

            return `Inquiry recorded successfully for ${name}. An agent will be in touch.`;
        } catch (error) {
            console.error("[Inquiry Tool Error]:", error);
            return `Failed to save inquiry: ${error.message}`;
        }
    },
    {
        name: "createInquiry",
        description: "Registers a lead by saving the user's contact information (name and phone required, email optional). Always call this once the user provides their contact details.",
        schema: z.object({
            name: z.string().describe("User's full name"),
            phone: z.string().describe("User's phone number"),
            email: z.string().optional().describe("User's email"),
            inquiry: z.string().describe("Brief summary of what the user wants"),
            chatbotId: z.string().describe("The current chatbot ID"),
            userId: z.string().describe("The owner's user ID")
        })
    }
);

/**
 * Builds a dynamic data-reading tool for a specific file.
 * Each tool execution will fetch the freshest tokens to avoid expiration.
 */
function buildIntegrationTool(integration, ownerId) {
    const isSheet = integration.provider === 'google_sheets';
    const isNotion = integration.provider === 'notion';
    
    // Improved tool name: alphanumerics allowed, prefixed by provider
    const cleanId = integration.fileId.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
    const toolName = `read_${integration.provider.split('_')[0]}_${cleanId}`.slice(0, 64);

    return tool(
        async () => {
            try {
                const user = await userModel.findById(ownerId);
                if (!user) return "System Error: Chatbot owner not found.";

                if (isNotion) {
                    const notionToken = user?.notionTokens?.access_token || process.env.NOTION_API_KEY;
                    if (!notionToken) return `Access Error: Notion not connected for "${integration.name}".`;

                    const result = integration.type === 'database' 
                        ? await readNotionDatabase(notionToken, integration.fileId)
                        : await readNotionPage(notionToken, integration.fileId);
                    
                    return `Live content from Notion "${integration.name}":\n\n${result}`;
                } 
                
                // Google specific flow (Spreadsheets/Docs)
                const tokens = await getValidTokens(user);
                if (isSheet) {
                    const rows = await readGoogleSheet(tokens, integration.fileId);
                    if (!rows || rows.length === 0) return `Resource "${integration.name}" exists but is empty.`;
                    
                    const headers = rows[0] || [];
                    const dataRows = rows.slice(1);
                    
                    if (dataRows.length === 0) {
                        return `Resource "${integration.name}" has headers (${headers.join(', ')}) but no data entries yet.`;
                    }
                    
                    return `Live data from Google Sheet "${integration.name}":\n` + 
                           dataRows.map(row => headers.map((h, i) => `${h}: ${row[i] || 'N/A'}`).join(' | ')).join('\n');
                } else {
                    const text = await readGoogleDoc(tokens, integration.fileId);
                    return `Content from Google Doc "${integration.name}":\n\n${text}`;
                }
            } catch (err) {
                console.error(`[Integration Tool Error - ${integration.name}]:`, err.message);
                return `Access Error: Unable to read "${integration.name}" at this time.`;
            }
        },
        {
            name: toolName,
            description: `MANDATORY: Call this tool if the user asks about: ${integration.description}. Resource name: "${integration.name}".`,
            schema: z.object({})
        }
    );
}

/**
 * Factory for per-request dynamic tools.
 */
async function buildIntegrationTools(integrations, userId) {
    if (!integrations || integrations.length === 0) return [];
    return integrations.map(intg => buildIntegrationTool(intg, userId));
}

module.exports = { createInquiryTool, buildIntegrationTools };
