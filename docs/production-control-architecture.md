# Production Control System — Full Architecture

## Overview

A LINE OA-powered production control system that replaces traditional shop-floor terminals with workers' existing mobile phones. Production orders are dispatched via LINE Flex Messages, workers update status with single taps, and supervisors get real-time visibility without any new hardware or apps.

---

## System Context

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                                                                 │
│                        PRODUCTION CONTROL SYSTEM                                │
│                                                                                 │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │              │    │              │    │              │    │              │  │
│  │   Planner    │    │   LINE OA    │    │   Worker     │    │   LINE       │  │
│  │   / Admin    │    │   Server     │    │   Mobile     │    │   Admin      │  │
│  │              │    │              │    │              │    │   Group      │  │
│  └──────┬───────┘    └──────┬───────┘    └──────┬───────┘    └──────┬───────┘  │
│         │                   │                   │                   │          │
│         │ Web Form          │ Flex Message      │ Button Tap        │ Alert    │
│         │                   │ + LIFF            │                   │          │
│         │                   │                   │                   │          │
│         └───────────────────┴───────────────────┴───────────────────┘          │
│                                     │                                          │
│                                     ▼                                          │
│                          ┌──────────────────────┐                              │
│                          │                      │                              │
│                          │    Supabase DB       │                              │
│                          │    (PostgreSQL)      │                              │
│                          │                      │                              │
│                          └──────────┬───────────┘                              │
│                                     │                                          │
│                                     ▼                                          │
│                          ┌──────────────────────┐                              │
│                          │    Dashboard         │                              │
│                          │    (Looker/PowerBI)  │                              │
│                          └──────────────────────┘                              │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Component Breakdown

### 1. Planner / Admin Web Form

**Purpose**: Create production orders and assign to machines + workers.

**Fields**:
- Product name / SKU
- Planned quantity
- Machine
- Assigned worker(s)
- Planned start time
- Notes

**Implementation**: React page in the same web app (`/planner`), protected by auth.

**Flow**:
1. Planner fills form → submits
2. System creates `production_orders` record
3. System sends Flex Message to assigned worker via LINE Push API
4. Flex Message shows order details + action buttons

---

### 2. LINE OA Server (Backend)

**Purpose**: Handle all LINE interactions, state transitions, and database operations.

**Key endpoints/functions**:

| Function | Trigger | Action |
|---|---|---|
| `createProductionOrder` | Planner form submit | Insert DB record + send Flex Message |
| `handleProductionAction` | Flex Message button postback | Update state + update Flex Message |
| `recordOutput` | LIFF form submit (OK/NG) | Save quantities + mark completed |
| `reportDowntime` | "Report Problem" button | Save downtime + alert admin group |
| `resolveDowntime` | "Resume" button | Close downtime + resume production |
| `getProductionStatus` | Dashboard query | Return real-time machine status |

**State Machine**:

```
                   ┌─────────────┐
                   │   CREATED   │  ← Planner submits order
                   └──────┬──────┘
                          │
                          │ Flex Message sent to worker
                          ▼
                   ┌─────────────┐
          ┌────────│  ASSIGNED   │────────┐
          │        └─────────────┘        │
          │                               │
    [Start]                         [Problem]
          │                               │
          ▼                               ▼
   ┌─────────────┐                ┌─────────────┐
   │ IN_PROGRESS │───────────────►│  DOWNTIME   │
   └──────┬──────┘   [Problem]   └──────┬──────┘
          │                             │
   [Complete]                      [Resume]
          │                             │
          ▼                             ▼
   ┌─────────────┐                ┌─────────────┐
   │  COMPLETED  │◄───────────────│ IN_PROGRESS │
   └─────────────┘   [Resume]    └─────────────┘
```

---

### 3. Worker Mobile (LINE App)

**Purpose**: Receive production orders, update status, report problems.

**Interaction Flow**:

1. **Receive order** → Flex Message card appears in LINE chat
2. **Start production** → Tap "▶️ เริ่มผลิต" button
   - Flex Message instantly updates: shows start time, button changes to "✅ ผลิตเสร็จสิ้น"
   - Database records `production_event` with `event_type = 'start'`
3. **Complete production** → Tap "✅ ผลิตเสร็จสิ้น"
   - LIFF popup opens with OK/NG input form
   - Worker enters quantities → submits
   - Flex Message updates to COMPLETED state (gray/green, summary shown)
   - Database records completion + quantities
4. **Report problem** → Tap "⚠️ แจ้งปัญหา"
   - LIFF popup opens with downtime reason dropdown
   - Worker selects reason → submits
   - Downtime alert sent to Admin LINE Group
   - Database records downtime start
