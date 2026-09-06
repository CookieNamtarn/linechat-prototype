# Flex Message Templates — Production Control

Flex Message JSON templates for the 3-state production order cards.

---

## State 1: ASSIGNED (New Order)

Sent to worker when planner creates a new production order.

```json
{
  "type": "flex",
  "altText": "คำสั่งผลิตใหม่: Product A",
  "contents": {
    "type": "bubble",
    "header": {
      "type": "box",
      "layout": "vertical",
      "contents": [
        {
          "type": "text",
          "text": "📋 คำสั่งผลิตใหม่",
          "weight": "bold",
          "size": "lg",
          "color": "#1A73E8"
        }
      ],
      "backgroundColor": "#E8F0FE"
    },
    "body": {
      "type": "box",
      "layout": "vertical",
      "contents": [
        {
          "type": "box",
          "layout": "vertical",
          "contents": [
            { "type": "text", "text": "สินค้า", "size": "xs", "color": "#666666" },
            { "type": "text", "text": "Product A", "weight": "bold", "size": "md" }
          ],
          "margin": "md"
        },
        {
          "type": "box",
          "layout": "horizontal",
          "contents": [
            {
              "type": "box",
              "layout": "vertical",
              "contents": [
                { "type": "text", "text": "จำนวน", "size": "xs", "color": "#666666" },
                { "type": "text", "text": "1,200 pcs", "weight": "bold" }
              ],
              "flex": 1
            },
            {
              "type": "box",
              "layout": "vertical",
              "contents": [
                { "type": "text", "text": "เครื่อง", "size": "xs", "color": "#666666" },
                { "type": "text", "text": "Machine-01", "weight": "bold" }
              ],
              "flex": 1
            }
          ],
          "margin": "md"
        },
        {
          "type": "box",
          "layout": "vertical",
          "contents": [
            { "type": "text", "text": "เวลาวางแผน", "size": "xs", "color": "#666666" },
            { "type": "text", "text": "08:00 - 16:00 น." }
          ],
          "margin": "md"
        },
        {
          "type": "separator",
          "margin": "lg"
        },
        {
          "type": "text",
          "text": "กดปุ่มเพื่อเริ่มผลิต",
          "size": "sm",
          "color": "#666666",
          "align": "center",
          "margin": "md"
        }
      ]
    },
    "footer": {
      "type": "box",
      "layout": "vertical",
      "contents": [
        {
          "type": "button",
          "action": {
            "type": "postback",
            "label": "▶️ เริ่มผลิต",
            "data": "action=start&order_id={order_id}",
            "displayText": "เริ่มผลิต"
          },
          "style": "primary",
          "color": "#06C755"
        },
        {
          "type": "button",
          "action": {
            "type": "postback",
            "label": "⚠️ แจ้งปัญหา",
            "data": "action=report_problem&order_id={order_id}",
            "displayText": "แจ้งปัญหา"
          },
          "style": "secondary",
          "margin": "md"
        }
      ]
    }
  }
}
```

---

## State 2: IN PROGRESS

Updated card after worker taps "เริ่มผลิต".

```json
{
  "type": "flex",
  "altText": "กำลังผลิต: Product A",
  "contents": {
    "type": "bubble",
    "header": {
      "type": "box",
      "layout": "vertical",
      "contents": [
        {
          "type": "text",
          "text": "🔄 กำลังผลิต",
          "weight": "bold",
          "size": "lg",
          "color": "#FFFFFF"
        }
      ],
      "backgroundColor": "#1A73E8"
    },
    "body": {
      "type": "box",
      "layout": "vertical",
      "contents": [
        {
          "type": "box",
          "layout": "vertical",
          "contents": [
            { "type": "text", "text": "สินค้า", "size": "xs", "color": "#666666" },
            { "type": "text", "text": "Product A", "weight": "bold", "size": "md" }
          ],
          "margin": "md"
        },
        {
          "type": "box",
          "layout": "horizontal",
          "contents": [
            {
              "type": "box",
              "layout": "vertical",
              "contents": [
                { "type": "text", "text": "จำนวน", "size": "xs", "color": "#666666" },
                { "type": "text", "text": "1,200 pcs", "weight": "bold" }
              ],
              "flex": 1
            },
            {
              "type": "box",
              "layout": "vertical",
              "contents": [
                { "type": "text", "text": "เครื่อง", "size": "xs", "color": "#666666" },
                { "type": "text", "text": "Machine-01", "weight": "bold" }
              ],
              "flex": 1
            }
          ],
          "margin": "md"
        },
        {
          "type": "box",
          "layout": "horizontal",
          "contents": [
            {
              "type": "box",
              "layout": "vertical",
              "contents": [
                { "type": "text", "text": "เวลาเริ่ม", "size": "xs", "color": "#666666" },
                { "type": "text", "text": "08:05 น.", "weight": "bold", "color": "#06C755" }
              ],
              "flex": 1
            },
            {
              "type": "box",
              "layout": "vertical",
              "contents": [
                { "type": "text", "text": "เวลาผ่านไป", "size": "xs", "color": "#666666" },
                { "type": "text", "text": "0:45:30", "weight": "bold", "color": "#1A73E8" }
              ],
              "flex": 1
            }
          ],
          "margin": "md"
        },
        {
          "type": "separator",
          "margin": "lg"
        },
        {
          "type": "text",
          "text": "กดปุ่มเมื่อผลิตเสร็จ",
          "size": "sm",
          "color": "#666666",
          "align": "center",
          "margin": "md"
        }
      ]
    },
    "footer": {
      "type": "box",
      "layout": "vertical",
      "contents": [
        {
          "type": "button",
          "action": {
            "type": "uri",
            "label": "✅ ผลิตเสร็จสิ้น",
            "uri": "https://liff.line.me/{LIFF_ID}/complete?order_id={order_id}"
          },
          "style": "primary",
          "color": "#06C755"
        },
        {
          "type": "button",
          "action": {
            "type": "uri",
            "label": "⚠️ แจ้งปัญหา",
            "uri": "https://liff.line.me/{LIFF_ID}/downtime?order_id={order_id}"
          },
          "style": "secondary",
          "margin": "md"
        }
      ]
    }
  }
}
```

