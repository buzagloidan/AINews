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

// Internal API endpoint for website use only
app.get('/api/news/:lang', async (req, res) => {
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

// RSS feed endpoint - English updates
app.get('/rss.xml', async (req, res) => {
    try {
        // Create RSS feed for English content
        const feed = new RSS({
            title: 'AI Newsletter - English AI Updates',
            description: 'Latest AI news updates in English from industry sources',
            feed_url: 'https://news.buzagloidan.com/rss.xml',
            site_url: 'https://news.buzagloidan.com',
            image_url: 'https://news.buzagloidan.com/favicon.png',
            docs: 'https://news.buzagloidan.com',
            managingEditor: 'news@buzagloidan.com (Idan Buzaglo)',
            webMaster: 'news@buzagloidan.com (Idan Buzaglo)',
            copyright: `${new Date().getFullYear()} AI Newsletter`,
            language: 'en',
            categories: ['Technology', 'Artificial Intelligence', 'News'],
            pubDate: new Date(),
            ttl: '60'
        });

        // Fetch English news only
        const url = `${API_BASE}/ai_news_english?select=*&order=created_at.desc&limit=25`;
        const response = await axios.get(url, { headers: supabaseHeaders });

        // Add items to RSS feed
        response.data.forEach(item => {
            feed.item({
                description: item.content || item.title,
                date: new Date(item.created_at),
                guid: `ainews-en-${item.created_at}`
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
            title: `AI Newsletter - ${languageName} AI Updates`,
            description: `Latest AI news updates in ${languageName}`,
            feed_url: `https://news.buzagloidan.com/rss-${lang}.xml`,
            site_url: 'https://news.buzagloidan.com',
            image_url: 'https://news.buzagloidan.com/favicon.png',
            docs: 'https://news.buzagloidan.com',
            managingEditor: 'news@buzagloidan.com (Idan Buzaglo)',
            webMaster: 'news@buzagloidan.com (Idan Buzaglo)',
            copyright: `${new Date().getFullYear()} AI Newsletter`,
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
                description: item.content || item.title,
                date: new Date(item.created_at),
                guid: `ainews-${lang}-${item.created_at}`
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