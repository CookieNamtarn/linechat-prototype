# LINE Chat Bot — LINE OA Inbox

A web application for managing customer chat interactions through a LINE Official Account (LINE OA). Built with [Lovable](https://lovable.dev).

**Live app**: https://linechat-prototype.lovable.app

## Overview

LINE OA Inbox is a full-stack web application that provides a customer support inbox interface for LINE Official Account administrators. It enables real-time two-way messaging between support agents and LINE users, plus broadcast messaging to all followers.

## Features

- **Real-time Inbox** — View and respond to customer messages from LINE OA with live updates via Supabase Realtime.
- **Conversation Management** — Auto-grouping of messages by LINE user, unread counts, profile avatars.
- **Message Types** — Support for text, sticker, image, video, audio, and location messages (inbound).
- **Broadcast Messaging** — Send broadcast messages to all LINE followers at once.
- **Responsive UI** — Built with Tailwind CSS and shadcn/ui components for a modern, mobile-friendly interface.

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 19, TypeScript, Tailwind CSS v4 |
| **Routing** | TanStack Router |
| **State / Data Fetching** | TanStack Query |
| **Backend** | TanStack Start (SSR + API routes) |
| **Database** | PostgreSQL (via Supabase) |
| **Realtime** | Supabase Realtime (postgres_changes) |
| **External APIs** | LINE Messaging API v2 |
| **Build Tool** | Vite 8 |
| **Package Manager** | Bun |

## Architecture

The application follows a server-rendered React architecture with TanStack Start:

- **Client**: React SPA with TanStack Router and Query for data fetching
- **Server**: Server-side rendering + server functions for LINE API calls
- **Database**: Supabase PostgreSQL with Realtime subscriptions
- **External**: LINE Messaging API for send/receive messages

For detailed architecture and system diagrams, see:
- [System Diagram](docs/system-diagram.md)
- [System Architecture](docs/system-architecture.md)

## Database Schema

Three main tables in Supabase:

| Table | Purpose |
|---|---|
| `conversations` | Chat sessions with LINE users (display name, avatar, last message, unread count) |
| `messages` | Individual messages linked to conversations (direction, type, text) |
| `broadcasts` | Broadcast message history with status tracking |

## Project Structure

```
src/
├── routes/                    # TanStack Router pages
│   ├── index.tsx              # Inbox page (conversation list + chat)
│   ├── broadcast.tsx          # Broadcast messaging page
│   └── api/public/
│       └── line-webhook.ts    # LINE webhook endpoint
├── lib/
│   └── line.functions.ts      # Server functions (reply, broadcast, markRead)
├── integrations/supabase/
│   ├── client.ts              # Browser Supabase client
│   ├── client.server.ts       # Server Supabase client (service role)
│   └── types.ts               # Generated database types
├── components/ui/             # shadcn/ui components
├── router.tsx                 # Router configuration
├── server.ts                  # Server entry point
└── start.ts                   # TanStack Start bootstrap
supabase/
└── migrations/                # Database migrations
```

## Environment Variables

The following environment variables are required:

| Variable | Description |
|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable/anonymous key |
| `SUPABASE_URL` | Supabase URL (server-side) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-side) |
| `LINE_CHANNEL_SECRET` | LINE channel secret for webhook signature verification |
| `LINE_CHANNEL_ACCESS_TOKEN` | LINE channel access token for API calls |

## Development

Prerequisites: Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone https://github.com/CookieNamtarn/linechat-prototype.git
cd linechat-prototype
npm i
npm run dev
```

Other scripts:

```sh
npm run build      # Production build
npm run preview    # Preview production build
npm run lint       # ESLint
npm run format     # Prettier
```

## LINE Webhook Setup

1. Configure your LINE Official Account webhook to point to: `https://your-domain.com/api/public/line-webhook`
2. Set `LINE_CHANNEL_SECRET` and `LINE_CHANNEL_ACCESS_TOKEN` in your environment
3. The webhook accepts POST requests, verifies signatures with HMAC-SHA256, and stores inbound messages in Supabase
4. Realtime subscriptions auto-update the inbox UI when new messages arrive

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/e5ca243b-f16c-4e91-b38f-1baf9d334dc9).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable.
