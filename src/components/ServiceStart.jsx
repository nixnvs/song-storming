import { useState, useEffect } from "react";
import {
  Play,
  Download,
  ExternalLink,
  AlertTriangle,
  CheckCircle,
  Loader,
  Headphones,
} from "lucide-react";

// Keep ONLY this import from your spotify utils
import { createDailyBlockPlaylist } from "@/utils/spotifyAuth";
import Card from "./ui/Card";
import Button from "./ui/Button";
import Chip from "./ui/Chip";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

export default function ServiceStart() {
  // ---------- state ----------
  const [loading, setLoading] = useState({});
  const [errors, setErrors] = useState({});
  const [catalogHealth, setCatalogHealth] = useState(null);
  const [generatedPlaylists, setGeneratedPlaylists] = useState({});
  const [spotifyPlaylists, setSpotifyPlaylists] = useState({});
  const [isSpotifyConnected, setIsSpotifyConnected] = useState(false);
  const [spotifyUser, setSpotifyUser] = useState(null);
  const [checkingSpotify, setCheckingSpotify] = useState(false);
  const [toast, setToast] = useState(null);

  // ---------- constants ----------
  const blocks = [
    { name: "Lunch", color: "bg-spotify-green", time: "12:00 PM - 2:30 PM" },
    { name: "Dinner", color: "bg-[#EFB62B]", time: "7:00 PM - 10:00 PM" },
    { name: "Late", color: "bg-[#A45CFF]", time: "10:00 PM - 12:00 AM" },
  ];
  const today = new Date().toISOString().split("T")[0];

  // ---------- lifecycle ----------
  useEffect(() => {
    checkCatalogHealth();
    checkExistingPlaylists();

    // check session immediately
    checkSpotifyConnection();

    // If we just came back from /api/auth/callback, we might have "#connected=1"
    if (window.location.hash.includes("connected=1")) {
      const t = setInterval(() => {
        checkSpotifyConnection().then((ok) => {
          if (ok) {
            clearInterval(t);
            // clean URL
            history.replaceState({}, document.title, window.location.pathname);
          }
        });
      }, 30000);
      return () => clearInterval(t);
    }

    // (optional) look for query messages
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get("spotify_connected")) {
      showToast("Spotify connected successfully!", "success");
      history.replaceState({}, document.title, window.location.pathname);
    }
    if (urlParams.get("error")) {
      showToast(
        `Error: ${decodeURIComponent(urlParams.get("error"))}`,
        "error"
      );
      history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  // ---------- data fetchers ----------
  const checkCatalogHealth = async () => {
    try {
      const r = await fetch("/api/tracks");
      const j = await r.json();
      setCatalogHealth(j);
    } catch (err) {
      console.error("Error checking catalog:", err);
    }
  };

  const checkExistingPlaylists = async () => {
    try {
      const r = await fetch(`${API_URL}/api/playlists?date=${today}`,{
        credentials: "include",
      });
      const j = await r.json();
      if (j.playlists) {
        const existing = {};
        j.playlists.forEach((pl) => {
          existing[pl.block_name] = pl;
        });
        setGeneratedPlaylists(existing);
      }
    } catch (err) {
      console.error("Error checking existing playlists:", err);
    }
  };

  // ---------- auth: ask our API (port 5177) for session (/api/me) ----------
  const checkSpotifyConnection = async () => {
    try {
      setCheckingSpotify(true);
      const r = await fetch(`${API_URL}/api/me`, {
        credentials: "include",
      });
      if (!r.ok) throw new Error("no session");
      const j = await r.json();
      if (j?.ok && j.profile) {
        setIsSpotifyConnected(true);
        setSpotifyUser(j.profile);
        return true;
      }
    } catch {
      // not authenticated
    } finally {
      setCheckingSpotify(false);
    }
    setIsSpotifyConnected(false);
    setSpotifyUser(null);
    return false;
  };
  // ---------- generation + spotify creation ----------
  const generateAndCreatePlaylist = async (blockName) => {
    setLoading((s) => ({ ...s, [blockName]: true }));
    setErrors((s) => ({ ...s, [blockName]: null }));
    try {
      // 1) generate locally
      const genResponse = await fetch(`${API_URL}/api/generator`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date_iso: today,
          block_name: blockName,
          force: !!generatedPlaylists[blockName],
        }),
        credentials: "include",
        duplex: "half",
      });
      const genResult = await genResponse.json();
      if (!genResult.success) {
        throw new Error(genResult.error || `Failed to generate ${blockName}`);
      }

      setGeneratedPlaylists((s) => ({ ...s, [blockName]: genResult.playlist }));
      showToast(`${blockName} playlist generated successfully!`, "success");

      // 2) if connected, also create on Spotify
      if (isSpotifyConnected) {
        try {
          const playlistResponse = await fetch(
            `${API_URL}/api/playlists`,{
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                dateISO: today,
                blockName: blockName,
                uris: genResult.playlist.tracks,
              }),
              credentials: "include",
              duplex: "half",
            }
          );
          const playlistData = await playlistResponse.json();

          setSpotifyPlaylists((s) => ({ ...s, [blockName]: playlistData }));
          showToast(`${blockName} created in Spotify!`, "success");
         
        } catch (err) {
          console.error("Spotify playlist creation failed:", err);
          showToast("Spotify sync failed", "warning");
        }
      }
    } catch (err) {
      console.error(`Error generating ${blockName}:`, err);
      setErrors((s) => ({ ...s, [blockName]: err?.message || 'Failed to generate' }));
      showToast(
        `Failed to generate ${blockName} playlist: ${err.message}`,
        "error"
      );
    } finally {
      setLoading((s) => ({ ...s, [blockName]: false }));
    }
  };

  const generateAll = async () => {
    for (const b of blocks) {
      // sequential to reflect state clearly
      // eslint-disable-next-line no-await-in-loop
      await generateAndCreatePlaylist(b.name);
    }
  };

  // ---------- exports ----------
  const exportToCsv = async (blockName) => {
    try {
      const r = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          format: "csv",
          date_iso: today,
          block_name: blockName,
        }),
      });
      if (r.ok) {
        const blob = await r.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${blockName}_${today}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        showToast(`${blockName} CSV downloaded!`, "success");
      }
    } catch (err) {
      console.error("Export to CSV failed:", err);
      showToast("Failed to download CSV", "error");
    }
  };

  // ---------- helpers ----------
  const showToast = (message, type) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const getBlockStatus = (blockName) => {
    const playlist = generatedPlaylists[blockName];
    if (!playlist) return "not_generated";
    return "generated";
  };

  const getCatalogWarning = () => {
    if (!catalogHealth) return null;
    if (catalogHealth.total_tracks < 100) {
      return {
        level: "critical",
        message: `Only ${catalogHealth.total_tracks} tracks in catalog. Import more music for better variety.`,
      };
    }
    if (catalogHealth.total_tracks < 500) {
      return {
        level: "warning",
        message: `${catalogHealth.total_tracks} tracks available. Consider importing more for optimal rotation.`,
      };
    }
    return null;
  };

  const getPlaylistDurationWarning = (playlist) => {
    if (!playlist?.stats) return null;
    const actual = playlist.stats.actual_duration_min;
    const target = playlist.stats.target_duration_min;
    const ratio = actual / target;
    if (ratio < 0.6) {
      return `Only ${Math.round(ratio * 100)}% of target duration. Consider importing more tracks.`;
    }
    return null;
  };

  const catalogWarning = getCatalogWarning();

  const logoutSpotify = async () => {
    try {
      await fetch(`${API_URL}/api/auth/logout`, {
        credentials: "include",
      });
      showToast("Logged out of Spotify", "success");
      setIsSpotifyConnected(false);
      setSpotifyUser(null);
      setSpotifyPlaylists({});
      setGeneratedPlaylists({});
    } catch (err) {
      console.error("Spotify logout failed:", err);
      showToast("Failed to log out of Spotify", "error");
    }
  };

  // ---------- render ----------
  return (
    <div className="space-y-6 md:space-y-8">
      {/* no toasts per spec */}

      {/* Service Bar */}
      <Card className="p-4 md:p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className={`inline-block w-3 h-3 rounded-full ${isSpotifyConnected ? 'bg-spotify-green' : 'bg-spotify-border'}`} />
            <div className="flex flex-col">
              <span className="text-base md:text-lg font-normal">Daily Playlist Service</span>
              <span className="text-sm text-spotify-mute">{new Date().toLocaleDateString()}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 md:gap-3">
            {!isSpotifyConnected ? (
              <Button
                onClick={() => window.open(`${API_URL}/api/auth/login`, "_blank", "noopener")}
                variant="secondary"
                disabled={checkingSpotify}
              >
                <Headphones className="w-4 h-4 mr-2" />
                {checkingSpotify ? "Connecting…" : "Connect"}
              </Button>
            ) : (
              <Button onClick={logoutSpotify} variant="secondary">
                Disconnect
              </Button>
            )}
            <Button onClick={generateAll} className="ml-1">Generate All</Button>
          </div>
        </div>
      </Card>
      {catalogWarning && (
        <Card className="p-4">
          <div className="flex items-start gap-2">
            <AlertTriangle className={`w-4 h-4 ${catalogWarning.level === 'critical' ? 'text-red-400' : 'text-yellow-400'}`} />
            <p className="text-sm text-spotify-mute">{catalogWarning.message}</p>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {blocks.map((block) => {
          const status = getBlockStatus(block.name);
          const playlist = generatedPlaylists[block.name];
          const spotifyPlaylist = spotifyPlaylists[block.name];
          const isLoading = !!loading[block.name];
          const error = errors[block.name];
          const durationWarning = getPlaylistDurationWarning(playlist);

          return (
            <Card key={block.name} className="p-5 md:p-6">
              {/* Header row */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <span className={`inline-block w-3 h-3 rounded-full ${block.color}`} />
                  <div>
                    <div className="text-base md:text-lg font-normal">{block.name}</div>
                    <div className="text-xs text-spotify-mute">{block.time}</div>
                  </div>
                </div>
                <div className="text-xs text-spotify-mute">
                  {status === 'generated' ? (
                    <span className="inline-flex items-center gap-1 text-spotify-text">
                      <CheckCircle className="w-4 h-4 text-spotify-green" />
                      Generated
                    </span>
                  ) : (
                    'Not generated'
                  )}
                </div>
              </div>

              {/* Stats chips */}
              <div className="flex items-center gap-2 mb-4">
                <Chip>Tracks: {playlist?.tracks?.length || 0}</Chip>
                <Chip>Target: {playlist?.stats?.target_duration_min ?? '—'} min</Chip>
                <Chip>Avg energy: {playlist?.stats?.avg_energy ?? '—'}</Chip>
              </div>

              {/* States */}
              {isLoading ? (
                <div className="space-y-2 mb-4">
                  <div className="h-3 bg-[#232323] rounded w-2/3" />
                  <div className="h-3 bg-[#232323] rounded w-1/2" />
                  <div className="h-3 bg-[#232323] rounded w-3/4" />
                </div>
              ) : null}

              {error ? (
                <div className="mb-3 text-sm text-red-400">{error}</div>
              ) : null}

              {status === "generated" && playlist && (
                <div className="space-y-3 mb-4">
                  {durationWarning && (
                    <div className="p-3 bg-[#232323] border border-spotify-border rounded-lg">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-yellow-400 mt-0.5" />
                        <p className="text-sm text-spotify-mute">{durationWarning}</p>
                      </div>
                    </div>
                  )}
                  {spotifyPlaylist && (
                    <div className="p-3 bg-[#232323] border border-spotify-border rounded-lg">
                      <div className="flex items-center gap-2 mb-1">
                        <Headphones className="w-4 h-4 text-spotify-green" />
                        <span className="text-sm text-spotify-text">{spotifyPlaylist.name}</span>
                      </div>
                      <p className="text-xs text-spotify-mute">
                        {spotifyPlaylist.tracksAdded} tracks • {Math.round(spotifyPlaylist.total_duration_min)} min
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  onClick={() => generateAndCreatePlaylist(block.name)}
                  disabled={isLoading || catalogWarning?.level === "critical"}
                >
                  {isLoading ? (
                    <Loader className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Play className="w-4 h-4 mr-2" />
                  )}
                  {status === "generated" ? `Regenerate ${block.name}` : `Generate ${block.name}`}
                </Button>
                {status === "generated" && (
                  <Button variant="secondary" onClick={() => generateAndCreatePlaylist(block.name)}>
                    Regenerate
                  </Button>
                )}
                {status === "generated" && playlist && (
                  <>
                    {(spotifyPlaylist ?? playlist)?.playlistUrl && (
                      <a
                        href={(spotifyPlaylist ?? playlist)?.playlistUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-spotify-mute hover:text-spotify-text text-sm focus:outline-none focus:ring-2 focus:ring-spotify-green rounded-full px-2 py-1"
                      >
                        <span className="inline-flex items-center gap-1"><ExternalLink className="w-4 h-4" /> Open on Spotify</span>
                      </a>
                    )}
                    <button
                      onClick={() => exportToCsv(block.name)}
                      className="text-spotify-mute hover:text-spotify-text text-sm focus:outline-none focus:ring-2 focus:ring-spotify-green rounded-full px-2 py-1"
                    >
                      <span className="inline-flex items-center gap-1"><Download className="w-4 h-4" /> Download CSV</span>
                    </button>
                  </>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4 text-center">
          <div className="text-2xl font-medium">{catalogHealth?.total_tracks || 0}</div>
          <div className="text-spotify-mute text-sm">Total Tracks</div>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-2xl font-medium">{catalogHealth?.unique_artists || 0}</div>
          <div className="text-spotify-mute text-sm">Artists</div>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-2xl font-medium">{Math.round((catalogHealth?.total_duration_hours || 0) * 10) / 10}h</div>
          <div className="text-spotify-mute text-sm">Music Library</div>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-2xl font-medium text-spotify-green">{Object.keys(generatedPlaylists).length}/3</div>
          <div className="text-spotify-mute text-sm">Generated Today</div>
        </Card>
      </div>
    </div>
  );
}
