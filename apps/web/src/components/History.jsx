import { useState } from "react";
import { Download, Calendar, Filter, Search, Music, Clock, ExternalLink } from "lucide-react";

export default function History() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedBlock, setSelectedBlock] = useState("All");
  const [expandedPlaylist, setExpandedPlaylist] = useState(null);

  const blockTypes = ["All", "Lunch", "Dinner", "Late"];

  const sampleHistory = [
    {
      id: 1,
      date: "2024-08-13",
      block: "Lunch",
      startTime: "12:00",
      endTime: "13:30",
      duration: "90 minutes",
      tracksPlayed: 23,
      avgEnergy: 0.24,
      avgBpm: 78,
      exported: true,
      playlist: [
        { artist: "Nils Frahm", track: "Says", duration: "3:24", bpm: 72, energy: 0.2 },
        { artist: "Max Richter", track: "On The Nature Of Daylight", duration: "6:00", bpm: 65, energy: 0.3 },
        { artist: "Ólafur Arnalds", track: "Near Light", duration: "4:12", bpm: 85, energy: 0.15 }
      ]
    },
    {
      id: 2,
      date: "2024-08-13",
      block: "Dinner",
      startTime: "19:00",
      endTime: "21:00",
      duration: "120 minutes",
      tracksPlayed: 31,
      avgEnergy: 0.45,
      avgBpm: 95,
      exported: false,
      playlist: [
        { artist: "Kiasmos", track: "Blurred EP", duration: "4:33", bpm: 102, energy: 0.5 },
        { artist: "GoGo Penguin", track: "Hopopono", duration: "5:45", bpm: 88, energy: 0.4 }
      ]
    },
    {
      id: 3,
      date: "2024-08-12",
      block: "Late",
      startTime: "22:00",
      endTime: "23:30",
      duration: "90 minutes",
      tracksPlayed: 18,
      avgEnergy: 0.32,
      avgBpm: 70,
      exported: true,
      playlist: [
        { artist: "Brian Eno", track: "An Ending (Ascent)", duration: "4:23", bpm: 68, energy: 0.25 },
        { artist: "Stars of the Lid", track: "Don't Bother Them", duration: "8:12", bpm: 60, energy: 0.1 }
      ]
    }
  ];

  const filteredHistory = sampleHistory.filter(entry => {
    const matchesSearch = entry.playlist.some(track => 
      track.artist.toLowerCase().includes(searchTerm.toLowerCase()) ||
      track.track.toLowerCase().includes(searchTerm.toLowerCase())
    );
    const matchesDate = !selectedDate || entry.date === selectedDate;
    const matchesBlock = selectedBlock === "All" || entry.block === selectedBlock;
    
    return matchesSearch && matchesDate && matchesBlock;
  });

  const handleExportPlaylist = (playlistId) => {
    console.log("Exporting playlist:", playlistId);
  };

  const handleExportAll = () => {
    console.log("Exporting all filtered results");
  };

  const getBlockColor = (block) => {
    switch (block) {
      case "Lunch":
        return "bg-blue-500 text-white";
      case "Dinner":
        return "bg-orange-500 text-white";
      case "Late":
        return "bg-purple-500 text-white";
      default:
        return "bg-gray-500 text-white";
    }
  };

  return (
    <div className="space-y-6 md:space-y-8">
      {/* Header */}
      <div className="bg-white dark:bg-[#1E1E1E] border border-[#E6E6E6] dark:border-[#333333] rounded-xl p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-black dark:text-white font-sora">
              Playlist History
            </h1>
            <p className="text-[#6F6F6F] dark:text-[#AAAAAA] font-opensans mt-1">
              View and export past playlist sessions
            </p>
          </div>
          
          <button
            onClick={handleExportAll}
            className="flex items-center space-x-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-all duration-150 active:scale-95"
          >
            <Download className="w-4 h-4" />
            <span className="font-opensans">Export Filtered</span>
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-[#1E1E1E] border border-[#E6E6E6] dark:border-[#333333] rounded-xl p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[#6F6F6F] dark:text-[#AAAAAA]" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search tracks or artists..."
              className="w-full pl-10 pr-3 py-2 border border-[#D9D9D9] dark:border-[#404040] rounded-lg bg-white dark:bg-[#262626] text-black dark:text-white font-opensans"
            />
          </div>

          {/* Date Filter */}
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[#6F6F6F] dark:text-[#AAAAAA]" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full pl-10 pr-3 py-2 border border-[#D9D9D9] dark:border-[#404040] rounded-lg bg-white dark:bg-[#262626] text-black dark:text-white font-opensans"
            />
          </div>

          {/* Block Filter */}
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[#6F6F6F] dark:text-[#AAAAAA]" />
            <select
              value={selectedBlock}
              onChange={(e) => setSelectedBlock(e.target.value)}
              className="w-full pl-10 pr-3 py-2 border border-[#D9D9D9] dark:border-[#404040] rounded-lg bg-white dark:bg-[#262626] text-black dark:text-white font-opensans appearance-none"
            >
              {blockTypes.map(block => (
                <option key={block} value={block}>{block} Block</option>
              ))}
            </select>
          </div>

          {/* Clear Filters */}
          <button
            onClick={() => {
              setSearchTerm("");
              setSelectedDate("");
              setSelectedBlock("All");
            }}
            className="px-4 py-2 border border-[#D9D9D9] dark:border-[#404040] rounded-lg hover:bg-[#F5F5F5] dark:hover:bg-[#2A2A2A] transition-all duration-150 text-[#4D4D4D] dark:text-[#B0B0B0] font-opensans"
          >
            Clear Filters
          </button>
        </div>
      </div>

      {/* History List */}
      <div className="space-y-4">
        {filteredHistory.map((entry) => (
          <div key={entry.id} className="bg-white dark:bg-[#1E1E1E] border border-[#E6E6E6] dark:border-[#333333] rounded-xl overflow-hidden">
            {/* Entry Header */}
            <div className="p-6 border-b border-[#E6E6E6] dark:border-[#333333]">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <span className={`px-3 py-1 rounded-full text-sm font-semibold ${getBlockColor(entry.block)} font-opensans`}>
                    {entry.block}
                  </span>
                  <div>
                    <h3 className="font-semibold text-black dark:text-white font-bricolage">
                      {entry.date} • {entry.startTime} - {entry.endTime}
                    </h3>
                    <div className="flex items-center space-x-4 text-sm text-[#6F6F6F] dark:text-[#AAAAAA] font-opensans mt-1">
                      <span>{entry.tracksPlayed} tracks</span>
                      <span>{entry.duration}</span>
                      <span>Avg BPM: {entry.avgBpm}</span>
                      <span>Avg Energy: {entry.avgEnergy}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  {entry.exported && (
                    <span className="text-green-600 dark:text-green-400 text-sm font-opensans">
                      Exported
                    </span>
                  )}
                  <button
                    onClick={() => setExpandedPlaylist(expandedPlaylist === entry.id ? null : entry.id)}
                    className="px-4 py-2 bg-[#F5F5F5] dark:bg-[#2A2A2A] border border-[#D9D9D9] dark:border-[#404040] rounded-lg hover:bg-[#EEEEEE] dark:hover:bg-[#333333] transition-all duration-150 active:scale-95 font-opensans text-[#4D4D4D] dark:text-[#B0B0B0]"
                  >
                    {expandedPlaylist === entry.id ? "Hide" : "View"} Playlist
                  </button>
                  <button
                    onClick={() => handleExportPlaylist(entry.id)}
                    className="flex items-center space-x-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-all duration-150 active:scale-95"
                  >
                    <Download className="w-4 h-4" />
                    <span className="font-opensans">Export</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Expanded Playlist */}
            {expandedPlaylist === entry.id && (
              <div className="p-6 bg-[#F8F9FA] dark:bg-[#262626]">
                <h4 className="font-semibold text-black dark:text-white mb-4 font-bricolage">
                  Tracks Played ({entry.playlist.length} of {entry.tracksPlayed})
                </h4>
                <div className="space-y-3">
                  {entry.playlist.map((track, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-white dark:bg-[#1E1E1E] border border-[#E6E6E6] dark:border-[#404040] rounded-lg">
                      <div className="flex items-center space-x-4">
                        <div className="w-10 h-10 bg-[#F0F0F0] dark:bg-[#3A3A3A] rounded-lg flex items-center justify-center">
                          <Music className="w-5 h-5 text-[#6F6F6F] dark:text-[#AAAAAA]" />
                        </div>
                        <div>
                          <h5 className="font-semibold text-black dark:text-white font-bricolage">
                            {track.track}
                          </h5>
                          <p className="text-sm text-[#6F6F6F] dark:text-[#AAAAAA] font-opensans">
                            {track.artist}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-6 text-sm text-[#6F6F6F] dark:text-[#AAAAAA] font-opensans">
                        <div className="flex items-center space-x-1">
                          <Clock className="w-4 h-4" />
                          <span>{track.duration}</span>
                        </div>
                        <span>BPM: {track.bpm}</span>
                        <span>Energy: {track.energy}</span>
                      </div>
                    </div>
                  ))}
                  {entry.playlist.length < entry.tracksPlayed && (
                    <div className="text-center py-3">
                      <span className="text-[#6F6F6F] dark:text-[#AAAAAA] font-opensans text-sm">
                        ... and {entry.tracksPlayed - entry.playlist.length} more tracks
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Empty State */}
      {filteredHistory.length === 0 && (
        <div className="bg-white dark:bg-[#1E1E1E] border border-[#E6E6E6] dark:border-[#333333] rounded-xl p-12 text-center">
          <Music className="w-16 h-16 text-[#6F6F6F] dark:text-[#AAAAAA] mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-black dark:text-white mb-2 font-bricolage">
            No playlists found
          </h3>
          <p className="text-[#6F6F6F] dark:text-[#AAAAAA] font-opensans">
            Try adjusting your filters or check back after running some playlists.
          </p>
        </div>
      )}

      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-[#1E1E1E] border border-[#E6E6E6] dark:border-[#333333] rounded-xl p-6 text-center">
          <div className="text-2xl font-bold text-black dark:text-white font-sora">127</div>
          <div className="text-[#6F6F6F] dark:text-[#AAAAAA] font-opensans text-sm">Total Sessions</div>
        </div>
        <div className="bg-white dark:bg-[#1E1E1E] border border-[#E6E6E6] dark:border-[#333333] rounded-xl p-6 text-center">
          <div className="text-2xl font-bold text-black dark:text-white font-sora">2,847</div>
          <div className="text-[#6F6F6F] dark:text-[#AAAAAA] font-opensans text-sm">Tracks Played</div>
        </div>
        <div className="bg-white dark:bg-[#1E1E1E] border border-[#E6E6E6] dark:border-[#333333] rounded-xl p-6 text-center">
          <div className="text-2xl font-bold text-black dark:text-white font-sora">186h</div>
          <div className="text-[#6F6F6F] dark:text-[#AAAAAA] font-opensans text-sm">Music Played</div>
        </div>
        <div className="bg-white dark:bg-[#1E1E1E] border border-[#E6E6E6] dark:border-[#333333] rounded-xl p-6 text-center">
          <div className="text-2xl font-bold text-green-600 dark:text-green-400 font-sora">94%</div>
          <div className="text-[#6F6F6F] dark:text-[#AAAAAA] font-opensans text-sm">Export Rate</div>
        </div>
      </div>
    </div>
  );
}