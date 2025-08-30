import { useState, useEffect } from "react";
import {
  Play,
  Download,
  ExternalLink,
  AlertTriangle,
  Music2,
  Clock,
  CheckCircle,
  Loader,
  Headphones,
  Settings,
} from "lucide-react";
import {
  buildSpotifyAuthUrl,
  createDailyBlockPlaylist,
  checkSpotifyAuth,
} from "@/utils/spotifyAuth";

export default function ServiceStart() {
  const [loading, setLoading] = useState({});
  const [catalogHealth, setCatalogHealth] = useState(null);
  const [generatedPlaylists, setGeneratedPlaylists] = useState({});
  const [spotifyPlaylists, setSpotifyPlaylists] = useState({});
  const [isSpotifyConnected, setIsSpotifyConnected] = useState(false);
  const [spotifyUser, setSpotifyUser] = useState(null);
  const [toast, setToast] = useState(null);

  const blocks = [
    { name: "Lunch", color: "bg-blue-500", time: "12:00 PM - 2:30 PM" },
    { name: "Dinner", color: "bg-orange-500", time: "7:00 PM - 10:00 PM" },
    { name: "Late", color: "bg-purple-500", time: "10:00 PM - 12:00 AM" },
  ];

  const today = new Date().toISOString().split("T")[0];

  useEffect(() => {
    checkCatalogHealth();
    checkExistingPlaylists();
    checkSpotifyConnection();

    // Check for success/error messages in URL params
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get("spotify_connected")) {
      showToast("Spotify connected successfully!", "success");
      // Clean URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
    if (urlParams.get("error")) {
      showToast(
        `Error: ${decodeURIComponent(urlParams.get("error"))}`,
        "error",
      );
      // Clean URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const checkCatalogHealth = async () => {
    try {
      const response = await fetch("/api/tracks");
      const data = await response.json();
      setCatalogHealth(data);
    } catch (error) {
      console.error("Error checking catalog:", error);
    }
  };

  const checkExistingPlaylists = async () => {
    try {
      const response = await fetch(`/api/playlists?date=${today}`);
      const data = await response.json();

      if (data.playlists) {
        const existing = {};
        data.playlists.forEach((playlist) => {
          existing[playlist.block_name] = playlist;
        });
        setGeneratedPlaylists(existing);
      }
    } catch (error) {
      console.error("Error checking existing playlists:", error);
    }
  };

  const checkSpotifyConnection = async () => {
    try {
      const isConnected = await checkSpotifyAuth();
      setIsSpotifyConnected(isConnected);

      if (isConnected) {
        // Get user info
        const response = await fetch("/api/auth/spotify/status");
        const data = await response.json();
        if (data.authenticated && data.user) {
          setSpotifyUser(data.user);
        }
      }
    } catch (error) {
      console.error("Error checking Spotify connection:", error);
    }
  };

  const handleSpotifyConnect = async () => {
    try {
      const authUrl = await buildSpotifyAuthUrl();
      window.location.href = authUrl;
    } catch (error) {
      console.error("Error initiating Spotify auth:", error);
      showToast("Failed to connect to Spotify", "error");
    }
  };

  const generateAndCreatePlaylist = async (blockName) => {
    setLoading({ ...loading, [blockName]: true });

    try {
      // Step 1: Generate playlist
      const genResponse = await fetch("/api/generator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date_iso: today,
          block_name: blockName,
          force: !!generatedPlaylists[blockName], // Force if regenerating
        }),
      });

      const genResult = await genResponse.json();

      if (!genResult.success) {
        throw new Error(
          genResult.error || `Failed to generate ${blockName} playlist`,
        );
      }

      // Update generated playlists state
      setGeneratedPlaylists({
        ...generatedPlaylists,
        [blockName]: genResult.playlist,
      });

      showToast(`${blockName} playlist generated successfully!`, "success");

      // Step 2: Create Spotify playlist if connected
      if (isSpotifyConnected) {
        try {
          // Get track URIs from generated playlist
          const playlistResponse = await fetch(
            `/api/playlists?date=${today}&block=${blockName}`,
          );
          const playlistData = await playlistResponse.json();

          if (playlistData.playlists && playlistData.playlists[0]) {
            const tracks = playlistData.playlists[0].tracks || [];
            const uris = tracks
              .map((track) => track.uri)
              .filter((uri) => uri && uri.startsWith("spotify:"));

            if (uris.length > 0) {
              const spotifyResult = await createDailyBlockPlaylist(
                today,
                blockName,
                uris,
              );

              if (spotifyResult.success) {
                setSpotifyPlaylists({
                  ...spotifyPlaylists,
                  [blockName]: spotifyResult,
                });
                showToast(`${blockName} created in Spotify!`, "success");
              } else {
                console.warn(
                  `Spotify playlist creation failed: ${spotifyResult.error}`,
                );
                showToast(
                  `Generated locally, but Spotify sync failed: ${spotifyResult.error}`,
                  "warning",
                );
              }
            } else {
              showToast(
                `Generated locally, but no Spotify URIs found`,
                "warning",
              );
            }
          }
        } catch (spotifyError) {
          console.error("Spotify playlist creation failed:", spotifyError);
          showToast("Generated locally, but Spotify sync failed", "warning");
        }
      }
    } catch (error) {
      console.error(`Error generating ${blockName}:`, error);
      showToast(
        `Failed to generate ${blockName} playlist: ${error.message}`,
        "error",
      );
    } finally {
      setLoading({ ...loading, [blockName]: false });
    }
  };

  const exportToCsv = async (blockName, playlist) => {
    try {
      const response = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          format: "csv",
          date_iso: today,
          block_name: blockName,
        }),
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${blockName}_${today}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);

        showToast(`${blockName} CSV downloaded!`, "success");
      }
    } catch (error) {
      console.error("Export to CSV failed:", error);
      showToast("Failed to download CSV", "error");
    }
  };

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
    if (!playlist || !playlist.stats) return null;

    const actual = playlist.stats.actual_duration_min;
    const target = playlist.stats.target_duration_min;
    const ratio = actual / target;

    if (ratio < 0.6) {
      return `Only ${Math.round(ratio * 100)}% of target duration. Consider importing more tracks.`;
    }

    return null;
  };

  const catalogWarning = getCatalogWarning();

  return (
    <div className="space-y-6 md:space-y-8">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg ${
            toast.type === "success"
              ? "bg-green-500 text-white"
              : toast.type === "warning"
                ? "bg-orange-500 text-white"
                : "bg-red-500 text-white"
          }`}
        >
          <div className="flex items-center space-x-2">
            {toast.type === "success" ? (
              <CheckCircle className="w-5 h-5" />
            ) : (
              <AlertTriangle className="w-5 h-5" />
            )}
            <span>{toast.message}</span>
          </div>
        </div>
      )}

      {/* Service Header */}
      <div className="bg-white dark:bg-[#1E1E1E] border border-[#E6E6E6] dark:border-[#333333] rounded-xl p-6 md:p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-black dark:text-white mb-4 font-sora">
            Daily Playlist Service
          </h1>
          <p className="text-lg text-[#6F6F6F] dark:text-[#AAAAAA] font-opensans">
            Generate today's restaurant playlists -{" "}
            {new Date().toLocaleDateString()}
          </p>
        </div>

        {/* Spotify Connection Status */}
        <div className="mb-8 p-4 rounded-lg border bg-[#F5F5F5] dark:bg-[#2A2A2A] border-[#E6E6E6] dark:border-[#333333]">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div
                className={`w-4 h-4 rounded-full ${isSpotifyConnected ? "bg-green-500" : "bg-gray-400"}`}
              ></div>
              <div>
                <h4 className="text-lg font-semibold text-black dark:text-white font-bricolage">
                  Spotify Integration
                </h4>
                <p className="text-sm text-[#6F6F6F] dark:text-[#AAAAAA] font-opensans">
                  {isSpotifyConnected
                    ? `Connected as ${spotifyUser?.display_name || "User"}`
                    : "Connect to automatically create Spotify playlists"}
                </p>
              </div>
            </div>
            {!isSpotifyConnected && (
              <button
                onClick={handleSpotifyConnect}
                className="flex items-center space-x-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-all duration-150 font-opensans"
              >
                <Headphones className="w-4 h-4" />
                <span>Connect Spotify</span>
              </button>
            )}
          </div>
        </div>

        {/* Catalog Health Warning */}
        {catalogWarning && (
          <div
            className={`mb-8 p-4 rounded-lg border ${
              catalogWarning.level === "critical"
                ? "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800"
                : "bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800"
            }`}
          >
            <div className="flex items-start space-x-3">
              <AlertTriangle
                className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
                  catalogWarning.level === "critical"
                    ? "text-red-500 dark:text-red-400"
                    : "text-orange-500 dark:text-orange-400"
                }`}
              />
              <div>
                <h4
                  className={`text-lg font-semibold mb-2 font-bricolage ${
                    catalogWarning.level === "critical"
                      ? "text-red-800 dark:text-red-200"
                      : "text-orange-800 dark:text-orange-200"
                  }`}
                >
                  Catalog Health Alert
                </h4>
                <p
                  className={`mb-3 font-opensans ${
                    catalogWarning.level === "critical"
                      ? "text-red-700 dark:text-red-300"
                      : "text-orange-700 dark:text-orange-300"
                  }`}
                >
                  {catalogWarning.message}
                </p>
                <button
                  onClick={() => {
                    /* Navigate to Catalog & Settings */
                  }}
                  className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 font-opensans font-semibold"
                >
                  Import More Music →
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Block Generation Controls */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {blocks.map((block) => {
          const status = getBlockStatus(block.name);
          const playlist = generatedPlaylists[block.name];
          const spotifyPlaylist = spotifyPlaylists[block.name];
          const isLoading = loading[block.name];
          const durationWarning = playlist
            ? getPlaylistDurationWarning(playlist)
            : null;

          return (
            <div
              key={block.name}
              className="bg-white dark:bg-[#1E1E1E] border border-[#E6E6E6] dark:border-[#333333] rounded-xl p-6"
            >
              {/* Block Header */}
              <div className="flex items-center space-x-3 mb-4">
                <div className={`w-4 h-4 rounded-full ${block.color}`}></div>
                <div>
                  <h3 className="text-xl font-bold text-black dark:text-white font-sora">
                    {block.name}
                  </h3>
                  <p className="text-sm text-[#6F6F6F] dark:text-[#AAAAAA] font-opensans">
                    {block.time}
                  </p>
                </div>
              </div>

              {/* Status & Stats */}
              {status === "generated" && playlist && (
                <div className="mb-4 space-y-3">
                  <div className="p-3 bg-[#F5F5F5] dark:bg-[#2A2A2A] rounded-lg">
                    <div className="flex items-center space-x-2 mb-2">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      <span className="text-sm font-semibold text-green-600 dark:text-green-400">
                        Generated
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm text-[#6F6F6F] dark:text-[#AAAAAA]">
                      <div>{playlist.stats?.track_count || 0} tracks</div>
                      <div>{playlist.stats?.actual_duration_min || 0} min</div>
                      <div>Avg {playlist.stats?.avg_bpm || 0} BPM</div>
                      <div>{playlist.stats?.avg_energy || 0} energy</div>
                    </div>
                  </div>

                  {/* Duration Warning */}
                  {durationWarning && (
                    <div className="p-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg">
                      <div className="flex items-start space-x-2">
                        <AlertTriangle className="w-4 h-4 text-orange-500 flex-shrink-0 mt-0.5" />
                        <p className="text-sm text-orange-700 dark:text-orange-300">
                          {durationWarning}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Spotify Playlist Status */}
                  {spotifyPlaylist && (
                    <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                      <div className="flex items-center space-x-2 mb-2">
                        <Headphones className="w-4 h-4 text-green-500" />
                        <span className="text-sm font-semibold text-green-600 dark:text-green-400">
                          {spotifyPlaylist.name}
                        </span>
                      </div>
                      <p className="text-xs text-green-600 dark:text-green-400">
                        {spotifyPlaylist.tracksAdded} tracks •{" "}
                        {spotifyPlaylist.total_duration_min} min
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Generate Button */}
              <button
                onClick={() => generateAndCreatePlaylist(block.name)}
                disabled={isLoading || catalogWarning?.level === "critical"}
                className={`w-full flex items-center justify-center space-x-2 px-4 py-3 rounded-lg font-semibold transition-all duration-150 mb-3 ${
                  status === "generated"
                    ? "bg-[#F5F5F5] dark:bg-[#2A2A2A] border border-[#D9D9D9] dark:border-[#404040] text-[#4D4D4D] dark:text-[#B0B0B0] hover:bg-[#EEEEEE] dark:hover:bg-[#333333]"
                    : "bg-green-500 hover:bg-green-600 dark:bg-green-600 dark:hover:bg-green-700 text-white"
                } ${isLoading || catalogWarning?.level === "critical" ? "opacity-50 cursor-not-allowed" : "active:scale-95"}`}
              >
                {isLoading ? (
                  <Loader className="w-5 h-5 animate-spin" />
                ) : (
                  <Play className="w-5 h-5" />
                )}
                <span>
                  {isLoading
                    ? "Generating..."
                    : status === "generated"
                      ? `Regenerate ${block.name}`
                      : `Generate ${block.name}`}
                </span>
              </button>

              {/* Export Options */}
              {status === "generated" && playlist && (
                <div className="space-y-2">
                  {/* Spotify Link */}
                  {spotifyPlaylist?.playlistUrl && (
                    <a
                      href={spotifyPlaylist.playlistUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-all duration-150"
                    >
                      <ExternalLink className="w-4 h-4" />
                      <span>Open in Spotify</span>
                    </a>
                  )}

                  {/* CSV Download */}
                  <button
                    onClick={() => exportToCsv(block.name, playlist)}
                    className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-[#F5F5F5] dark:bg-[#2A2A2A] border border-[#D9D9D9] dark:border-[#404040] text-[#4D4D4D] dark:text-[#B0B0B0] hover:bg-[#EEEEEE] dark:hover:bg-[#333333] rounded-lg transition-all duration-150"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download CSV</span>
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-[#1E1E1E] border border-[#E6E6E6] dark:border-[#333333] rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-black dark:text-white font-sora">
            {catalogHealth?.total_tracks || 0}
          </div>
          <div className="text-[#6F6F6F] dark:text-[#AAAAAA] font-opensans text-sm">
            Total Tracks
          </div>
        </div>
        <div className="bg-white dark:bg-[#1E1E1E] border border-[#E6E6E6] dark:border-[#333333] rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-black dark:text-white font-sora">
            {catalogHealth?.unique_artists || 0}
          </div>
          <div className="text-[#6F6F6F] dark:text-[#AAAAAA] font-opensans text-sm">
            Artists
          </div>
        </div>
        <div className="bg-white dark:bg-[#1E1E1E] border border-[#E6E6E6] dark:border-[#333333] rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-black dark:text-white font-sora">
            {Math.round((catalogHealth?.total_duration_hours || 0) * 10) / 10}h
          </div>
          <div className="text-[#6F6F6F] dark:text-[#AAAAAA] font-opensans text-sm">
            Music Library
          </div>
        </div>
        <div className="bg-white dark:bg-[#1E1E1E] border border-[#E6E6E6] dark:border-[#333333] rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-green-600 dark:text-green-400 font-sora">
            {Object.keys(generatedPlaylists).length}/3
          </div>
          <div className="text-[#6F6F6F] dark:text-[#AAAAAA] font-opensans text-sm">
            Generated Today
          </div>
        </div>
      </div>
    </div>
  );
}