5. **Resume production** → Tap "🔄 กลับมาผลิตต่อ"
   - Downtime closed, production resumed
   - Database records downtime end + duration

---

### 4. LIFF (LINE Front-end Framework)

**Purpose**: Provide structured input forms inside LINE without leaving the chat.

**Pages**:
- **Complete Form** — OK count, NG count, NG reason dropdown
- **Downtime Report** — Reason selection (machine breakdown, no material, no operator, other)
- **Downtime Resolution** — Confirmation that issue is resolved

**LIFF Setup**:
- Create LIFF app in LINE Developer Console
- Add LIFF_ID to environment variables
- Pages served from `/liff/complete`, `/liff/downtime`

---

### 5. LINE Admin Group (Alerts)

**Purpose**: Real-time downtime escalation to maintenance/supervision team.

**Triggers**:
- Worker reports problem via Flex Message
- Downtime exceeds threshold (e.g., 15 minutes)

**Message format**:
```
🚨 แจ้งปัญหาการผลิต
────────────────────
เครื่อง: Machine-01
สินค้า: Product A
ผู้แจ้ง: Worker Name
สาเหตุ: เครื่องเสีย (Breakdown)
เวลา: 14:35 น.
────────────────────
กดลิงก์เพื่อดูรายละเอียด: [URL]
```

---

### 6. Database (Supabase PostgreSQL)

**Tables**:

| Table | Purpose |
|---|---|
| `machines` | Machine master (id, name, type, location) |
| `workers` | Worker master (id, line_user_id, name, machine_id) |
| `products` | Product master (id, sku, name, target_per_hour) |
| `production_orders` | Production orders from planner |
| `production_events` | State transition log (start, pause, resume, complete) |
| `downtime_logs` | Downtime records (start, end, reason, duration_min) |
| `production_outputs` | Output quantities per order (ok_qty, ng_qty, ng_reason) |
| `downtime_alerts` | Alert tracking (sent_at, acknowledged_at) |

**Realtime subscriptions**:
- `production_orders` — for dashboard live updates
- `production_events` — for real-time status changes
- `downtime_logs` — for active downtime monitoring

---

### 7. Real-time Dashboard

**Purpose**: TV-mounted production floor status board.

**Implementation**: Looker Studio or Power BI connected to Supabase.

**Views**:
- Machine status grid (green=running, red=downtime, gray=idle/completed)
- Output vs Target progress bars
- Active downtime list with elapsed time
- Today's OEE summary

---

## Data Flow Diagrams

### Order Dispatch Flow

```
┌──────────┐    Submit Form    ┌──────────────┐
│          │ ─────────────────►│              │
│ Planner  │                   │   create     │
│ (Web)    │                   │   Production │
│          │                   │   Order()    │
└──────────┘                   │              │
                               │              │
                               └──────┬───────┘
                                      │
                                      │ INSERT
                                      ▼
                               ┌──────────────┐
                               │  production  │
                               │  _orders     │
                               └──────┬───────┘
                                      │
                                      │ Push API call
                                      ▼
                               ┌──────────────┐
                               │  LINE Push   │
                               │  Message     │
                               └──────┬───────┘
                                      │
                                      ▼
                               ┌──────────────┐
                               │   Worker     │
                               │   (LINE App) │
                               └──────────────┘
```

### Production State Transition Flow

```
                    POSTBACK
Worker Tap ──────────────────────────► handleProductionAction()
                                         │
                                         ├─ action = "start"
                                         │   ├─ INSERT production_event (start)
                                         │   ├─ UPDATE order_status = 'in_progress'
                                         │   └─ Reply: Flex Message "In Progress"
                                         │
                                         ├─ action = "complete"
                                         │   ├─ Open LIFF: /liff/complete?order_id=xxx
                                         │   └─ (LIFF submits → recordOutput())
                                         │       ├─ INSERT production_outputs
                                         │       ├─ INSERT production_event (complete)
                                         │       ├─ UPDATE order_status = 'completed'
                                         │       └─ Reply: Flex Message "Completed"
                                         │
                                         ├─ action = "report_problem"
                                         │   ├─ Open LIFF: /liff/downtime?order_id=xxx
                                         │   └─ (LIFF submits → reportDowntime())
                                         │       ├─ INSERT downtime_logs
                                         │       ├─ INSERT production_event (pause)
                                         │       ├─ UPDATE order_status = 'downtime'
                                         │       ├─ Send Admin Group alert
                                         │       └─ Reply: Flex Message "Downtime"
                                         │
                                         └─ action = "resume"
                                             ├─ UPDATE downtime_logs (end_time)
                                             ├─ INSERT production_event (resume)
                                             ├─ UPDATE order_status = 'in_progress'
                                             └─ Reply: Flex Message "In Progress"
```

