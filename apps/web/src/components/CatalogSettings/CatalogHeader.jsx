export function CatalogHeader({ catalogStats }) {
  return (
    <div className="bg-white dark:bg-[#1E1E1E] border border-[#E6E6E6] dark:border-[#333333] rounded-xl p-6">
      <h1 className="text-2xl md:text-3xl font-bold text-black dark:text-white font-sora">
        Catalog & Settings
      </h1>
      <p className="text-[#6F6F6F] dark:text-[#AAAAAA] font-opensans mt-1">
        Manage your music catalog and configure playlist generation
      </p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
        <div className="text-center">
          <div className="text-2xl font-bold text-black dark:text-white font-sora">
            {catalogStats.total_tracks || 0}
          </div>
          <div className="text-sm text-[#6F6F6F] dark:text-[#AAAAAA] font-opensans">
            Total Tracks
          </div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-black dark:text-white font-sora">
            {catalogStats.unique_artists || 0}
          </div>
          <div className="text-sm text-[#6F6F6F] dark:text-[#AAAAAA] font-opensans">
            Artists
          </div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-black dark:text-white font-sora">
            {Math.round((catalogStats.total_duration_hours || 0) * 10) / 10}h
          </div>
          <div className="text-sm text-[#6F6F6F] dark:text-[#AAAAAA] font-opensans">
            Total Duration
          </div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400 font-sora">
            {catalogStats.avg_energy
              ? Math.round(catalogStats.avg_energy * 100) / 100
              : "N/A"}
          </div>
          <div className="text-sm text-[#6F6F6F] dark:text-[#AAAAAA] font-opensans">
            Avg Energy
          </div>
        </div>
      </div>
    </div>
  );
}
