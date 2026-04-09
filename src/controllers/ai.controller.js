const { vectorDB } = require("../config/db");
const chatBotModel = require("../model/chatBot.model");
const { getChatModel } = require("../services/ai.service");
const { scrape } = require("../utils/scrape.utils");
const multer = require("multer");
const { PDFParse } = require("pdf-parse");

const prompt = `You are an expert AI prompt engineer.

Your task is to generate a high-quality SYSTEM PROMPT for a customer-facing AI chatbot using the provided business information.

The chatbot will be used on a website to answer customer questions, guide users, and convert visitors into customers.

Your system prompt must:

1. Clearly define chatbot role and purpose
2. Use provided business information as knowledge base
3. Define tone and personality
4. Define how chatbot should handle unknown questions
5. Define behavior rules
6. Define response style
7. Keep responses helpful, concise, and conversion-focused

Important Instructions:

- The chatbot represents the business
- The chatbot should never hallucinate information
- If information is missing, chatbot should say it does not know and suggest contacting support
- Chatbot should prioritize helpfulness and conversions
- Chatbot should answer only based on provided information
- Chatbot should be friendly, professional, and clear

Structure the system prompt in this format:

1. Role Definition
2. Business Overview
3. Products & Services
4. Target Audience
5. Tone & Personality
6. Behavior Rules
7. Conversion Guidelines
8. Support Handling
9. Unknown Question Handling
10. Response Style Rules
11. Short and concise responses

Return ONLY the final system prompt.
Do not explain anything.
Do not include commentary.
Only output the system prompt.

Now use the following business information to generate the system prompt, the following information is scrapped data of the website in very raw format: 
`;

async function makePromptwithWebsiteData(req, res) {
    try {
        const data = await scrape(req.body.url);
        if(data.length === 0){
            return res.status(400).json({
                success: false,
                message: "No data found",
                data: []
            });
        }
        console.log("Scraped data: " + data);
        console.log(JSON.stringify(data, null, 2));
        
        const chatBot = await chatBotModel.findById(req.params.chatbotId);
        if(!chatBot) return res.status(404).json({ success: false, message: "Chatbot not found" });

        const { model } = getChatModel({ provider: 'mistral-ai' });
        const promptwithdata = prompt + "\n\n" + JSON.stringify(data, null, 2);

        const result = await model.invoke(promptwithdata);
        console.log(result.content);
        console.log('PROMPT RECEIVED');

        const updatedChatBot = await chatBotModel.findByIdAndUpdate(req.params.chatbotId, {
            prompt: result.content
        }, { new: true });

        console.log('UPDATING CHATBOT');
        console.log(updatedChatBot);
        console.log('UPDATED CHATBOT');

        const index = await vectorDB();
        await index.deleteMany({
            filter: {
                url: req.body.url
            }
        })
        // console.log(result.content);

        res.status(200).json({ result: result.content, promptwithdata, updatedChatBot, fullResponse: result });
    } catch (error) {
        console.error("Error in makePrompt:", error);
        res.status(500).json({ error: "Failed to get response from AI", error });
    }
}

async function makePromptwithPDFData(req, res) {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: "No file uploaded"
            });
        }
        const dataBuffer = req.file.buffer;

        const parser = new PDFParse(new Uint8Array(dataBuffer));
        const data = await parser.getText();

        console.log(data.text);
        
        const chatBot = await chatBotModel.findById(req.params.id);
        if(!chatBot) return res.status(404).json({ success: false, message: "Chatbot not found" });

        const { model } = getChatModel({ provider: 'mistral-ai' });
        const promptwithdata = prompt + "\n\n" + JSON.stringify(data.text, null, 2);
        
        const result = await model.invoke(promptwithdata);

        const updatedChatBot = await chatBotModel.findByIdAndUpdate(req.params.id, {
            prompt: result.content
        }, { new: true });

        res.status(200).json({
            success: true,
            message: "PDF uploaded successfully",
            data: data.text,
            prompt: result.content,
            promptwithdata,
            updatedChatBot,
            fullResponse: result
        })
    } catch (error) {
        console.error("Error uploading PDF:", error);
        res.status(500).json({
            success: false,
            message: "Failed to upload PDF",
            error: error.message
        });
    }
}

module.exports = { makePromptwithWebsiteData, makePromptwithPDFData };