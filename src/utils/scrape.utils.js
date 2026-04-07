const puppeteer = require("puppeteer");
const fs = require("fs");
const cheerio = require("cheerio");
const { rag, getReleventdata } = require("../services/rag.service");
const { log } = require("console");

async function scrape(url) {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    let allData = "";
    console.log("Scraping: " + url);

    try {
        console.log("Attempting sitemap scrape: " + url + "/sitemap.xml");
        await page.goto(url + "/sitemap.xml", {
            waitUntil: "networkidle2",
            timeout: 10000
        });

        const sitemap = await page.content();
        const $ = cheerio.load(sitemap, { xmlMode: true });
        const urls = [];

        $("loc").each((i, el) => {
            if (urls.length >= 5) return false;
            const link = $(el).text().trim();
            if (link) urls.push(link);
        });

        if (urls.length > 0) {
            console.log("Found sitemap URLs:", urls);
            for (const sUrl of urls) {
                console.log("Scraping page:", sUrl);
                try {
                    const text = await scrapePage(page, sUrl);
                    allData += text + "\n";
                } catch (e) {
                    console.log(`Failed to scrape ${sUrl}: ${e.message}`);
                }
            }
        } else {
            console.log("No URLs found in sitemap. Falling back to homepage.");
            const text = await scrapePage(page, url);
            allData += text;
        }
    } catch (error) {
        console.log("Sitemap search failed or timed out. Scraping homepage instead.");
        try {
            const text = await scrapePage(page, url);
            allData += text;
        } catch (e) {
            console.log("Failed to scrape homepage:", e.message);
        }
    }


    await browser.close();

    await rag(allData, url);
    
    // Pinecone needs a few seconds to index the vectors before they are queryable
    console.log("Waiting for Pinecone to index...");
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    let data = await getReleventdata(url);
    return data;
}

async function scrapePage(page, url) {
    await page.goto(url, {
        waitUntil: "networkidle2"
    });

    await page.evaluate(() => {
        const tags = [
            "h1", "h2", "h3", "h4", "h5", "h6",
            "p",
            "a",
            "li",
            "span",
            "strong",
            "em",
            "b",
            "i",
            "button",
            "label",
            "small",
            "blockquote",
            "caption",
            "figcaption",
            "summary",
            "form",
            "input",
            "textarea",
            "option",
            "select"
        ];

        const content = [];

        tags.forEach(tag => {
            document.querySelectorAll(tag).forEach(el => {
                const text = el.innerText.trim();
                if (text) {
                    content.push(`<${tag}>${text}</${tag}>`);
                }
            });
        });

        ["script", "style", "img", "svg", "noscript", "iframe"].forEach(tag => {
            document.querySelectorAll(tag).forEach(el => el.remove());
        });
        document.querySelectorAll("*").forEach(el => {
            el.removeAttribute("class");
            el.removeAttribute("style");
        });
    });

    const text = await page.evaluate(() => document.body.innerText);
    console.log(text);
    return text;
}

module.exports = { scrape };