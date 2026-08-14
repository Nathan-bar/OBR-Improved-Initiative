import { useEffect, useState } from "react";
import OBR from "@owlbear-rodeo/sdk";
import { io } from "socket.io-client";
import "./App.css";

const ROOM_METADATA_KEY = "com.obr-initiative.settings";
const IMPROVED_INITIATIVE_URL = "https://improvedinitiative.app";
const PLAYER_VIEW_API_URL = import.meta.env.DEV ? "/ii-api" : IMPROVED_INITIATIVE_URL;
const SPLASH_POPOVER_ID = "obr-initiative-turn-splash";
const isSplashView = new URLSearchParams(window.location.search).get("view") === "splash";

const demoCombatants = [
  {
    name: "Vex",
    role: "Rogue",
    initiative: 22,
    color: "#e07a5f",
    image: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=320&q=85",
    hp: "36/36",
    hpColor: "#8fb996",
    tags: [],
  },
  {
    name: "Thalia",
    role: "Cleric",
    initiative: 18,
    color: "#d7a84a",
    image: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=320&q=85",
    hp: "27/27",
    hpColor: "#8fb996",
    tags: [],
  },
  {
    name: "Garruk",
    role: "Fighter",
    initiative: 16,
    color: "#8fb996",
    image: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=320&q=85",
    hp: "32/32",
    hpColor: "#8fb996",
    tags: [],
  },
  {
    name: "Ashen Drake",
    role: "Dragon",
    initiative: 14,
    color: "#b982e0",
    image: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=320&q=85",
    hp: "68/68",
    hpColor: "#8fb996",
    tags: [],
  },
  {
    name: "Mira",
    role: "Wizard",
    initiative: 11,
    color: "#75a9d8",
    image: "https://images.unsplash.com/photo-1531123897727-8f129e1688ce?auto=format&fit=crop&w=320&q=85",
    hp: "24/24",
    hpColor: "#8fb996",
    tags: [],
  },
];

function normalizeCombatants(payload) {
  const entries =
    payload?.encounterState?.Combatants ?? payload?.combatants ?? payload?.initiativeOrder ?? payload?.order;
  if (!Array.isArray(entries)) return null;

  const normalized = entries
    .map((entry, index) => {
      const rawHp = String(entry.HPDisplay ?? entry.hp ?? entry.hitPoints ?? "");
      const hpMarkup = rawHp.match(/class=['"]([^'"]+)['"][^>]*>([^<]+)</i);
      const hpState = hpMarkup?.[1]?.replace(/HP$/i, "").toLowerCase() || "numeric";
      const hpLabel = hpMarkup?.[2]?.trim() || rawHp.replace(/<[^>]+>/g, "").trim();
      const tags = Array.isArray(entry.Tags)
        ? entry.Tags.filter((tag) => !tag.Hidden)
            .map((tag) => tag.Text ?? tag.Name ?? tag.name ?? "")
            .filter(Boolean)
        : [];

      return {
        id: String(entry.Id ?? entry.id ?? entry.uuid ?? entry.name ?? index),
        name: entry.Name ?? entry.name ?? entry.label ?? `Unit ${index + 1}`,
        role: entry.IsPlayerCharacter ? "Player Character" : (entry.role ?? entry.type ?? "Combatant"),
        initiative: Number(entry.Initiative ?? entry.initiative ?? entry.score ?? 0),
        color: entry.Color ?? entry.color ?? "#d7a84a",
        image: entry.ImageURL ?? entry.image ?? entry.imageUrl ?? entry.avatar ?? entry.portrait ?? "",
        hp: hpLabel,
        hpState,
        hpColor: entry.HPColor ?? entry.hpColor ?? "#8fb996",
        tags,
      };
    })
    .filter((entry) => entry.name);

  return normalized.length > 0 ? normalized : null;
}

function getCurrentIndex(payload, entries) {
  const encounterState = payload?.encounterState ?? payload;
  if (Number.isInteger(payload?.currentIndex)) return payload.currentIndex;
  const currentId =
    encounterState?.ActiveCombatantId ?? payload?.currentId ?? payload?.current?.id ?? payload?.current?.uuid;
  if (currentId != null) {
    const index = entries.findIndex((entry) => entry.id === String(currentId));
    if (index >= 0) return index;
  }
  return 0;
}

