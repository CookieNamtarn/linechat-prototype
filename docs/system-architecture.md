# System Architecture — LINE OA Inbox

## Overview

LINE OA Inbox is a full-stack web application built with **TanStack Start** (React SSR framework) that provides a customer support inbox interface for LINE Official Account administrators. The system enables real-time two-way messaging and broadcast capabilities through integration with the LINE Messaging API and Supabase.

---

## Architecture Style

The application follows a **server-rendered SPA with API backend** pattern:

- **Frontend**: Single-page application with client-side routing
- **Backend**: Server functions and API routes co-located in the same codebase
- **Database**: Managed PostgreSQL via Supabase with realtime capabilities
- **Integration**: External LINE Messaging API for message delivery and receipt

---

## Component Architecture

### 1. Client Layer (Browser)

| Component | Technology | Responsibility |
|---|---|---|
| React App | React 19 + TypeScript | UI rendering, state management |
| TanStack Router | `@tanstack/react-router` | Client-side routing (Inbox, Broadcast pages) |
| TanStack Query | `@tanstack/react-query` | Data fetching, caching, realtime sync |
| Supabase JS Client | `@supabase/supabase-js` | Browser DB access, realtime subscriptions |
| shadcn/ui | Radix UI + Tailwind | Accessible UI components |

**Key behaviors:**
- Subscribes to Supabase Realtime for `messages` and `conversations` table changes
- Invalidates query cache on realtime events for instant UI updates
- Uses server functions (`useServerFn`) for mutations (reply, broadcast, markRead)

### 2. Server Layer (Edge/Node)

| Component | Technology | Responsibility |
|---|---|---|
| TanStack Start | `@tanstack/react-start` | SSR, routing, middleware pipeline |
| Server Functions | `createServerFn` | Type-safe RPC for client-server communication |
| Webhook Handler | TanStack Start API route | LINE webhook endpoint |
| Error Middleware | Custom middleware | Error page rendering, h3 swallowed error detection |
| CSRF Protection | `@tanstack/react-start` | CSRF token validation for server functions |
| Supabase Admin Client | Service role key | Bypass RLS for server-side DB operations |

**Key behaviors:**
- Webhook endpoint verifies LINE signatures with HMAC-SHA256
- Server functions handle LINE API calls (push, broadcast) server-side
- Service role key used for all server-side database operations
- Error middleware catches h3 swallowed SSR errors and renders error pages

### 3. Database Layer (Supabase)

| Component | Technology | Responsibility |
|---|---|---|
| PostgreSQL | Supabase managed | Primary data store |
| Row Level Security | PostgreSQL policies | Access control (currently allow-all for anon/auth) |
| Realtime | `supabase_realtime` publication | Live data change notifications |

**Tables:**

| Table | Columns | Purpose |
|---|---|---|
| `conversations` | id, line_user_id, display_name, picture_url, last_message_at, last_message_text, unread_count | Chat session metadata per LINE user |
| `messages` | id, conversation_id (FK), direction, message_type, text, line_message_id | Individual messages |
| `broadcasts` | id, text, status, error | Broadcast message history |

### 4. External Services

| Service | API | Usage |
|---|---|---|
| LINE Messaging API | `api.line.me/v2/bot/` | Push messages, broadcast, fetch user profiles |
| LINE Webhook | Inbound events | Receive message/follow events from LINE Platform |

---

## Security Model

### Authentication & Authorization

- **Client-side**: Uses Supabase publishable key with anonymous auth
- **Server-side**: Uses Supabase service role key (bypasses RLS)
- **CSRF Protection**: TanStack Start CSRF middleware on all server functions
- **LINE Webhook**: HMAC-SHA256 signature verification on every webhook request

### Data Protection

- LINE credentials (`LINE_CHANNEL_SECRET`, `LINE_CHANNEL_ACCESS_TOKEN`) stored as environment variables
- Service role key never exposed to client bundle
- All LINE API calls made server-side to protect access tokens

### RLS Policy

Current policies allow all operations for both `anon` and `authenticated` roles:

```sql
CREATE POLICY "Allow all on conversations" ON public.conversations
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow all on messages" ON public.messages
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow all on broadcasts" ON public.broadcasts
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
```

> **Note**: For production deployments with multiple agents, consider implementing role-based access control.

---

## Request Flows

### Webhook Processing (Inbound)

```
┌──────────┐     POST /api/public/line-webhook      ┌──────────────┐
│  LINE    │ ──────────────────────────────────────► │              │
│ Platform │     x-line-signature: HMAC-SHA256       │   Webhook    │
└──────────┘                                         │   Handler    │
                                                     │              │
                                                     │  1. Verify   │
                                                     │  signature   │
                                                     │              │
                                                     │  2. Parse    │
                                                     │  events      │
                                                     │              │
                                                     │  3. Fetch    │
        ┌──────────────────────────────────────────  │  profile     │
        │ GET /v2/bot/profile/{userId}              │              │
        │                                            │  4. Upsert   │
        ▼                                            │  conversation│
┌──────────────┐                                     │              │
│     LINE     │ ◄────────────────────────────────── │  5. Insert   │
│   Profile    │                                     │  message     │
│     API      │                                     │              │
└──────────────┘                                     └──────┬───────┘
                                                             │
                                                             ▼
                                                     ┌──────────────┐
                                                     │   Supabase   │
                                                     │  (service    │
                                                     │   role)      │
                                                     └──────────────┘
```