### Downtime Escalation Flow

```
Worker taps "⚠️ แจ้งปัญหา"
         │
         ▼
LIFF: Select reason → Submit
         │
         ▼
reportDowntime()
         │
         ├──► INSERT downtime_logs (start_time, reason, machine_id)
         ├──► UPDATE production_orders.status = 'downtime'
         ├──► Send Flex Message back to worker (updated card)
         │
         └──► Send LINE Group alert to Admin
              │
              ├──► LINE Group: Maintenance team
              ├──► LINE Group: Supervisor
              └──► INSERT downtime_alerts (sent_at)
                        │
                        ▼ (If > 15 min unresolved)
                   Send reminder to Admin Group
```

---

## Security Model

| Concern | Solution |
|---|---|
| LINE credentials | Environment variables (never client-side) |
| Webhook signature | HMAC-SHA256 verification (existing) |
| Planner form auth | Supabase auth (admin role required) |
| LIFF token validation | LINE JWT verification on LIFF endpoints |
| CSRF protection | TanStack Start CSRF middleware |
| RLS policies | Service role for server ops, authenticated read for dashboard |

---

## Environment Variables

| Variable | Scope | Purpose |
|---|---|---|
| `LINE_CHANNEL_ACCESS_TOKEN` | Server | LINE API calls (push, reply, multicast) |
| `LINE_CHANNEL_SECRET` | Server | Webhook signature verification |
| `LINE_LIFF_ID` | Server + Client | LIFF app identifier |
| `LINE_ADMIN_GROUP_ID` | Server | Target group for downtime alerts |
| `SUPABASE_URL` | Both | Database URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Server | Admin DB access |
| `VITE_SUPABASE_URL` | Client | Browser DB access |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Client | Browser DB access |

---

## Deployment Topology

```
                         ┌─────────────────────┐
                         │    CDN / Edge       │
                         │  (Lovable/Vercel)   │
                         └──────────┬──────────┘
                                    │
                         ┌──────────▼──────────┐
                         │                     │
                         │  TanStack Start     │
                         │  Server             │
                         │                     │
                         │  ┌───────────────┐  │
                         │  │  SSR Router   │  │
                         │  │  Server Fns   │  │
                         │  │  LIFF Pages   │  │
                         │  └───────────────┘  │
                         │                     │
                         └──────────┬──────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    │               │               │
                    ▼               ▼               ▼
             ┌──────────┐   ┌──────────┐   ┌──────────┐
             │ Supabase │   │   LINE   │   │  LINE    │
             │ (DB)     │   │ Messaging│   │  Admin   │
             │          │   │  API     │   │  Group   │
             └──────────┘   └──────────┘   └──────────┘
                    │               │               │
                    ▼               ▼               ▼
             ┌──────────┐   ┌──────────┐   ┌──────────┐
             │Dashboard │   │ Worker   │   │ Admin    │
             │(Looker)  │   │ Mobile   │   │ Mobile   │
             └──────────┘   └──────────┘   └──────────┘
```

---

## Scalability Considerations

| Scenario | Current | Scale-up |
|---|---|---|
| Concurrent workers | < 100 | LINE push API limit: 1000/min |
| Orders per day | < 500 | Flex Message quota: 1000/month free, then paid |
| Database | Supabase free tier | Upgrade to Pro for more connections |
| Realtime | 100 concurrent | Supabase Realtime: 500 concurrent free |
| Dashboard | Looker Studio | Direct DB connection for sub-second refresh |

---

## Development Roadmap

### Phase 1: MVP (Week 1-2)
- [ ] Database schema (production_orders, production_events)
- [ ] Planner form (create orders)
- [ ] Flex Message dispatch to worker
- [ ] Basic state transitions (start → complete)
- [ ] Simple OK/NG input via LIFF

### Phase 2: Full Flow (Week 3-4)
- [ ] 3-state Flex Message cards
- [ ] Downtime reporting + Admin group alerts
- [ ] Downtime resolution flow
- [ ] Worker master data
- [ ] Machine master data

### Phase 3: Dashboard & Reports (Week 5-6)
- [ ] Real-time machine status dashboard
- [ ] OEE calculation
- [ ] Daily production report
- [ ] Downtime analysis

### Phase 4: Polish (Ongoing)
- [ ] Multi-language support
- [ ] Push notification reminders
- [ ] Historical data export
- [ ] Advanced analytics
