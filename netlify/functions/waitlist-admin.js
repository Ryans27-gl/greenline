const { getStore } = require("@netlify/blobs");

exports.handler = async (event) => {
  const headers = {
    "Content-Type": "application/json",
  };

  if (event.httpMethod !== "GET") {
    return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  const secret = event.queryStringParameters?.key;
  const ADMIN_KEY = process.env.WAITLIST_ADMIN_KEY;

  if (!ADMIN_KEY) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: "Admin key not configured" }) };
  }

  if (!secret || secret !== ADMIN_KEY) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: "Unauthorized" }) };
  }

  try {
    const siteID = process.env.NETLIFY_SITE_ID;
    const token = process.env.NETLIFY_API_TOKEN;

    if (!siteID || !token) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: "Server configuration error" }) };
    }

    const store = getStore({ name: "waitlist", siteID, token });
    const { blobs } = await store.list();

    const entries = [];
    for (const blob of blobs) {
      const data = await store.get(blob.key, { type: "json" });
      if (data) entries.push(data);
    }

    // Sort by newest first
    entries.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ total: entries.length, emails: entries }),
    };
  } catch (err) {
    console.error("Waitlist admin error:", err.message, err.stack);
    return { statusCode: 500, headers, body: JSON.stringify({ error: "Failed to fetch emails" }) };
  }
};
