const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');

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

// Serve the main HTML file for the root path
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(port, '0.0.0.0', () => {
    console.log(`Server is running on port ${port}`);
}); 