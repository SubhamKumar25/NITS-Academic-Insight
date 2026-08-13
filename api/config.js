/**
 * NITS Academic Insight — Vercel Serverless Function
 * Endpoint: GET /api/config
 * Returns public Firebase Web SDK configuration from Vercel environment variables.
 * NEVER add service account, private keys, or admin credentials here.
 */
module.exports = function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const config = {
        apiKey:            process.env.VITE_FIREBASE_API_KEY            || "",
        authDomain:        process.env.VITE_FIREBASE_AUTH_DOMAIN        || "",
        projectId:         process.env.VITE_FIREBASE_PROJECT_ID         || "",
        storageBucket:     process.env.VITE_FIREBASE_STORAGE_BUCKET     || "",
        messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
        appId:             process.env.VITE_FIREBASE_APP_ID             || ""
    };

    // Set CORS headers so the frontend can fetch this from any Vercel domain
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'application/json');
    res.status(200).json(config);
};
