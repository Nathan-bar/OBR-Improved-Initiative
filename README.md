# OBR Initiative Table View

An Owlbear Rodeo extension display for an Improved Initiative encounter. When embedded in Owlbear Rodeo, the GM enters the Custom Encounter ID from Improved Initiative and the app connects to that Player View over Socket.IO. It renders the active combatant, their portrait, and the next combatant on deck. When opened directly in a browser, it uses a local demo encounter.

## Run locally

```bash
npm install
npm run dev
```

The app is also available as a production build with `npm run build`.

## Owlbear SDK integration

The app uses `@owlbear-rodeo/sdk` and waits for `OBR.onReady`. The settings control stores the GM's Custom Encounter ID in Owlbear room metadata under `com.obr-initiative.settings`. The app uses `socket.io-client` to connect to `https://improvedinitiative.app`, emits `join encounter`, and listens for Improved Initiative's `encounter updated` events. During local development, Vite proxies the initial `/playerviews/{encounterId}` snapshot through `/ii-api`. Production uses `VITE_PLAYER_VIEW_API_URL` because the Improved Initiative REST endpoint does not allow browser CORS requests from the OBR extension origin.

The incoming Improved Initiative state has this shape:

```json
{
  "encounterState": {
    "ActiveCombatantId": "vex",
    "RoundCounter": 4,
    "Combatants": [
      {
        "Id": "vex",
        "Name": "Vex",
        "Initiative": 22,
        "ImageURL": "https://example.com/vex.png",
        "Color": "#e07a5f"
      }
    ]
  }
}
```

The SDK dependency is installed from the official package: `@owlbear-rodeo/sdk`.

## Host on GitHub Pages

This repository includes a GitHub Actions workflow that builds and deploys the extension to GitHub Pages. After the first successful deployment, the Owlbear manifest URL will be:

`https://nathan-bar.github.io/OBR-Improved-Initiative/manifest.json`

Add that manifest URL to Owlbear Rodeo. GitHub Pages serves the built Vite app over HTTPS, which avoids the mixed-content issues of the local HTTP development server.

### Production CORS relay

GitHub Pages is static and cannot proxy the initial Improved Initiative request. The included `worker/` directory contains a Cloudflare Worker relay. Deploy it with Wrangler:

```bash
cd worker
npx wrangler login
npx wrangler deploy
```

Set the GitHub Actions repository variable `VITE_PLAYER_VIEW_API_URL` to the Worker URL, for example `https://obr-initiative-relay.<your-subdomain>.workers.dev`, then rerun the Pages deployment. The hosted extension will request `/playerviews/{encounterId}` from the Worker, which adds CORS headers and fetches the data server-side.

## Test inside Owlbear Rodeo

1. Start the Vite server:

```bash
npm run dev -- --host 0.0.0.0
```

2. Open your Owlbear Rodeo room and open the Extensions manager.
3. Choose **Add Extension** and enter the manifest URL:

`http://localhost:5173/manifest.json`

If Owlbear is running on another device, use the network URL printed by Vite instead of `localhost`. Both devices must be able to reach the development computer. 4. Launch **Initiative Table View** from the Owlbear extensions menu. 5. Click the gear button in the extension, enter the Custom Encounter ID from the Improved Initiative Player View, and choose **Connect**. 6. In Improved Initiative, advance the encounter. The extension should update when the Player View emits `encounter updated`.

The Custom Encounter ID is stored in the current Owlbear room, so each room can use a different Improved Initiative encounter. The direct browser page remains in demo mode because the Owlbear SDK is unavailable outside an Owlbear host.
