const { tool } = require("@langchain/core/tools");
const { z } = require("zod");
const inquiryModel = require("../model/inquiry.model");
const { readGoogleSheet, readGoogleDoc, getValidTokens } = require("./google.service");
const userModel = require("../model/user.model");

/**
 * Lead Generation Tool: Saves customer info to DB.
 * Always available to every chatbot.
 */
const createInquiryTool = tool(
    async ({ name, phone, email, inquiry, chatbotId, userId }) => {
        try {
            await inquiryModel.create({ name, phone, email, inquiry, chatbotId, userId });
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
    const toolName = `read_${integration.fileId.replace(/[^a-zA-Z]/g, '_').toLowerCase()}`;

    return tool(
        async () => {
            try {
                // Fetch the latest user record to ensure we have fresh tokens
                const user = await userModel.findById(ownerId);
                if (!user) return "System Error: Chatbot owner not found.";

                // Get valid (auto-refreshed) tokens
                const tokens = await getValidTokens(user);

                if (isSheet) {
                    const rows = await readGoogleSheet(tokens, integration.fileId);
                    if (!rows || rows.length === 0) return `Resource "${integration.name}" exists but is empty.`;
                    
                    const headers = rows[0] || [];
                    const dataRows = rows.slice(1);
                    
                    if (dataRows.length === 0) {
                        return `Resource "${integration.name}" has headers (${headers.join(', ')}) but no data entries yet.`;
                    }
                    
                    // Format into a readable string for the LLM
                    return `Live data from "${integration.name}":\n` + 
                           dataRows.map(row => headers.map((h, i) => `${h}: ${row[i] || 'N/A'}`).join(' | ')).join('\n');
                } else {
                    const text = await readGoogleDoc(tokens, integration.fileId);
                    return `Content from file "${integration.name}":\n\n${text}`;
                }
            } catch (err) {
                console.error(`[Integration Tool Error - ${integration.name}]:`, err.message);
                return `Access Error: Unable to read "${integration.name}" at this time. User might need to re-authenticate.`;
            }
        },
        {
            name: toolName,
            description: `Reads live data from "${integration.name}". Use this for: ${integration.description}`,
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