---

## State 3: COMPLETED

Updated card after worker submits OK/NG via LIFF.

```json
{
  "type": "flex",
  "altText": "ผลิตเสร็จแล้ว: Product A",
  "contents": {
    "type": "bubble",
    "header": {
      "type": "box",
      "layout": "vertical",
      "contents": [
        {
          "type": "text",
          "text": "✅ ผลิตเสร็จสิ้น",
          "weight": "bold",
          "size": "lg",
          "color": "#FFFFFF"
        }
      ],
      "backgroundColor": "#06C755"
    },
    "body": {
      "type": "box",
      "layout": "vertical",
      "contents": [
        {
          "type": "box",
          "layout": "vertical",
          "contents": [
            { "type": "text", "text": "สินค้า", "size": "xs", "color": "#666666" },
            { "type": "text", "text": "Product A", "weight": "bold", "size": "md" }
          ],
          "margin": "md"
        },
        {
          "type": "box",
          "layout": "horizontal",
          "contents": [
            {
              "type": "box",
              "layout": "vertical",
              "contents": [
                { "type": "text", "text": "เวลาเริ่ม", "size": "xs", "color": "#666666" },
                { "type": "text", "text": "08:05 น." }
              ],
              "flex": 1
            },
            {
              "type": "box",
              "layout": "vertical",
              "contents": [
                { "type": "text", "text": "เวลาจบ", "size": "xs", "color": "#666666" },
                { "type": "text", "text": "15:30 น." }
              ],
              "flex": 1
            }
          ],
          "margin": "md"
        },
        {
          "type": "box",
          "layout": "horizontal",
          "contents": [
            {
              "type": "box",
              "layout": "vertical",
              "contents": [
                { "type": "text", "text": "รวมเวลา", "size": "xs", "color": "#666666" },
                { "type": "text", "text": "7:25:00" }
              ],
              "flex": 1
            },
            {
              "type": "box",
              "layout": "vertical",
              "contents": [
                { "type": "text", "text": "จำนวน", "size": "xs", "color": "#666666" },
                { "type": "text", "text": "1,200 pcs" }
              ],
              "flex": 1
            }
          ],
          "margin": "md"
        },
        {
          "type": "separator",
          "margin": "md"
        },
        {
          "type": "box",
          "layout": "horizontal",
          "contents": [
            {
              "type": "box",
              "layout": "vertical",
              "contents": [
                { "type": "text", "text": "OK", "size": "xs", "color": "#666666" },
                { "type": "text", "text": "1,180", "weight": "bold", "size": "lg", "color": "#06C755" }
              ],
              "flex": 1,
              "alignItems": "center"
            },
            {
              "type": "box",
              "layout": "vertical",
              "contents": [
                { "type": "text", "text": "NG", "size": "xs", "color": "#666666" },
                { "type": "text", "text": "20", "weight": "bold", "size": "lg", "color": "#EA4335" }
              ],
              "flex": 1,
              "alignItems": "center"
            },
            {
              "type": "box",
              "layout": "vertical",
              "contents": [
                { "type": "text", "text": "Yield", "size": "xs", "color": "#666666" },
                { "type": "text", "text": "98.3%", "weight": "bold", "size": "lg", "color": "#1A73E8" }
              ],
              "flex": 1,
              "alignItems": "center"
            }
          ],
          "margin": "md"
        }
      ]
    }
  }
}
```