### Reply/Broadcast (Outbound)

```
┌──────────┐    useServerFn()     ┌──────────────┐    POST /v2/bot/message/push
│  Client  │ ───────────────────► │   Server     │ ─────────────────────────────►
│   (UI)   │                      │   Function   │                              │
└──────────┘                      │              │     ┌──────────────┐         │
                                  │  1. Validate │     │     LINE     │         │
                                  │  input       │     │   Messaging  │         │
                                  │              │     │     API      │         │
                                  │  2. Fetch    │     └──────────────┘         │
                                  │  line_user_id│                              │
                                  │              │                              │
                                  │  3. Call     │                              │
                                  │  LINE API    │                              │
                                  │              │                              │
                                  │  4. Store    │                              │
                                  │  response    │                              │
                                  └──────────────┘                              │
                                                                                │
                                                                  ┌─────────────┘
                                                                  ▼
                                                           ┌──────────────┐
                                                           │   LINE User  │
                                                           │  (Customer)  │
                                                           └──────────────┘
```

### Realtime Sync

```
┌──────────────┐    INSERT/UPDATE    ┌──────────────┐    Realtime     ┌──────────┐
│   Supabase   │ ──────────────────► │   Realtime   │ ─────────────►  │  Client  │
│  (DB Change) │                     │   Channel    │   (WebSocket)   │(React)   │
└──────────────┘                     └────────────┘                  └──────────┘
                                          │                                │
                                          │                                │
                                          ▼                                ▼
                                   postgres_changes              Query Invalidation
                                   publication                   + Re-fetch
```

---

## Deployment Architecture

```
                    ┌─────────────────────────────────────┐
                    │           CDN / Edge                 │
                    │    (Static assets, SSR caching)      │
                    └──────────────┬──────────────────────┘
                                   │
                    ┌──────────────▼──────────────────────┐
                    │                                     │
                    │     TanStack Start Server           │
                    │     (SSR + API routes +              │
                    │      Server Functions)               │
                    │                                     │
                    │  ┌─────────────┐  ┌─────────────┐   │
                    │  │   Vite SSR  │  │   Server    │   │
                    │  │   Build     │  │   Handler   │   │
                    │  └─────────────┘  └─────────────┘   │
                    │                                     │
                    └──────────┬──────────────────────────┘
                               │
              ┌────────────────┼────────────────┐
              │                │                │
              ▼                ▼                ▼
    ┌─────────────┐   ┌─────────────┐   ┌─────────────┐
    │   Supabase  │   │     LINE    │   │   LINE      │
    │   (DB +     │   │   Webhook   │   │   Messaging │
    │   Realtime) │   │   (inbound) │   │   API       │
    │             │   │             │   │   (outbound)│
    └─────────────┘   └─────────────┘   └─────────────┘
```

---

## Environment Configuration

| Variable | Scope | Purpose |
|---|---|---|
| `VITE_SUPABASE_URL` | Client | Supabase project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Client | Supabase anonymous key |
| `SUPABASE_URL` | Server | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Server | Admin access key |
| `LINE_CHANNEL_SECRET` | Server | Webhook signature verification |
| `LINE_CHANNEL_ACCESS_TOKEN` | Server | LINE API authentication |

---

## Scalability Considerations

### Current Design
- Single-server deployment with SSR
- Direct Supabase connections (connection pooling via Supabase)
- Realtime subscriptions for live updates

### Potential Improvements
- **Queue-based webhook processing**: For high-volume LINE OAs, use a message queue to handle webhook events asynchronously
- **Connection pooling**: PgBouncer for high-connection-count scenarios
- **Multi-agent support**: Add user authentication and agent-specific conversation assignment
- **Message persistence**: Archive old conversations to cold storage
- **Rate limiting**: LINE API rate limits (push: 1000/min, broadcast: 1000/month free tier)

---

## Technology Decisions

| Decision | Rationale |
|---|---|
| **TanStack Start** | Unified framework for SSR + API + routing with excellent TypeScript support |
| **Supabase over raw Postgres** | Built-in realtime, auto-generated types, simple auth integration |
| **Server Functions over REST API** | Type-safe client-server communication with automatic serialization |
| **Service Role Key for server ops** | Server-side operations need full DB access without RLS constraints |
| **HMAC-SHA256 webhook verification** | LINE platform requirement for webhook authenticity |
| **Bun as package manager** | Faster installs; Vite build tooling compatible |