async function openSplashPopover() {
  if (!OBR.isAvailable || isSplashView) return;
  const [viewportWidth, viewportHeight] = await Promise.all([OBR.viewport.getWidth(), OBR.viewport.getHeight()]);
  OBR.popover
    .open({
      id: SPLASH_POPOVER_ID,
      url: `${window.location.origin}/?view=splash`,
      width: 820,
      height: 280,
      anchorReference: "POSITION",
      anchorPosition: { left: viewportWidth / 2, top: viewportHeight / 2 },
      anchorOrigin: { horizontal: "CENTER", vertical: "CENTER" },
      transformOrigin: { horizontal: "CENTER", vertical: "CENTER" },
      hidePaper: true,
      disableClickAway: true,
    })
    .catch((error) => console.error("[OBR Initiative] Could not open splash popover.", error));
}

function App() {
  const [combatants, setCombatants] = useState(demoCombatants);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [round, setRound] = useState(4);
  const [, setEncounterName] = useState("THE SUNKEN ARCHIVE");
  const [encounterId, setEncounterId] = useState("");
  const [syncLabel, setSyncLabel] = useState("DEMO MODE");
  const [showSettings, setShowSettings] = useState(false);
  const [settingsValue, setSettingsValue] = useState("");
  const [hiddenSplashTurn, setHiddenSplashTurn] = useState(null);
  const [brokenImages, setBrokenImages] = useState(new Set());
  const [theme, setTheme] = useState({
    background: { default: "#101318", paper: "#171b20" },
    text: { primary: "#e7e6df", secondary: "#8d9495" },
    primary: { main: "#d7a84a" },
  });
  const current = combatants[currentIndex] ?? demoCombatants[0];
  const onDeck = combatants[(currentIndex + 1) % combatants.length] ?? current;
  const turnNumber = round;
  const currentTurnKey = `${current.id}:${round}`;

  useEffect(() => {
    if (!isSplashView) return undefined;
    document.documentElement.classList.add("splash-mode");
    document.body.classList.add("splash-mode");
    return () => {
      document.documentElement.classList.remove("splash-mode");
      document.body.classList.remove("splash-mode");
    };
  }, []);

  useEffect(() => {
    if (!OBR.isAvailable) {
      console.info("[OBR Initiative] Running outside Owlbear Rodeo; using demo mode.");
      return undefined;
    }
    let cancelled = false;
    let stopMetadata;
    let stopTheme;

    OBR.onReady(async () => {
      if (cancelled) return;
      console.info("[OBR Initiative] Owlbear SDK ready.");
      try {
        const currentTheme = await OBR.theme.getTheme();
        if (!cancelled) setTheme(currentTheme);
        stopTheme = OBR.theme.onChange((nextTheme) => setTheme(nextTheme));
        const metadata = await OBR.room.getMetadata();
        const savedSettings = metadata[ROOM_METADATA_KEY];
        const savedId = typeof savedSettings?.encounterId === "string" ? savedSettings.encounterId : "";
        if (!cancelled) {
          setEncounterId(savedId);
          setSettingsValue(savedId);
          setSyncLabel(savedId ? "CONNECTING" : "SETUP REQUIRED");
          console.info(`[OBR Initiative] Encounter ID loaded: ${savedId || "none"}.`);
        }
        stopMetadata = OBR.room.onMetadataChange((nextMetadata) => {
          const nextSettings = nextMetadata[ROOM_METADATA_KEY];
          if (typeof nextSettings?.encounterId === "string") {
            setEncounterId(nextSettings.encounterId);
            setSettingsValue(nextSettings.encounterId);
          }
          const metadataName = nextMetadata["com.owlbear.rodeo.room.name"];
          if (typeof metadataName === "string" && metadataName) setEncounterName(metadataName.toUpperCase());
        });
      } catch {
        if (!cancelled) setSyncLabel("OBR ROOM UNAVAILABLE");
      }
    });

    return () => {
      cancelled = true;
      stopMetadata?.();
      stopTheme?.();
    };
  }, []);

  useEffect(() => {
    if (!encounterId) return undefined;
    let cancelled = false;
    const socket = io(IMPROVED_INITIATIVE_URL, { transports: ["websocket"] });
    const applyEncounter = (encounterState) => {
      const entries = normalizeCombatants({ encounterState });
      if (!entries || cancelled) return;
      console.info("[OBR Initiative] Encounter update received.", {
        activeCombatantId: encounterState.ActiveCombatantId,
        round: encounterState.RoundCounter,
        combatants: entries.length,
        activeImage: entries.find((entry) => entry.id === String(encounterState.ActiveCombatantId))?.image || "none",
      });
      setCombatants(entries);
      setBrokenImages(new Set());
      setCurrentIndex(Math.min(getCurrentIndex({ encounterState }, entries), entries.length - 1));
      if (Number.isFinite(Number(encounterState.RoundCounter))) setRound(Number(encounterState.RoundCounter));
      setSyncLabel("LIVE SYNC");
      openSplashPopover();
    };
    const loadEncounter = async () => {
      try {
        const response = await fetch(`${PLAYER_VIEW_API_URL}/playerviews/${encodeURIComponent(encounterId)}`);
        if (!response.ok) {
          if (!cancelled) setSyncLabel(response.status === 404 ? "ENCOUNTER NOT FOUND" : "INITIATIVE SERVER ERROR");
          return;
        }
        const playerView = await response.json();
        if (playerView.encounterState) applyEncounter(playerView.encounterState);
        else if (!cancelled) setSyncLabel("EMPTY ENCOUNTER");
      } catch (error) {
        if (!cancelled) setSyncLabel(error instanceof TypeError ? "FETCH BLOCKED" : "CONNECTION ERROR");
      }
    };
    socket.on("connect", () => {
      console.info(`[OBR Initiative] Connected to Improved Initiative for ${encounterId}.`);
      socket.emit("join encounter", encounterId);
      loadEncounter();
    });
    socket.on("encounter updated", applyEncounter);
    socket.on("disconnect", () => {
      if (!cancelled) setSyncLabel("DISCONNECTED");
    });
    socket.on("connect_error", (error) => {
      console.error("[OBR Initiative] Improved Initiative websocket error.", error.message);
      if (!cancelled) setSyncLabel("CONNECTION ERROR");
    });
    return () => {
      cancelled = true;
      socket.disconnect();
    };
  }, [encounterId]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setHiddenSplashTurn(currentTurnKey), 3000);
    return () => window.clearTimeout(timeoutId);
  }, [currentTurnKey]);

  const saveSettings = async (event) => {
    event.preventDefault();
    const nextId = settingsValue.trim();
    setEncounterId(nextId);
    setShowSettings(false);
    if (!OBR.isAvailable) return;
    OBR.onReady(async () => {
      try {
        await OBR.room.setMetadata({ [ROOM_METADATA_KEY]: { encounterId: nextId } });
      } catch {
        setSyncLabel("OBR SAVE FAILED");
      }
    });
  };

  const markImageBroken = (image) => setBrokenImages((previous) => new Set(previous).add(image));
  const imageIsAvailable = current.image && !brokenImages.has(current.image);
  const onDeckImageIsAvailable = onDeck.image && !brokenImages.has(onDeck.image);
  const themeStyle = {
    "--obr-background": theme.background.default,
    "--obr-paper": theme.background.paper,
    "--obr-text-primary": theme.text.primary,
    "--obr-text-secondary": theme.text.secondary,
    "--obr-primary": theme.primary.main,
  };

  if (isSplashView) {
    return (
      <div className="splash-viewport" style={themeStyle}>
        {hiddenSplashTurn !== currentTurnKey && (
          <div className="turn-splash" key={currentTurnKey} role="status">
            <div className="splash-card" style={{ "--accent": current.color }}>
              <div className="splash-portrait">
                {imageIsAvailable && (
                  <img
                    src={current.image}
                    alt=""
                    referrerPolicy="no-referrer"
                    onError={() => markImageBroken(current.image)}
                  />
                )}
                {!imageIsAvailable && <span>{current.name[0]}</span>}
              </div>
              <div className="splash-copy">
                <span className="eyebrow">CURRENT PLAYER · TURN {String(turnNumber).padStart(2, "0")}</span>
                <h2>{current.name}</h2>
                <p>
                  {current.role}
                  <span className={`splash-hp hp-${current.hpState}`} style={{ "--hp-color": current.hpColor }}>
                    {current.hp}
                  </span>
                </p>
                {current.tags.length > 0 && (
                  <div className="splash-conditions">
                    {current.tags.map((tag) => (
                      <span className="condition-chip" key={tag}>
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="splash-divider" />
              <div className="splash-deck">
                <div className="deck-splash-portrait">
                  {onDeckImageIsAvailable && (
                    <img
                      src={onDeck.image}
                      alt=""
                      referrerPolicy="no-referrer"
                      onError={() => markImageBroken(onDeck.image)}
                    />
                  )}
                  {!onDeckImageIsAvailable && <span>{onDeck.name[0]}</span>}
                </div>
                <span className="eyebrow">ON DECK</span>
                <b>{onDeck.name}</b>
                <small>
                  {onDeck.role}
                  <span className={`deck-hp hp-${onDeck.hpState}`} style={{ "--hp-color": onDeck.hpColor }}>
                    {onDeck.hp}
                  </span>
                </small>
                {onDeck.tags.length > 0 && (
                  <div className="splash-conditions">
                    {onDeck.tags.map((tag) => (
                      <span className="condition-chip" key={tag}>
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <main className="app-shell" style={themeStyle}>
      <header className="topbar">
        <div className="tracker-status">
          <span className={`live-dot ${syncLabel === "LIVE SYNC" ? "is-live" : ""}`} />
          <span>{syncLabel}</span>
        </div>
        <div className="round-meta">
          <span>ROUND</span>
          <b>{String(round).padStart(2, "0")}</b>
          <button
            type="button"
            className="settings-button"
            onClick={() => setShowSettings(true)}
            aria-label="Open extension settings"
          >
            ⚙
          </button>
        </div>
      </header>

      {showSettings && (
        <div className="settings-backdrop">
          <form className="settings-panel" onSubmit={saveSettings}>
            <span className="eyebrow">GM SETTINGS</span>
            <h2>Connect Encounter</h2>
            <p>Enter the Custom Encounter ID from the Player View.</p>
            <label htmlFor="encounter-id">Custom Encounter ID</label>
            <input
              id="encounter-id"
              value={settingsValue}
              onChange={(event) => setSettingsValue(event.target.value)}
              placeholder="e.g. my-campaign-encounter"
              autoFocus
            />
            <div className="settings-actions">
              <button type="button" onClick={() => setShowSettings(false)}>
                Cancel
              </button>
              <button type="submit">Connect</button>
            </div>
          </form>
        </div>
      )}

      <section className="content-grid">
        <aside className="initiative-panel">
          <details className="initiative-dropdown" open>
            <summary className="panel-heading">
              <span>
                <h1>Initiative</h1>
              </span>
              <span className="count-label">
                {combatants.length} COMBATANTS <b className="dropdown-chevron">⌄</b>
              </span>
            </summary>
            <div className="initiative-list">
              {combatants.map((combatant, index) => (
                <button
                  type="button"
                  className={`initiative-row ${index === currentIndex ? "active" : ""}`}
                  key={combatant.name}
                  onClick={() => setCurrentIndex(index)}
                  aria-label={`Show ${combatant.name}'s turn`}
                >
                  <span className="order-number">{String(index + 1).padStart(2, "0")}</span>
                  <span className="combatant-name">
                    <b>{combatant.name}</b>
                    <small>{combatant.role}</small>
                    {combatant.tags.length > 0 && (
                      <span className="condition-list">
                        {combatant.tags.map((tag) => (
                          <span className="condition-chip" key={tag}>
                            {tag}
                          </span>
                        ))}
                      </span>
                    )}
                  </span>
                  <span className={`combatant-hp hp-${combatant.hpState}`} style={{ "--hp-color": combatant.hpColor }}>
                    {combatant.hp || "—"}
                  </span>
                  <span className="initiative-score">{combatant.initiative}</span>
                  {index === currentIndex && <span className="active-marker">NOW</span>}
                </button>
              ))}
            </div>
          </details>
        </aside>
      </section>
      <footer className="status-bar">
        <span>OBR INITIATIVE BRIDGE</span>
        <span>
          DISPLAY MODE <b>●</b>
        </span>
      </footer>
    </main>
  );
}

export default App;
