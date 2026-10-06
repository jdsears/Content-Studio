# Content Studio

Social media drafting, approval and scheduling for two workspaces:

- **MoonBoots**: John's personal brand.
- **Touchline**: the all-in-one grassroots football app. Touchline HQ's marketing agent, Marcus, sends approved posts here and they schedule themselves.

Posts are written with Claude, published through Publer (LinkedIn, Facebook, Instagram; X is copy and paste), and the whole app sits behind one admin password.

## How it fits together

| Part | What it does |
| --- | --- |
| `src/App.jsx` | The React app shell: login, navigation (sidebar on desktop, bottom bar on phones) and page routing |
| `src/pages/` | Home, Create, Schedule (list and calendar), Graphics, Insights, Settings |
| `src/studio.jsx` | What the pages share: workspaces, posts, preferences and the actions on them |
| `src/components/` | Shared pieces: buttons, cards, post cards, platform previews, toasts |
| `src/index.css` | Each workspace's colours and font (MoonBoots by default; Touchline navy and Inter, with green as the accent) |
| `server.js` | Express server: serves the app, the API, and talks to Claude and Publer |
| `server/auth.js` | Admin login (one password) and workspace API keys |
| `server/store.js` | Saves settings and posts to a Railway Volume, or Supabase if configured |
| `server/claude.js` | The Claude models and how replies are read |
| `server/publer.js` | Every Publer call, with plain-English errors |
| `server/posts.js` | Every post (drafts written here, Touchline HQ, the API): approval, scheduling, retries, confirming they went live |
| `server/engagement.js` | Likes, comments, shares and reach from Publer's analytics, every few hours |
| `server/images.js` | Post images, kept as files in the Volume (or their own Supabase rows), not inside the store |
| `server/schedule.js` | Posting slots in UK time |
| `server/cards.js` | Branded Touchline image cards made on the server |
| `shared/brand.js` | Touchline content checks and UTM tags (used by server and app) |

## Railway variables

| Variable | Needed | What it is |
| --- | --- | --- |
| `ADMIN_PASSWORD` | Yes | The password for the app. Changing it logs everyone out. |
| `ANTHROPIC_API_KEY` | Yes | Claude key for writing posts (`CLAUDE_API_KEY` also works). |
| `TOUCHLINE_API_KEY` | For Touchline HQ | The key Marcus sends as `Authorization: Bearer <key>`. |
| `MOONBOOTS_API_KEY` | No | Only if something outside the app posts to MoonBoots. |
| `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` | No | Use Supabase for storage instead of a Volume. Run `supabase/content_studio_store.sql` first. |

Storage: attach a Railway Volume (mount path `/data`). Railway tells the app where it is. Settings, keys, posts (drafts included) and images all live there. Without a Volume or Supabase, they are lost on every deploy; `/api/health` shows `"persistent": false` when that is the case. Drafts used to be kept in the browser; any still there are moved to the server the next time the app opens.

Engagement numbers in Insights come from Publer's analytics. They need a Publer Business plan and an API key made with the **Analytics** permission ticked (a key's permissions can't be changed later, so make a new one if needed). Facebook Pages, Instagram business accounts and LinkedIn pages have numbers; LinkedIn profiles and X give little or none.

Publer keys are not Railway variables. Paste each workspace's key in **Settings, Publer** (with that workspace selected). It is checked with Publer before it is saved, and only its last 4 characters are ever shown.

## Claude models

Set in one place, `server/claude.js`:

- `claude-sonnet-5-5` writes posts and image card headlines.
- `claude-opus-5-5` suggests topics.

## Touchline HQ API

All calls need `Authorization: Bearer <TOUCHLINE_API_KEY>`. The workspace comes from the key.

### `POST /api/posts`

```json
{ "platform": "linkedin", "content": "...", "pillar": "Parents",
  "generateImage": true, "imageStyle": "white", "scheduleFor": "2026-10-12T08:00:00Z",
  "source": "marcus-cmo" }
```

Posts are already approved in Touchline HQ, so they schedule themselves: at `scheduleFor` if given, otherwise the next free Touchline posting slot (UK time). `platform` is `linkedin`, `facebook`, `instagram` or `x`. With `generateImage`, the server makes a branded Touchline card: the white Touchline mark on navy. `imageStyle` is accepted but no longer changes the card.

Reply: `id`, `status`, `platform`, `publishedAt`, `scheduledFor`, `platformPostId`, `postUrl`, and `error` when something went wrong.

### `GET /api/posts?status=published&limit=50`

Returns every post for the key's workspace, including drafts written in Content Studio (`source: "studio"`). `posts[]` has `id`, `platform`, `content`, `pillar`, `status`, `source`, `publishedAt`, `scheduledFor`, `platformPostId` (Publer's post id), `postUrl` (the live post, when Publer gives it), `image`, `metrics` (`likes`, `comments`, `shares`, plus `reach`, `engagement` and more once Publer has them), `engagement` (the same numbers, or null), `error`, `createdAt`.

### Statuses

| Status | Meaning |
| --- | --- |
| `queued` | Saved here, not yet accepted by Publer. Retried every few minutes. |
| `scheduled` | Publer accepted it for its posting time. |
| `published` | Publer reports it live. Only these come back for `status=published`. |
| `failed` | Publer refused it, or never confirmed it live within 24 hours. |
| `cancelled` | Cancelled in Schedule (and deleted from Publer). |
| `pending` | A draft written in Content Studio, or a post sent through `/api/v1`, waiting for approval in Schedule. |
| `approved` | Approved to post by hand (X, or a workspace without a Publer key). Marked `published` once posted. |
| `rejected` | A draft turned down in Schedule. It can go back to approvals. |

Fields are only ever added to these replies, never renamed or removed.

The older `/api/v1/content/*` routes (generate, submit, queue, analytics, delete) still work with the same key. Their posts wait for approval in Schedule.

`GET /api/health` is public and reports whether storage is working and permanent.

## Touchline content rules

Built into the Touchline prompt, and checked on every Touchline post in Create and Schedule (warnings only; the text is never changed):

- No em dashes, en dashes or spaced hyphens used as dashes.
- Never "the only" or "the first", FA Charter Standard or England Football Accredited endorsement, Atlas player tracking, a native app, or time savings we can't prove.
- Examples use the invented club Wicklewood Wanderers, never real children or clubs.

Links to `touchline.xyz/register` get `utm_source=<platform>`, `utm_medium=organic_social` and `utm_campaign=<pillar>` when published, unless they already have UTM tags.

## Running it

```bash
npm install
npm run build
ADMIN_PASSWORD=choose-one npm start   # http://localhost:3000
npm test                              # API, scheduling, brand and card tests
```

`npm run dev` runs the Vite dev server for the app only; the API needs `npm start`.
