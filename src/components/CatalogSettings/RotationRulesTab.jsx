import { Save, Loader } from "lucide-react";

export function RotationRulesTab({
  rotationRules,
  setRotationRules,
  handleSaveRotationRules,
  loading,
}) {
  return (
    <div className="space-y-6">
      <h3 className="text-xl font-bold text-black dark:text-white font-bricolage">
        Rotation Rules
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-black dark:text-white mb-2 font-opensans">
            Track Cooldown (days)
          </label>
          <input
            type="number"
            value={rotationRules.track_cooldown_days || 7}
            onChange={(e) => setRotationRules({ ...rotationRules, track_cooldown_days: parseInt(e.target.value) })}
            className="w-full px-4 py-2 border border-[#E6E6E6] dark:border-[#333333] rounded-lg bg-white dark:bg-[#1E1E1E] text-black dark:text-white"
          />
          <p className="text-xs text-[#6F6F6F] dark:text-[#AAAAAA] mt-1 font-opensans">
            Minimum days before a track can be played again
          </p>
        </div>
        <div>
          <label className="block text-sm font-medium text-black dark:text-white mb-2 font-opensans">
            Artist Cooldown (minutes)
          </label>
          <input
            type="number"
            value={rotationRules.artist_cooldown_min || 30}
            onChange={(e) => setRotationRules({ ...rotationRules, artist_cooldown_min: parseInt(e.target.value) })}
            className="w-full px-4 py-2 border border-[#E6E6E6] dark:border-[#333333] rounded-lg bg-white dark:bg-[#1E1E1E] text-black dark:text-white"
          />
          <p className="text-xs text-[#6F6F6F] dark:text-[#AAAAAA] mt-1 font-opensans">
            Minimum minutes between tracks from the same artist
          </p>
        </div>
        <div>
          <label className="flex items-center space-x-3">
            <input
              type="checkbox"
              checked={rotationRules.exclude_explicit || false}
              onChange={(e) => setRotationRules({ ...rotationRules, exclude_explicit: e.target.checked })}
              className="w-4 h-4 text-blue-600 border-[#E6E6E6] dark:border-[#333333] rounded focus:ring-blue-500"
            />
            <span className="text-sm font-medium text-black dark:text-white font-opensans">Exclude Explicit Content</span>
          </label>
        </div>
        <div>
          <label className="flex items-center space-x-3">
            <input
              type="checkbox"
              checked={rotationRules.normalize_loudness || false}
              onChange={(e) => setRotationRules({ ...rotationRules, normalize_loudness: e.target.checked })}
              className="w-4 h-4 text-blue-600 border-[#E6E6E6] dark:border-[#333333] rounded focus:ring-blue-500"
            />
            <span className="text-sm font-medium text-black dark:text-white font-opensans">Normalize Loudness</span>
          </label>
        </div>
      </div>
      <button
        onClick={handleSaveRotationRules}
        disabled={loading.rules}
        className="flex items-center space-x-2 px-6 py-3 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-all duration-150 active:scale-95 disabled:opacity-50"
      >
        {loading.rules ? <Loader className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
        <span>{loading.rules ? "Saving..." : "Save Rules"}</span>
      </button>
    </div>
  );
}
