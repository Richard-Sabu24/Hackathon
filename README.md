# MaskLab — Media Studio

A production-ready Node.js and Express media workspace application for image, video, voice, and live camera synthetic experiments. Built with modular EJS views, dark aesthetic UI, REST APIs, and structured MVC architecture.

---

## 🚀 Features

- **Image & Video Masking**: Upload images or videos (JPG, PNG, WEBP, MP4, WEBM) and apply an adjustable synthetic face-mask overlay.
- **Voice Effects**: Audio player with animated waveform preview and interactive pitch/speed sliders.
- **Live Camera**: Real-time webcam integration with synthetic graphic overlay rendering using HTML5 Canvas and `requestAnimationFrame`.
- **Project Management**: Session and backend persistence for created works, displayed in the Projects gallery and recent items list.
- **Demo Authentication**: Flexible email and guest sign-in workflows.
- **Production Server**: Express.js server with EJS templating, REST API endpoints, 404/500 error handling, and environment-based configuration.

---

## 📁 Project Structure

```text
MaskLab/
│
├── src/
│   ├── app.js                      # Express application setup & middleware configuration
│   ├── server.js                   # HTTP server entrypoint with graceful shutdown
│   │
│   ├── routes/
│   │   └── index.routes.js         # Web views & REST API route definitions
│   │
│   ├── controllers/
│   │   └── index.controller.js     # Request handlers & response formatting
│   │
│   ├── services/
│   │   └── project.service.js      # Business logic & project state service
│   │
│   ├── middleware/
│   │   ├── error.middleware.js     # Centralized error handler (safe for production)
│   │   └── notFound.middleware.js  # 404 handler for API (JSON) and Views (HTML)
│   │
│   ├── config/
│   │   └── index.js                # Environment configuration loader (dotenv)
│   │
│   └── utils/
│       └── helpers.js              # Sanitization & API helper functions
│
├── views/
│   ├── index.ejs                   # Main application template
│   ├── 404.ejs                     # Custom 404 page styled to match theme
│   ├── 500.ejs                     # Custom 500 server error page
│   └── partials/
│       ├── head.ejs                # HTML <head>, fonts, stylesheets, meta tags
│       ├── toast.ejs               # Toast notification component
│       ├── login.ejs               # Email & Guest login view
│       ├── sidebar.ejs             # App sidebar navigation
│       ├── topbar.ejs              # App topbar with user status
│       ├── scripts.ejs             # Client scripts loader
│       └── pages/
│           ├── home.ejs            # Home workspace view
│           ├── face.ejs            # Image & video face masking view
│           ├── voice.ejs           # Voice effect view
│           ├── live.ejs            # Live camera demo view
│           └── projects.ejs        # Saved projects gallery view
│
├── public/
│   ├── css/
│   │   └── style.css               # Design system & dark mode styles
│   ├── js/
│   │   └── script.js               # Client interaction, webcam & media logic
│   ├── images/
│   │   └── favicon.svg             # Application favicon
│   └── assets/
│       └── brand-logo.svg          # Brand vector asset
│
├── .env                            # Active environment variables
├── .env.example                    # Template environment variables
├── .gitignore                      # Git ignored files & directories
├── package.json                    # Dependencies & npm scripts
└── README.md                       # Documentation & instructions
```

---

## 🛠️ Technology Stack

- **Runtime**: Node.js (v18+)
- **Server Framework**: Express.js (v4.x)
- **View Engine**: EJS (Embedded JavaScript)
- **Styling**: Vanilla CSS3 (Custom Dark Design System with CSS variables)
- **Client Logic**: Vanilla JavaScript (ES6+, WebRTC getUserMedia, HTML5 Canvas)
- **Configuration**: dotenv

---

## ⚡ Quick Start

### 1. Prerequisites

Ensure you have **Node.js** (v18 or higher) and **npm** installed on your system.

Verify your installation:
```bash
node -v
npm -v
```

### 2. Install Dependencies

In the project root directory, run:
```bash
npm install
```

### 3. Configure Environment

Review or customize settings in `.env`:
```env
PORT=3000
NODE_ENV=development
APP_NAME=MaskLab
```

### 4. Run the Application

#### Development Mode (with automatic restart):
```bash
npm run dev
```

#### Production Mode:
```bash
npm start
```

Open your browser and navigate to:
```
http://localhost:3000
```

---

## 🌐 API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/` | Main MaskLab Web Studio view |
| `GET` | `/health` | Server health check (uptime, version, status) |
| `GET` | `/api/health` | JSON health status |
| `GET` | `/api/projects` | List all saved projects |
| `POST` | `/api/projects` | Create a new project `{ type, name }` |
| `POST` | `/api/auth/login` | Session login endpoint `{ email, type }` |

---

## 🔒 Error Handling & Resilience

- **404 Handling**: Custom responsive 404 page for browser navigation, and structured JSON `{ success: false, message: "Resource not found" }` for API requests.
- **500 Error Protection**: Production mode prevents leaking error stack traces or system internals to users.
- **Graceful Shutdown**: Handles `SIGTERM` and `SIGINT` signals safely to close active connections without data corruption.
