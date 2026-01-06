import { Edit3, Save, Loader } from "lucide-react";

export function PlayBlockItem({
  block,
  isEditing,
  onEdit,
  onSave,
  onCancel,
  onUpdate,
  loading,
}) {
  return (
    <div className="border border-[#E6E6E6] dark:border-[#333333] rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className={`w-4 h-4 rounded-full ${block.color}`}></div>
          <h4 className="text-lg font-semibold text-black dark:text-white font-sora">
            {block.name}
          </h4>
        </div>
        <button
          onClick={onEdit}
          className="p-2 hover:bg-[#F5F5F5] dark:hover:bg-[#2A2A2A] rounded-lg transition-colors"
        >
          <Edit3 className="w-4 h-4 text-[#6F6F6F] dark:text-[#AAAAAA]" />
        </button>
      </div>

      {isEditing ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-black dark:text-white mb-2 font-opensans">Target Duration (minutes)</label>
            <input
              type="number"
              value={block.target_min}
              onChange={(e) => onUpdate("target_min", parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-[#E6E6E6] dark:border-[#333333] rounded-lg bg-white dark:bg-[#1E1E1E] text-black dark:text-white text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-black dark:text-white mb-2 font-opensans">BPM Min</label>
            <input
              type="number"
              value={block.bpm_min}
              onChange={(e) => onUpdate("bpm_min", parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-[#E6E6E6] dark:border-[#333333] rounded-lg bg-white dark:bg-[#1E1E1E] text-black dark:text-white text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-black dark:text-white mb-2 font-opensans">BPM Max</label>
            <input
              type="number"
              value={block.bpm_max}
              onChange={(e) => onUpdate("bpm_max", parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-[#E6E6E6] dark:border-[#333333] rounded-lg bg-white dark:bg-[#1E1E1E] text-black dark:text-white text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-black dark:text-white mb-2 font-opensans">Energy Min (0-1)</label>
            <input
              type="number"
              step="0.01" min="0" max="1"
              value={block.energy_min}
              onChange={(e) => onUpdate("energy_min", parseFloat(e.target.value))}
              className="w-full px-3 py-2 border border-[#E6E6E6] dark:border-[#333333] rounded-lg bg-white dark:bg-[#1E1E1E] text-black dark:text-white text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-black dark:text-white mb-2 font-opensans">Energy Max (0-1)</label>
            <input
              type="number"
              step="0.01" min="0" max="1"
              value={block.energy_max}
              onChange={(e) => onUpdate("energy_max", parseFloat(e.target.value))}
              className="w-full px-3 py-2 border border-[#E6E6E6] dark:border-[#333333] rounded-lg bg-white dark:bg-[#1E1E1E] text-black dark:text-white text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-black dark:text-white mb-2 font-opensans">Prefer Instrumental</label>
            <button
              onClick={() => onUpdate("prefer_instrumental", !block.prefer_instrumental)}
              className={`w-full px-3 py-2 rounded-lg border text-sm transition-colors ${
                block.prefer_instrumental
                  ? "bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-600 text-green-700 dark:text-green-300"
                  : "bg-white dark:bg-[#1E1E1E] border-[#E6E6E6] dark:border-[#333333] text-black dark:text-white"
              }`}
            >
              {block.prefer_instrumental ? "Yes" : "No"}
            </button>
          </div>
          <div className="md:col-span-2 lg:col-span-3 flex space-x-3">
            <button onClick={onSave} disabled={loading} className="flex items-center space-x-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-all duration-150 active:scale-95 disabled:opacity-50">
              {loading ? (<Loader className="w-4 h-4 animate-spin" />) : (<Save className="w-4 h-4" />)}
              <span>Save Changes</span>
            </button>
            <button onClick={onCancel} className="px-4 py-2 bg-[#F5F5F5] dark:bg-[#2A2A2A] text-[#4D4D4D] dark:text-[#B0B0B0] rounded-lg hover:bg-[#EEEEEE] dark:hover:bg-[#333333] transition-colors">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-[#6F6F6F] dark:text-[#AAAAAA] font-opensans">Duration:</span>
            <div className="font-semibold text-black dark:text-white">{block.target_min} min</div>
          </div>
          <div>
            <span className="text-[#6F6F6F] dark:text-[#AAAAAA] font-opensans">BPM:</span>
            <div className="font-semibold text-black dark:text-white">{block.bpm_min}-{block.bpm_max}</div>
          </div>
          <div>
            <span className="text-[#6F6F6F] dark:text-[#AAAAAA] font-opensans">Energy:</span>
            <div className="font-semibold text-black dark:text-white">{block.energy_min}-{block.energy_max}</div>
          </div>
          <div>
            <span className="text-[#6F6F6F] dark:text-[#AAAAAA] font-opensans">Instrumental:</span>
            <div className="font-semibold text-black dark:text-white">{block.prefer_instrumental ? "Preferred" : "No preference"}</div>
          </div>
        </div>
      )}
    </div>
  );
}
