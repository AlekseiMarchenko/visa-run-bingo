# Visa Run Bingo – React Client

This directory contains the React front-end for the Visa Run Bingo game. It is built with Vite and uses plain CSS for styling.

## Setup

Install dependencies and run the development server:

```bash
cd client
npm install
npm run dev
```

To build for production:

```bash
npm run build
```

The client uses environment variables set via Vite:

- VITE_API_BASE – base URL of the backend server.
- VITE_BOT_USERNAME – bot username without the leading @ (optional).

You can deploy the built `dist` directory to any static host.