---

## State 4: DOWNTIME

Updated card when worker reports a problem.

```json
{
  "type": "flex",
  "altText": "หยุดผลิตชั่วคราว: Product A",
  "contents": {
    "type": "bubble",
    "header": {
      "type": "box",
      "layout": "vertical",
      "contents": [
        {
          "type": "text",
          "text": "⚠️ หยุดผลิตชั่วคราว",
          "weight": "bold",
          "size": "lg",
          "color": "#FFFFFF"
        }
      ],
      "backgroundColor": "#EA4335"
    },
    "body": {
      "type": "box",
      "layout": "vertical",
      "contents": [
        {
          "type": "box",
          "layout": "vertical",
          "contents": [
            { "type": "text", "text": "สินค้า", "size": "xs", "color": "#666666" },
            { "type": "text", "text": "Product A", "weight": "bold", "size": "md" }
          ],
          "margin": "md"
        },
        {
          "type": "box",
          "layout": "horizontal",
          "contents": [
            {
              "type": "box",
              "layout": "vertical",
              "contents": [
                { "type": "text", "text": "เครื่อง", "size": "xs", "color": "#666666" },
                { "type": "text", "text": "Machine-01" }
              ],
              "flex": 1
            },
            {
              "type": "box",
              "layout": "vertical",
              "contents": [
                { "type": "text", "text": "สาเหตุ", "size": "xs", "color": "#666666" },
                { "type": "text", "text": "เครื่องเสีย", "weight": "bold", "color": "#EA4335" }
              ],
              "flex": 1
            }
          ],
          "margin": "md"
        },
        {
          "type": "box",
          "layout": "horizontal",
          "contents": [
            {
              "type": "box",
              "layout": "vertical",
              "contents": [
                { "type": "text", "text": "เวลาเริ่ม Downtime", "size": "xs", "color": "#666666" },
                { "type": "text", "text": "10:30 น.", "weight": "bold" }
              ],
              "flex": 1
            },
            {
              "type": "box",
              "layout": "vertical",
              "contents": [
                { "type": "text", "text": "ระยะเวลา", "size": "xs", "color": "#666666" },
                { "type": "text", "text": "12:30", "weight": "bold", "color": "#EA4335" }
              ],
              "flex": 1
            }
          ],
          "margin": "md"
        },
        {
          "type": "separator",
          "margin": "lg"
        },
        {
          "type": "text",
          "text": "ระบบได้แจ้งเตือนทีม Maintenance แล้ว",
          "size": "sm",
          "color": "#666666",
          "align": "center",
          "margin": "md",
          "wrap": true
        }
      ]
    },
    "footer": {
      "type": "box",
      "layout": "vertical",
      "contents": [
        {
          "type": "button",
          "action": {
            "type": "postback",
            "label": "🔄 กลับมาผลิตต่อ",
            "data": "action=resume&order_id={order_id}",
            "displayText": "กลับมาผลิตต่อ"
          },
          "style": "primary",
          "color": "#06C755"
        }
      ]
    }
  }
}
```

---

## Admin Downtime Alert (Sent to LINE Group)

```
🚨 แจ้งปัญหาการผลิต
────────────────────
เครื่อง: Machine-01
สินค้า: Product A
ผู้แจ้ง: Worker Name
สาเหตุ: เครื่องเสีย (Breakdown)
เวลา: 10:30 น.
────────────────────
กดลิงก์เพื่อดูรายละเอียด: https://linechat-prototype.lovable.app/dashboard
```

---

## Implementation Notes

### Dynamic Content

All `{order_id}` and `{LIFF_ID}` placeholders are replaced server-side before sending.

### Flex Message Update (Reply Token)

When a worker taps a postback button, the webhook event includes a `replyToken`. Use it to update the original Flex Message:

```typescript
// Reply with updated Flex Message
await fetch("https://api.line.me/v2/bot/message/reply", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${channelToken}`,
  },
  body: JSON.stringify({
    replyToken: event.replyToken,
    messages: [flexMessage],
  }),
});
```

### LIFF URI Button

For LIFF pages, use `uri` action type with the LIFF URL format:
```
https://liff.line.me/{LIFF_ID}/{path}?order_id={order_id}
```

### Color Scheme

| State | Header Color | Meaning |
|---|---|---|
| ASSIGNED | Blue (#1A73E8) | New order, waiting to start |
| IN PROGRESS | Blue (#1A73E8) | Actively running |
| COMPLETED | Green (#06C755) | Successfully finished |
| DOWNTIME | Red (#EA4335) | Problem, needs attention |
