const { RecursiveCharacterTextSplitter } = require("@langchain/textsplitters");
const { MistralAIEmbeddings } = require("@langchain/mistralai");
const fs = require("fs");
const crypto = require("crypto");
const { vectorDB } = require("../config/db");




const embeddings = new MistralAIEmbeddings({
    model: "mistral-embed",
    apiKey: process.env.MISTRAL_API_KEY,
});


async function rag(allData, url) {
    const index = await vectorDB();
    console.log('rag started');
    console.log(url);
    console.log('running');

    const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: 1000,
        chunkOverlap: 0,
    });

    const chunks = await splitter.splitText(allData);

    const docs = await Promise.all(chunks.map(async (chunk) => {
        const embedding = await embeddings.embedQuery(chunk);
        return {
            text: chunk,
            embedding,
        }
    }))

    // console.log(docs);
    let i = 0;
    if (docs.length > 0) {
        await index.upsert({
            records: docs.map((doc, j) => ({
                id: "doc_" + crypto.randomBytes(4).toString('hex') + "_" + j,
                values: doc.embedding,
                metadata: {
                    text: doc.text,
                    url: url
                }
            }))
        });
        i++;
    }
}

async function getReleventdata(url) {
    const index = await vectorDB();

    queries = [
        "What is the business name, tagline, and what does this company do?",
        "What industry or niche does this business operate in?",
        "What is the company's mission, vision, and core values?",
        "What products or services does this business offer?",
        "What are the pricing plans, packages, or tiers available?",
        "What are the key features and benefits of each product or service?",
        "Are there any free trials, demos, or guarantees offered?",
        "Who is the target customer or ideal client for this business?",
        "What problems or pain points does this business solve for customers?",
        "What industries or customer types does this business serve?",
        "How does this business communicate with customers? What is their tone?",
        "What makes this business unique or different from competitors?",
        "What are the brand values or personality traits of this company?",
        "What are the support channels available (email, chat, phone)?",
        "What are the business hours or availability for support?",
        "What is the contact information, location, or service area?",
        "What is the onboarding or getting started process?",
        "What are the refund, return, or cancellation policies?",
        "What are the terms of service or usage policies?",
        "What do customers say about this business? Any testimonials or reviews?",
        "What results or outcomes have customers achieved?",
        "What awards, certifications, or recognitions has this business received?",
        "What are the most frequently asked questions about this business?",
        "What objections or concerns do customers typically have?",
    ]

    const queryEmbeddings = await embeddings.embedDocuments(queries);

    const allResults = await Promise.all(
        queries.map(async (query, idx) => {
            const queryEmbedding = queryEmbeddings[idx];
            const result = await index.query({
                topK: 2,
                vector: queryEmbedding,
                includeMetadata: true,
                filter: {
                    url: url
                }
            });
            return { query, matches: result.matches };
        })
    );

    console.log(JSON.stringify(allResults, null, 2));

    let data = [];

    allResults.forEach(result => {
        if (result.matches && result.matches.length > 0) {
            result.matches.forEach(match => {
                if (match.metadata && match.metadata.text) {
                    data.push({ query: result.query, match: match.metadata.text });
                }
            });
        }
    });

    if (data.length === 0) {
        console.log("No data found");
        return [];
    }
    return data;
}
// getReleventdata();

module.exports = {
    rag,
    getReleventdata
}
