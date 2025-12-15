# Anniversary RSVP Website

This project includes:
- A pretty RSVP website (`/public`) that matches your invite style
- A simple Node.js server with SQLite storage (`server.js`)
- An admin page to view/export RSVPs (`/admin`)

## Option A (Easiest): No-backend (email RSVPs to you)
If you don't want to run a server, use a form service like **Formspree**:
1. Create a Formspree form and copy your endpoint URL (looks like `https://formspree.io/f/XXXXXXX`)
2. In `public/index.html`, add this **above** `<script src="app.js"></script>`:

```html
<script>
  window.RSVP_ENDPOINT = "https://formspree.io/f/XXXXXXX";
  // window.RSVP_HEALTH = ""; // optional
</script>
```

Then host the `public/` folder anywhere (Netlify, Vercel static, GitHub Pages).

## Option B: Full backend (saves RSVPs + admin page)

### 1) Install + run
```bash
npm install
# copy env
cp .env.example .env
# edit .env and set ADMIN_PASSWORD
npm start
```

Open:
- RSVP site: `http://localhost:3000`
- Admin page: `http://localhost:3000/admin`

Username is **admin**, password is whatever you set in `.env`.

### 2) Deploy
You can deploy this to Render / Railway / Fly.io etc.
Make sure to set environment variable `ADMIN_PASSWORD`.

## Add your invite video
Put your file here:
- `public/assets/invite.mp4` (recommended) OR
- `public/assets/invite.mov`

The page already includes a `<video>` tag that will show it.

## Customize the event info
Edit these in `public/index.html`:
- Date, time, venue, dress code
- RSVP-by date
- Address + Google Maps link
- Contact phone

## Notes
- SQLite database file defaults to `rsvps.sqlite` next to `server.js`
- You can export RSVPs as CSV from the admin page
