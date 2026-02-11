---
description: How to run the Brand Allies Scraper locally
---

# Prerequisites
- Node.js (v18+)
- Netlify CLI (`npm install -g netlify-cli`)

# Running the App
The app consists of a Vite Frontend and Netlify Functions Backend.
To run both simultaneously with API proxying working correctly, use the Netlify CLI.

1.  **Install Dependencies** (if not done):
    ```bash
    npm install
    npm install --prefix frontend
    ```

2.  **Start Development Server**:
    // turbo
    ```bash
    netlify dev
    ```

This will confirm that:
- Check `vite.config.js` has no proxy (Netlify Dev handles this automatically).
- API requests to `/.netlify/functions/` or `/api/` are routed correctly.
