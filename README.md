# OrderingSystem

A simple, no-build front-end for a customer order management system. Customers can sign up, sign in, place orders, and track them — all from one page.

Built with plain **HTML, CSS, and JavaScript** (no frameworks, no bundler).

## Features

- Sign in / create an account (JWT-based authentication)
- Place new orders and see order value / active order counts at a glance
- View, edit, and delete existing orders
- Admins see all customer orders; regular customers see only their own
- Session is kept in the browser (`localStorage`), with automatic token refresh
- Safety limit: deleting 3 orders in the same day temporarily restricts placing new orders for 6 hours

## Tech Stack

- HTML5 + CSS3 (Google Fonts: DM Sans, IBM Plex Mono, Space Grotesk)
- Vanilla JavaScript (`fetch` API, no dependencies)
- Talks to a separate backend REST API (JWT auth + `/api/orders`, `/api/clients` style endpoints)

## Project Structure

```
├── index.html    # Page markup (login/register + orders dashboard)
├── styles.css    # Styling
└── app.js        # App logic: auth, API calls, rendering
```

## Getting Started

This is a static site, so no build step or `npm install` is required.

1. Clone the repo:
   ```bash
   git clone https://github.com/mohamedshehatadev17/ordersytemclient.git
   cd ordersytemclient
   ```
2. Open `index.html` directly in your browser, or serve it locally:
   ```bash
   npx serve .
   ```

## Backend API

The app expects a backend API and points to it via `API_BASE_URL` at the top of `app.js`:

```js
const API_BASE_URL = "https://orderingsystem.runasp.net";
```

Update this value to point to your own backend if needed. Expected endpoints include:

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/auth/login` | Sign in |
| POST | `/api/auth/register` | Create an account |
| POST | `/api/auth/refresh` | Refresh access token |
| GET | `/api/orders` | Get the current customer's orders |
| GET | `/api/orders/all` | Get all orders (admin only) |
| GET | `/api/orders/{id}` | Get a single order |
| POST | `/api/orders` | Place a new order |
| PUT | `/api/orders/{id}` | Update an order |
| DELETE | `/api/orders/{id}` | Delete an order |

## License

No license specified.
