const { getStore } = require("@netlify/blobs");

exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  let email;
  try {
    const body = JSON.parse(event.body);
    email = body.email?.trim().toLowerCase();
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: "Invalid request body" }) };
  }

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: "Invalid email address" }) };
  }

  try {
    const store = getStore("waitlist");

    // Use email as key to prevent duplicates
    const existing = await store.get(email, { type: "json" });
    if (existing) {
      return { statusCode: 200, headers, body: JSON.stringify({ message: "You're already on the list!" }) };
    }

    const entry = {
      email,
      timestamp: new Date().toISOString(),
      userAgent: event.headers["user-agent"] || "",
      source: JSON.parse(event.body).source || "unknown",
    };

    await store.setJSON(email, entry);

    return { statusCode: 200, headers, body: JSON.stringify({ message: "You're on the list! We'll notify you at launch." }) };
  } catch (err) {
    console.error("Waitlist error:", err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: "Failed to save. Please try again." }) };
  }
};
