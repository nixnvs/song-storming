import { Save, Loader, CheckCircle, RefreshCw, X, ExternalLink } from "lucide-react";

export function ExportSettingsTab({
  exportSettings,
  setExportSettings,
  handleSaveExportSettings,
  loading,
}) {
  return (
    <div className="space-y-6">
      <h3 className="text-xl font-bold text-black dark:text-white font-bricolage">
        Export & Integration Settings
      </h3>

      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-black dark:text-white mb-2 font-opensans">
            Export Target
          </label>
          <select
            value={exportSettings.export_target || "csv"}
            onChange={(e) => setExportSettings({ ...exportSettings, export_target: e.target.value })}
            className="w-full px-4 py-2 border border-[#E6E6E6] dark:border-[#333333] rounded-lg bg-white dark:bg-[#1E1E1E] text-black dark:text-white"
          >
            <option value="csv">CSV Files</option>
            <option value="spotify">Spotify Playlists</option>
            <option value="m3u">M3U Playlists</option>
          </select>
        </div>

        {exportSettings.export_target === "spotify" && (
          <div className="space-y-4">
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <h4 className="font-semibold text-blue-800 dark:text-blue-200 mb-2 font-bricolage">
                Spotify Integration
              </h4>
              {exportSettings.spotify_auth_token ? (
                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                    <span className="text-green-700 dark:text-green-300 font-opensans">
                      Connected to Spotify
                    </span>
                  </div>
                  <p className="text-blue-700 dark:text-blue-300 text-sm font-opensans">
                    Your restaurant playlists will be automatically created as private playlists in your Spotify account with the format "{`{date}`} {`{block}`} (Test)".
                  </p>
                  <div className="flex space-x-3">
                    <button onClick={() => window.open("/api/auth/spotify?action=login", "_blank")} className="flex items-center space-x-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-all duration-150 text-sm">
                      <RefreshCw className="w-4 h-4" />
                      <span>Reconnect</span>
                    </button>
                    <button onClick={() => setExportSettings({ ...exportSettings, spotify_auth_token: null, spotify_refresh_token: null })} className="flex items-center space-x-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-all duration-150 text-sm">
                      <X className="w-4 h-4" />
                      <span>Disconnect</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-blue-700 dark:text-blue-300 font-opensans">
                    Connect your Spotify account to automatically create playlists for testing. Playlists will be created as private with names like "2024-08-13 Lunch (Test)".
                  </p>
                  <button onClick={() => window.open("/api/auth/spotify?action=login", "_blank")} className="flex items-center space-x-2 px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-all duration-150 active:scale-95">
                    <ExternalLink className="w-5 h-5" />
                    <span className="font-opensans">Connect Spotify Account</span>
                  </button>
                </div>
              )}
            </div>
            <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
              <h4 className="font-semibold text-orange-800 dark:text-orange-200 mb-2 font-bricolage">
                Required Spotify Permissions
              </h4>
              <ul className="text-orange-700 dark:text-orange-300 text-sm font-opensans space-y-1">
                <li>• Create private playlists</li>
                <li>• Add tracks to playlists</li>
                <li>• Read your profile information</li>
              </ul>
            </div>
          </div>
        )}

        {(exportSettings.export_target === "csv" || exportSettings.export_target === "m3u") && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-black dark:text-white mb-2 font-opensans">Export Directory</label>
              <input
                type="text"
                value={exportSettings.csv_directory || ""}
                onChange={(e) => setExportSettings({ ...exportSettings, csv_directory: e.target.value })}
                placeholder="/path/to/export/directory"
                className="w-full px-4 py-2 border border-[#E6E6E6] dark:border-[#333333] rounded-lg bg-white dark:bg-[#1E1E1E] text-black dark:text-white"
              />
              <p className="text-xs text-[#6F6F6F] dark:text-[#AAAAAA] mt-1 font-opensans">
                Files will be saved with format: YYYY-MM-DD_block.{exportSettings.export_target}
              </p>
            </div>
            <div className="bg-[#F8F9FA] dark:bg-[#2A2A2A] rounded-lg p-4">
              <h4 className="font-semibold text-black dark:text-white mb-2 font-bricolage">
                {exportSettings.export_target === "csv" ? "CSV" : "M3U"} Format Details
              </h4>
              {exportSettings.export_target === "csv" ? (
                <div className="text-sm text-[#6F6F6F] dark:text-[#AAAAAA] font-opensans">
                  <p className="mb-2">CSV columns:</p>
                  <code className="bg-white dark:bg-[#1E1E1E] px-2 py-1 rounded text-xs">position,artist,title,uri,durationSec,dateISO,block</code>
                </div>
              ) : (
                <div className="text-sm text-[#6F6F6F] dark:text-[#AAAAAA] font-opensans">
                  <p className="mb-2">M3U format:</p>
                  <code className="bg-white dark:bg-[#1E1E1E] px-2 py-1 rounded text-xs block">
                    #EXTM3U<br />
                    #EXTINF:duration,artist - title<br />
                    uri/path
                  </code>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <button
        onClick={handleSaveExportSettings}
        disabled={loading.export_settings}
        className="flex items-center space-x-2 px-6 py-3 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-all duration-150 active:scale-95 disabled:opacity-50"
      >
        {loading.export_settings ? <Loader className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
        <span>{loading.export_settings ? "Saving..." : "Save Settings"}</span>
      </button>
    </div>
  );
}
