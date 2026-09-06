# System Diagram — LINE OA Inbox

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              LINE OA Inbox                                   │
│                          System Context Diagram                              │
└─────────────────────────────────────────────────────────────────────────────┘

                              ┌──────────────┐
                              │              │
                              │   LINE User  │
                              │  (Customer)  │
                              │              │
                              └──────┬───────┘
                                     │
                        ┌────────────┼────────────┐
                        │ Send Message              │ Receive Reply
                        │ (text, sticker, image,    │ (push/broadcast)
                        │  video, audio, location)  │
                        │                           │
                        ▼                           │
               ┌────────────────┐                   │
               │                │                   │
               │  LINE Platform │ ◄─────────────────┘
               │  (Messaging API)│
               │                │
               └───────┬────────┘
                       │
                       │ Webhook POST
                       │ (signed with X-Line-Signature)
                       │
                       ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                                                                          │
│                        LINE OA Inbox Application                         │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │                                                                     │ │
│  │  ┌──────────────────┐    ┌──────────────────┐    ┌──────────────┐  │ │
│  │  │                  │    │                  │    │              │  │ │
│  │  │  LINE Webhook    │    │  Server Functions │    │  Client App  │  │ │
│  │  │  Endpoint        │    │  (Server-side)    │    │  (React SPA) │  │ │
│  │  │                  │    │                  │    │              │  │ │
│  │  │  POST /api/      │    │  • replyToConv() │    │  • Inbox     │  │ │
│  │  │  public/line-    │    │  • sendBroadcast│    │  • Broadcast │  │ │
│  │  │  webhook         │    │  • markRead()    │    │              │  │ │
│  │  │                  │    │                  │    │              │  │ │
│  │  │  • Verify HMAC   │    │                  │    │              │  │ │
│  │  │  • Parse events  │    │                  │    │              │  │ │
│  │  │  • Store in DB   │    │                  │    │              │  │ │
│  │  │  • Fetch profile │    │                  │    │              │  │ │
│  │  └────────┬─────────┘    └────────┬─────────┘    └──────┬───────┘  │ │
│  │           │                       │                    │          │ │
│  │           │                       │                    │          │ │
│  │           ▼                       ▼                    ▼          │ │
│  │  ┌─────────────────────────────────────────────────────────────┐  │ │
│  │  │                                                             │  │ │
│  │  │              Supabase Client Layer                          │  │ │
│  │  │    (client.ts — browser / client.server.ts — server)        │  │ │
│  │  │                                                             │  │ │
│  │  └──────────────────────────┬──────────────────────────────────┘  │ │
│  │                             │                                      │ │
│  └─────────────────────────────┼──────────────────────────────────────┘ │
│                                │                                         │
└────────────────────────────────┼─────────────────────────────────────────┘
                                 │
                                 │
                                 ▼
                ┌────────────────────────────────┐
                │                                │
                │       Supabase (PostgreSQL)    │
                │                                │
                │  ┌──────────────────────────┐  │
                │  │      conversations        │  │
                │  │  • id (uuid, PK)         │  │
                │  │  • line_user_id          │  │
                │  │  • display_name          │  │
                │  │  • picture_url           │  │
                │  │  • last_message_at       │  │
                │  │  • last_message_text     │  │
                │  │  • unread_count          │  │
                │  └────────────┬─────────────┘  │
                │               │ 1:N             │
                │  ┌────────────▼─────────────┐  │
                │  │       messages            │  │
                │  │  • id (uuid, PK)         │  │
                │  │  • conversation_id (FK)  │  │
                │  │  • direction (in/out)    │  │
                │  │  • message_type          │  │
                │  │  • text                  │  │
                │  │  • line_message_id       │  │
                │  └──────────────────────────┘  │
                │                                │
                │  ┌──────────────────────────┐  │
                │  │      broadcasts           │  │
                │  │  • id (uuid, PK)         │  │
                │  │  • text                  │  │
                │  │  • status (sent/failed)  │  │
                │  │  • error                 │  │
                │  └──────────────────────────┘  │
                │                                │
                │  ┌──────────────────────────┐  │
                │  │   Realtime Subscription  │  │
                │  │  (postgres_changes)      │  │
                │  └──────────────────────────┘  │
                │                                │
                └───────────────┬────────────────┘
                                │
                                │ Supabase Realtime
                                │ (postgres_changes)
                                ▼
                ┌───────────────────────────────┐
                │                               │
                │     Browser Client            │
                │     (TanStack Query)          │
                │                               │
                │  • Auto-refetch on change     │
                │  • Optimistic UI updates      │
                │  • Scroll to latest           │
                │                               │
                └───────────────────────────────┘
```

## Data Flows

### 1. Inbound Message Flow

```
LINE User → LINE Platform → Webhook → Verify Signature → Supabase INSERT → Realtime → Client Refresh
```

1. Customer sends message to LINE Official Account
2. LINE Platform POSTs webhook event to `/api/public/line-webhook`
3. Server verifies HMAC-SHA256 signature using `LINE_CHANNEL_SECRET`
4. Server fetches user profile from LINE API (`displayName`, `pictureUrl`)
5. Server upserts `conversations` record and inserts `messages` record in Supabase
6. Supabase Realtime broadcasts `postgres_changes` to connected clients
7. TanStack Query invalidates cache and re-fetches updated data

### 2. Outbound Reply Flow

```
Agent (UI) → Server Function → LINE API (Push) → LINE Platform → LINE User
```

1. Agent selects conversation and types reply in the inbox UI
2. Client calls `replyToConversation` server function
3. Server validates input and fetches `line_user_id` from Supabase
4. Server calls LINE Push Message API (`POST /v2/bot/message/push`)
5. Server inserts outbound `messages` record and updates `conversations`
6. Client refreshes message list

### 3. Broadcast Flow

```
Agent (UI) → Server Function → LINE API (Broadcast) → All LINE Followers
```

1. Agent composes message in the Broadcast page
2. Client calls `sendBroadcast` server function
3. Server calls LINE Broadcast API (`POST /v2/bot/message/broadcast`)
4. Server records broadcast result (`sent` or `failed`) in `broadcasts` table
5. Client shows updated broadcast history
