import { Upload, Loader } from "lucide-react";

const importTypes = [
  { id: "artist", label: "Artist Name", placeholder: "Enter artist name..." },
  { id: "playlist", label: "Playlist URL", placeholder: "https://open.spotify.com/playlist/..." },
  { id: "csv", label: "CSV Upload", placeholder: "Select CSV file..." },
];

export function ImportMusicTab({
  importType,
  setImportType,
  importValue,
  setImportValue,
  uploadFile,
  setUploadFile,
  handleImport,
  loading,
}) {
  return (
    <div className="space-y-6">
      <h3 className="text-xl font-bold text-black dark:text-white font-bricolage">
        Import Music to Catalog
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {importTypes.map((type) => (
          <button
            key={type.id}
            onClick={() => setImportType(type.id)}
            className={`p-4 border rounded-lg text-left transition-all ${
              importType === type.id
                ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                : "border-[#E6E6E6] dark:border-[#333333] hover:border-[#D0D0D0] dark:hover:border-[#404040]"
            }`}
          >
            <div className="font-semibold text-black dark:text-white font-opensans">
              {type.label}
            </div>
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {importType === "csv" ? (
          <div className="bg-[#F8F9FA] dark:bg-[#2A2A2A] rounded-lg p-6 text-center">
            <div className="mb-4">
              <Upload className="w-12 h-12 text-[#6F6F6F] dark:text-[#AAAAAA] mx-auto" />
            </div>
            <h4 className="font-semibold text-black dark:text-white mb-2 font-bricolage">
              Upload CSV File
            </h4>
            <p className="text-[#6F6F6F] dark:text-[#AAAAAA] font-opensans mb-4">
              CSV should have columns: title, artist, uri, duration_sec, bpm,
              energy, instrumental, explicit
            </p>
            <label className={`inline-block px-6 py-3 border-2 border-dashed border-[#D9D9D9] dark:border-[#404040] rounded-lg cursor-pointer hover:border-[#B0B0B0] dark:hover:border-[#505050] transition-all duration-150 ${loading.import ? "opacity-50 cursor-not-allowed" : ""}`}>
              <input
                type="file"
                accept=".csv"
                onChange={(e) => setUploadFile(e.target.files[0])}
                disabled={loading.import}
                className="hidden"
              />
              <span className="text-[#4D4D4D] dark:text-[#B0B0B0] font-opensans">
                {uploadFile ? uploadFile.name : "Choose CSV file"}
              </span>
            </label>
          </div>
        ) : (
          <div>
            <label className="block text-sm font-medium text-black dark:text-white mb-2 font-opensans">
              {importTypes.find((t) => t.id === importType)?.label}
            </label>
            <input
              type="text"
              value={importValue}
              onChange={(e) => setImportValue(e.target.value)}
              placeholder={importTypes.find((t) => t.id === importType)?.placeholder}
              className="w-full px-4 py-2 border border-[#E6E6E6] dark:border-[#333333] rounded-lg bg-white dark:bg-[#1E1E1E] text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        )}

        <button
          onClick={handleImport}
          disabled={loading.import || (!importValue && !uploadFile)}
          className="flex items-center space-x-2 px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-all duration-150 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading.import ? (<Loader className="w-5 h-5 animate-spin" />) : (<Upload className="w-5 h-5" />)}
          <span>{loading.import ? "Importing..." : "Import Music"}</span>
        </button>
      </div>
    </div>
  );
}
