const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');
const RSS = require('rss');

const app = express();
const port = process.env.PORT || 3000;

// Environment variables for Supabase
const API_BASE = 'https://kqqnzmgtflzpqwsqsklq.supabase.co/rest/v1';
const API_KEY = process.env.SUPABASE_API_KEY;
// New: Read allowed API keys from environment variables
const ALLOWED_API_KEYS = new Set(process.env.ALLOWED_API_KEYS ? process.env.ALLOWED_API_KEYS.split(',') : []);

if (!API_KEY) {
    console.error('FATAL ERROR: SUPABASE_API_KEY environment variable is not set.');
    process.exit(1);
}

const supabaseHeaders = {
    'apikey': API_KEY,
    'Authorization': `Bearer ${API_KEY}`,
};

// Middleware
app.use(cors());
app.use(express.static(__dirname)); // Serve static files from the root directory

// New: API Key authentication middleware
const apiKeyAuth = (req, res, next) => {
    // Let requests from our own website pass through without a key
    if (req.headers.referer && req.headers.referer.includes('news.buzagloidan.com')) {
        return next();
    }

    const userApiKey = req.get('X-API-Key');
    if (ALLOWED_API_KEYS.size > 0) {
        if (!userApiKey) {
            return res.status(401).json({ error: 'API Key is required.' });
        }
        if (!ALLOWED_API_KEYS.has(userApiKey)) {
            return res.status(403).json({ error: 'Invalid API Key.' });
        }
    }
    next();
};

// API proxy endpoint
app.get('/api/news/:lang', apiKeyAuth, async (req, res) => {
    const { lang } = req.params;
    const limit = req.query.limit || 10;

    // Determine table name based on language
    const tableName = lang === 'he' ? 'ai_news' : 'ai_news_english';
    const url = `${API_BASE}/${tableName}?select=*&order=created_at.desc&limit=${limit}`;

    try {
        const response = await axios.get(url, { headers: supabaseHeaders });
        res.json(response.data);
    } catch (error) {
        console.error(`Error fetching news for language '${lang}':`, error.response ? error.response.data : error.message);
        res.status(500).json({ error: 'Failed to fetch news from Supabase.' });
    }
});

// RSS feed endpoint
app.get('/rss.xml', async (req, res) => {
    try {
        // Create RSS feed
        const feed = new RSS({
            title: 'AI News Hub - Latest AI Updates',
            description: 'Real-time AI news updates in Hebrew and English from industry sources',
            feed_url: 'https://news.buzagloidan.com/rss.xml',
            site_url: 'https://news.buzagloidan.com',
            image_url: 'https://news.buzagloidan.com/favicon.png',
            docs: 'https://news.buzagloidan.com',
            managingEditor: 'Idan Buzaglo',
            webMaster: 'Idan Buzaglo',
            copyright: `${new Date().getFullYear()} AI News Hub`,
            language: 'en',
            categories: ['Technology', 'Artificial Intelligence', 'News'],
            pubDate: new Date(),
            ttl: '60'
        });

        // Fetch latest news from both languages
        const hebrewUrl = `${API_BASE}/ai_news?select=*&order=created_at.desc&limit=20`;
        const englishUrl = `${API_BASE}/ai_news_english?select=*&order=created_at.desc&limit=20`;

        const [hebrewResponse, englishResponse] = await Promise.all([
            axios.get(hebrewUrl, { headers: supabaseHeaders }),
            axios.get(englishUrl, { headers: supabaseHeaders })
        ]);

        // Combine and sort all news items by date
        const allNews = [
            ...hebrewResponse.data.map(item => ({ ...item, language: 'Hebrew' })),
            ...englishResponse.data.map(item => ({ ...item, language: 'English' }))
        ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
         .slice(0, 30); // Limit to 30 most recent items

        // Add items to RSS feed
        allNews.forEach(item => {
            feed.item({
                title: `[${item.language}] ${item.title}`,
                description: item.content || item.title,
                url: `https://news.buzagloidan.com/#${item.id}`,
                guid: `ainews-${item.id}`,
                categories: ['AI News', item.language],
                author: 'AI News Hub',
                date: new Date(item.created_at)
            });
        });

        // Set proper headers and send RSS XML
        res.set({
            'Content-Type': 'application/rss+xml; charset=utf-8',
            'Cache-Control': 'public, max-age=3600' // Cache for 1 hour
        });
        
        res.send(feed.xml({ indent: true }));
        
    } catch (error) {
        console.error('Error generating RSS feed:', error);
        res.status(500).json({ error: 'Failed to generate RSS feed' });
    }
});

// Language-specific RSS feeds
app.get('/rss-:lang.xml', async (req, res) => {
    const { lang } = req.params;
    
    try {
        const isHebrew = lang === 'he';
        const tableName = isHebrew ? 'ai_news' : 'ai_news_english';
        const languageName = isHebrew ? 'Hebrew' : 'English';
        
        // Create language-specific RSS feed
        const feed = new RSS({
            title: `AI News Hub - ${languageName} AI Updates`,
            description: `Latest AI news updates in ${languageName}`,
            feed_url: `https://news.buzagloidan.com/rss-${lang}.xml`,
            site_url: 'https://news.buzagloidan.com',
            image_url: 'https://news.buzagloidan.com/favicon.png',
            docs: 'https://news.buzagloidan.com',
            managingEditor: 'Idan Buzaglo',
            webMaster: 'Idan Buzaglo',
            copyright: `${new Date().getFullYear()} AI News Hub`,
            language: lang,
            categories: ['Technology', 'Artificial Intelligence', 'News'],
            pubDate: new Date(),
            ttl: '60'
        });

        // Fetch news for specific language
        const url = `${API_BASE}/${tableName}?select=*&order=created_at.desc&limit=25`;
        const response = await axios.get(url, { headers: supabaseHeaders });

        // Add items to RSS feed
        response.data.forEach(item => {
            feed.item({
                title: item.title,
                description: item.content || item.title,
                url: `https://news.buzagloidan.com/#${item.id}`,
                guid: `ainews-${lang}-${item.id}`,
                categories: ['AI News', languageName],
                author: 'AI News Hub',
                date: new Date(item.created_at)
            });
        });

        // Set proper headers and send RSS XML
        res.set({
            'Content-Type': 'application/rss+xml; charset=utf-8',
            'Cache-Control': 'public, max-age=3600' // Cache for 1 hour
        });
        
        res.send(feed.xml({ indent: true }));
        
    } catch (error) {
        console.error(`Error generating RSS feed for language '${lang}':`, error);
        res.status(500).json({ error: 'Failed to generate RSS feed' });
    }
});

// Serve the main HTML file for the root path
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(port, '0.0.0.0', () => {
    console.log(`Server is running on port ${port}`);
}); 