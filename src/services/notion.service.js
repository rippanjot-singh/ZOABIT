const { Client } = require("@notionhq/client");
const axios = require("axios");

/**
 * Notion Service
 * Handles OAuth, searching, and reading data from Notion.
 */

function getNotionAuthUrl(state = "connect") {
    const clientId = process.env.NOTION_CLIENT_ID;
    const redirectUri = encodeURIComponent(`${process.env.BACKEND_URL}/api/notion/callback`);
    return `https://api.notion.com/v1/oauth/authorize?owner=user&client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&state=${state}`;
}

async function getNotionTokens(code) {
    const clientId = process.env.NOTION_CLIENT_ID;
    const clientSecret = process.env.NOTION_CLIENT_SECRET;
    const redirectUri = `${process.env.BACKEND_URL}/api/notion/callback`;
    const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

    const response = await axios.post("https://api.notion.com/v1/oauth/token", {
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri
    }, {
        headers: { "Authorization": `Basic ${auth}`, "Content-Type": "application/json" }
    });

    return response.data;
}

async function searchNotion(accessToken) {
    const notion = new Client({ auth: accessToken });
    try {
        const response = await notion.search({
            sort: { direction: 'descending', timestamp: 'last_edited_time' }
        });

        return response.results.map(item => ({
            id: item.id,
            type: item.object,
            name: item.properties?.title?.title?.[0]?.plain_text || item.title?.[0]?.plain_text || "Untitled",
            parent: item.parent,
            lastModified: item.last_edited_time,
            url: item.url
        }));
    } catch (error) {
        console.error("[Notion Search Error]:", error);
        throw error;
    }
}

async function readNotionPage(accessToken, pageId) {
    const notion = new Client({ auth: accessToken });
    try {
        return await fetchAllChildren(notion, pageId);
    } catch (error) {
        console.error("[Notion Page Read Error]:", error);
        throw error;
    }
}

async function fetchAllChildren(notion, blockId, depth = 0) {
    if (depth > 5) return ""; // Prevent infinite recursion or too much data

    let text = "";
    let hasMore = true;
    let cursor = undefined;

    while (hasMore) {
        const response = await notion.blocks.children.list({
            block_id: blockId,
            start_cursor: cursor
        });

        for (const block of response.results) {
            text += await parseBlock(notion, block, depth);
        }

        hasMore = response.has_more;
        cursor = response.next_cursor;
    }

    return text;
}

async function parseBlock(notion, block, depth) {
    let content = "";
    const type = block.type;
    const data = block[type];
    const indent = "  ".repeat(depth);

    // Handle text-based blocks
    if (data.rich_text) {
        const text = data.rich_text.map(t => t.plain_text).join("");
        switch (type) {
            case 'paragraph': content = indent + text + "\n"; break;
            case 'heading_1': content = "\n" + indent + "# " + text + "\n"; break;
            case 'heading_2': content = "\n" + indent + "## " + text + "\n"; break;
            case 'heading_3': content = "\n" + indent + "### " + text + "\n"; break;
            case 'bulleted_list_item': content = indent + "- " + text + "\n"; break;
            case 'numbered_list_item': content = indent + "1. " + text + "\n"; break;
            case 'to_do': content = indent + `[${data.checked ? 'x' : ' '}] ` + text + "\n"; break;
            case 'code': content = indent + "```" + data.language + "\n" + text + "\n```\n"; break;
            case 'quote': content = indent + "> " + text + "\n"; break;
            case 'callout': content = indent + "[INFO]: " + text + "\n"; break;
            default: content = indent + text + "\n"; break;
        }
    } else if (type === 'child_page') {
        content = `\n${indent}--- [SUB-PAGE: ${data.title}] ---\n`;
    } else if (type === 'child_database') {
        content = `\n${indent}--- [DATABASE: ${data.title}] ---\n`;
    }

    // Recursively fetch children for ALL blocks that have them (including sub-pages, columns, etc)
    if (block.has_children) {
        content += await fetchAllChildren(notion, block.id, depth + 1);
    }

    return content;
}

async function readNotionDatabase(accessToken, databaseId) {
    const notion = new Client({ auth: accessToken });
    try {
        const response = await notion.databases.query({ database_id: databaseId });
        let result = "Database Entries:\n\n";

        for (const page of response.results) {
            const props = page.properties;
            let entry = "- ";
            for (const [name, value] of Object.entries(props)) {
                const val = parseProperty(value);
                if (val) entry += `${name}: ${val} | `;
            }
            result += entry.slice(0, -3) + "\n";
        }
        return result;
    } catch (error) {
        console.error("[Notion DB Read Error]:", error);
        throw error;
    }
}

function parseProperty(prop) {
    switch (prop.type) {
        case 'title': return prop.title.map(t => t.plain_text).join("");
        case 'rich_text': return prop.rich_text.map(t => t.plain_text).join("");
        case 'number': return prop.number;
        case 'select': return prop.select?.name;
        case 'multi_select': return prop.multi_select.map(s => s.name).join(", ");
        case 'date': return prop.date?.start;
        case 'checkbox': return prop.checkbox ? "Yes" : "No";
        case 'email': return prop.email;
        case 'phone_number': return prop.phone_number;
        case 'url': return prop.url;
        default: return null;
    }
}

module.exports = {
    getNotionAuthUrl,
    getNotionTokens,
    searchNotion,
    readNotionPage,
    readNotionDatabase
};
