# Smart Cloud POS

A cloud-based, multi-store Point of Sale and retail management system. It covers sales, inventory, staff attendance with face recognition, salary, expenses, supplier dues and an AI business assistant. Every part runs on managed cloud services.

- **Live app:** https://smart-cloud-pos.vercel.app
- **Backend API:** https://smart-cloud-pos.onrender.com

> The free backend plan sleeps when idle, so the first request after a pause can take 30–60 seconds.

## Features

**Retail**
- POS billing with barcode scanning and printable invoices
- Product management with per-product discounts
- Inventory tracking with full stock-movement history
- Damaged / spoiled item tracking
- Sales history, reports and a profit dashboard

**People and finance**
- Staff attendance (Present / Late / Absent / Leave) with a monthly summary
- Face-recognition attendance from the browser camera
- Automatic salary calculation with absence and lateness deductions
- Expense tracking; paid salaries are logged as expenses automatically
- Supplier ledger with running due balance

**AI (Groq Cloud)**
- AI Insights page: ask about sales, profit or stock in Bangla or English
- Anomaly alerts and a quick daily report
- Floating AI assistant on every page

**Customers**
- Loyalty portal: customers register, earn points and view offers
- Earn 1 point per ৳100; 100 points = ৳80 discount, usable at any store

**Multi-store and access control**
- Many stores in one shared database, each row isolated by `store_id`
- Five roles: Admin, Manager, Cashier, Store Keeper, Viewer (read-only)
- JWT authentication

## Architecture

| Layer | Service | Model |
|---|---|---|
| Frontend (React) | Vercel | Static hosting on a global CDN |
| Backend (Node.js / Express REST API) | Render | Managed web service (PaaS) |
| Database (MySQL-compatible) | TiDB Cloud | Managed database (DBaaS) |
| AI model | Groq Cloud | AI as a service (API) |

Face matching runs in the browser, which is a form of edge computing. The server stores only a numeric face embedding, never the photo.

## Tech stack

- **Frontend:** React, Axios, CSS
- **Backend:** Node.js, Express, JWT, bcrypt, mysql2
- **Database:** TiDB Cloud (MySQL compatible)
- **AI:** Groq API (`openai/gpt-oss-20b` by default)

## Run locally

**1. Database**

Create a `pos_db` database, then run these files in order:

1. `database_structure.sql`, the base schema
2. `backend/migrations/001_customer_loyalty.sql`, which adds the customer and loyalty-point tables
3. `backend/migrations/002_hr_finance_face.sql`, which adds the HR, finance and face tables

**2. Backend**

```bash
cd backend
cp .env.example .env   # then fill in your own values
npm install
npm run dev            # http://localhost:5000
```

**3. Frontend**

```bash
cd frontend
npm install
npm start              # http://localhost:3000
```

The frontend calls the live API by default. To use your local backend, create `frontend/.env` with:

```
REACT_APP_API_URL=http://localhost:5000
```

## Environment variables

`backend/.env.example` lists every variable. Set the same keys in the Render dashboard for production:

`PORT`, `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_SSL`, `JWT_SECRET`, `GROQ_API_KEY`, `GROQ_MODEL`

## Security

- Secrets are stored only in environment variables, never in the repository.
- Passwords are hashed with bcrypt.
- Uploaded staff photos (`backend/uploads/`) are excluded from Git.

## Author

**Meherab Hossain** ([@meherabjim](https://github.com/meherabjim))
United International University — Cloud Computing course project.
