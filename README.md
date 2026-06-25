# 🚀 Mauzo - Smart POS & Debt Management

Mauzo is a highly polished, offline-first Sales Tracker (POS) and Debt Management application designed for retail shops and local businesses. It features an elegant **claymorphic visual theme**, localized **Swahili terminology**, a built-in cashier calculator, full boss reporting metrics, and a robust multi-device synchronization engine.

---

## 🏗️ System Architecture & Backbone

The application is engineered to operate seamlessly as a full-stack, cloud-integrated solution using the following high-performance stack:

```
                  ┌─────────────────────────────────┐
                  │          User Browser           │
                  │   (Offline-First Local State)   │
                  └────────────────┬────────────────┘
                                   │
                                   ▼
                  ┌─────────────────────────────────┐
                  │       Vercel (Hosting)          │
                  │   Express Serverless API        │
                  └────────────────┬────────────────┘
                                   │
         ┌─────────────────────────┼─────────────────────────┐
         ▼                         ▼                         ▼
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│     GitHub      │       │    Turso DB     │       │     ImgBB       │
│  (Versioning)   │       │   (Cloud SQL)   │       │ (Image Storage) │
└─────────────────┘       └─────────────────┘       └─────────────────┘
```

### 1. ⚡ Vercel (Hosting Backend)
* Managed as a modern single-page application (SPA) with a serverless backend.
* **Routing**: The `vercel.json` maps incoming `/api/*` endpoints to `/api/index.ts` (wrapped with Express serverless), while fallback routes serve the optimized static index.html built by Vite.

### 2. 🗄️ Turso (Relational Cloud SQL Database)
* Driven by a high-performance, cloud-hosted libSQL database.
* Stores real-time logs for:
  - **Products (Bidhaa/Stoki)**
  - **Selling Logs (Mauzo ya Duka)**
  - **Users & Sessions** (Multi-device tracking)
  - **Locks** (Optimistic conflict resolution between different cashiers)
* Clears out any dependency on static, hardcoded defaults by dynamically querying and saving live cloud data.

### 3. 🖼️ ImgBB (Cloud Image Storage)
* Integrated to store product images dynamically in the cloud.
* When adding or updating products, images are uploaded directly to the ImgBB CDN, keeping database payloads lightweight and secure.

### 4. 🐙 GitHub (Version Control)
* Complete version history and continuous integration.

---

## 🎯 Smart Debt Calculation Algorithm (Deni Lililosalia)

We have upgraded the cashier calculator’s **Deni (Debt) calculation engine** to support dual-mode, precise entries. This prevents mistakes where outstanding debt would mistakenly register as `0/=`.

### How It Works:
Operators can now toggle between two input modes inside the checkout screen:

1. **Kiasi cha Deni (Debt Amount Mode)**:
   * **Behavior**: Enter the exact amount of debt the customer is carrying.
   * **Formula**:
     $$\text{Cash Paid Now (Amount Received)} = \max(0, \text{Total Bill} - \text{Debt Amount entered})$$
     $$\text{Deni Lililosalia} = \text{Debt Amount entered}$$
   * **Use Case**: When a customer says *"Nisajilie deni la TSh 5,000"*, the cashier enters `5000` directly.

2. **Kiasi Kilichopokelewa Sasa (Pay Now Mode)**:
   * **Behavior**: Enter the exact cash the customer is paying today.
   * **Formula**:
     $$\text{Deni Lililosalia} = \max(0, \text{Total Bill} - \text{Cash Paid Now})$$
     $$\text{Cash Paid Now} = \text{Cash Paid Now entered}$$
   * **Use Case**: When a customer pays TSh 2,000 on a TSh 7,000 bill, the cashier enters `2000` under cash, and the system automatically calculates and saves TSh 5,000 as the active debt.

---

## 🛠️ Getting Started & Installation

### 1. Environment Configuration
Create a `.env` file at the root based on `.env.example`:
```env
TURSO_CONNECTION_URL=libsql://...
TURSO_AUTH_TOKEN=...
IMGBB_API_KEY=...
```

### 2. Database Setup
Initialize the database tables and indexes on your Turso DB:
```bash
npx tsx init_db.js
```

### 3. Run Development Server
```bash
npm run dev
```

### 4. Production Build
```bash
npm run build
npm start
```
