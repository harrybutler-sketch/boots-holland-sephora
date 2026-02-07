# Brand Allies Scraper

A production-ready web app to trigger Apify scrapers for Sephora, Holland & Barrett, and Boots, and display results from Google Sheets.

## Prerequisites

- Node.js (v18+)
- Netlify CLI (`npm install -g netlify-cli`)
- A Google Cloud Project with Sheets API enabled and a Service Account.
- An Apify Account with the `apify/web-scraper` actor (or similar) configured.

## Setup

1.  **Install Dependencies**
    ```bash
    # Root dependencies (backend)
    npm install

    # Frontend dependencies
    cd frontend
    npm install
    cd ..
    ```

2.  **Environment Variables**
    Create a `.env` file in the root directory (already created with placeholders). You MUST populate the following:

    - `APIFY_TOKEN`: Your Apify API Token.
    - `APIFY_ACTOR_ID`: The ID of the generic web scraper or your custom actor (default: `apify/web-scraper`).
    - `GOOGLE_SHEET_ID`: The ID of your Google Sheet.
    - `GOOGLE_SERVICE_ACCOUNT_EMAIL`: The email of your Google Service Account.
    - `GOOGLE_SERVICE_ACCOUNT_KEY`: The private key of your Service Account (entire JSON private key string or the contents of the `.pem` file).

    > **Important**: For local development, ensure the `GOOGLE_SERVICE_ACCOUNT_KEY` in `.env` handles newlines correctly (replace literal newlines with `\n` if needed, though the code tries to handle it).

## Running Locally

Use Netlify Dev to run both the frontend and backend functions simultaneously:

```bash
netlify dev
```

- Frontend: [http://localhost:8888](http://localhost:8888)
- Functions: [http://localhost:8888/.netlify/functions/...](http://localhost:8888/.netlify/functions/...)

## Deployment (Netlify)

1.  Push this repository to GitHub.
2.  Log in to Netlify and "Add new site" -> "Import an existing project".
3.  Select your repository.
4.  Netlify should detect the settings from `netlify.toml`.
    - Build command: `npm run build`
    - Publish directory: `frontend/dist`
    - Functions directory: `netlify/functions`
5.  **Critical**: Go to Site Settings > Environment Variables and add all the variables from your `.env` file.

## Architecture

- **Frontend**: React (Vite)
- **Backend**: Netlify Functions (Node.js)
- **Database**: Google Sheets (via `google-spreadsheet`)
- **Scraping**: Apify (triggered via API)

## Usage Examples (curl)

### Trigger Scrape
```bash
curl -X POST http://localhost:8888/api/run-scrape \
  -H "Content-Type: application/json" \
  -d '{ "retailers": ["Boots", "Sephora"], "mode": "new-in" }'
```

### Check Status
```bash
curl "http://localhost:8888/api/run-status?runId=YOUR_RUN_ID"
```

### Get Results
```bash
curl "http://localhost:8888/api/results?limit=5&retailer=Boots"
```

