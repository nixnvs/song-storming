import { useState, useEffect } from "react";
import {
  Calendar,
  RefreshCw,
  Download,
  ChevronLeft,
  ChevronRight,
  Lock,
  Unlock,
  CheckCircle,
  AlertCircle,
  Loader,
  ExternalLink,
  Music,
} from "lucide-react";

export default function WeeklyPlan() {
  const [currentWeek, setCurrentWeek] = useState([]);
  const [weeklyData, setWeeklyData] = useState({});
  const [loading, setLoading] = useState({});
  const [lockedDays, setLockedDays] = useState(new Set());
  const [toast, setToast] = useState(null);
  const [selectedWeek, setSelectedWeek] = useState(0); // 0 = current week

  const blocks = [
    { name: "Lunch", color: "bg-blue-500", time: "12:00-13:30" },
    { name: "Dinner", color: "bg-orange-500", time: "19:00-21:00" },
    { name: "Late", color: "bg-purple-500", time: "22:00-23:30" },
  ];

  useEffect(() => {
    updateCurrentWeek(selectedWeek);
  }, [selectedWeek]);

  const updateCurrentWeek = (weekOffset) => {
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay() + 1 + weekOffset * 7); // Monday

    const week = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(startOfWeek);
      date.setDate(startOfWeek.getDate() + i);
      week.push(date);
    }

    setCurrentWeek(week);
    loadWeeklyData(week);
  };

  const loadWeeklyData = async (week) => {
    try {
      const startDate = week[0].toISOString().split("T")[0];
      const endDate = week[6].toISOString().split("T")[0];

      const response = await fetch(
        `/api/schedule?start_date=${startDate}&end_date=${endDate}`,
      );
      const data = await response.json();

      const weekData = {};
      week.forEach((date) => {
        const dateISO = date.toISOString().split("T")[0];
        weekData[dateISO] = { blocks: {} };
      });

      if (data.schedules) {
        for (const schedule of data.schedules) {
          if (schedule.blocks) {
            weekData[schedule.date_iso] = {
              status: schedule.status,
              blocks: {},
            };

            // Load detailed playlist data for each block
            for (const block of schedule.blocks) {
              if (block.generated) {
                try {
                  const playlistResponse = await fetch(
                    `/api/playlists?date=${schedule.date_iso}&block=${block.block_name}`,
                  );
                  if (playlistResponse.ok) {
                    const playlistData = await playlistResponse.json();

                    weekData[schedule.date_iso].blocks[block.block_name] = {
                      ...block,
                      tracks: playlistData.tracks?.slice(0, 5) || [], // First 5 tracks
                      total_tracks:
                        playlistData.total_tracks || block.track_count || 0,
                    };
                  } else {
                    weekData[schedule.date_iso].blocks[block.block_name] =
                      block;
                  }
                } catch (error) {
                  weekData[schedule.date_iso].blocks[block.block_name] = block;
                }
              } else {
                weekData[schedule.date_iso].blocks[block.block_name] = block;
              }
            }
          }
        }
      }

      setWeeklyData(weekData);
    } catch (error) {
      console.error("Error loading weekly data:", error);
      showToast("Failed to load weekly data", "error");
    }
  };

  const generateWeeklyPlaylists = async () => {
    setLoading({ ...loading, weekly: true });

    try {
      const startDate = currentWeek[0].toISOString().split("T")[0];

      const response = await fetch("/api/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "generate_weekly",
          start_date_iso: startDate,
          force: true,
        }),
      });

      const result = await response.json();

      if (result.success || result.weekly_summary?.success_rate > 0) {
        showToast(
          `Weekly generation completed! ${result.weekly_summary?.successful_days || 0}/7 days successful`,
          result.success ? "success" : "warning",
        );
        await loadWeeklyData(currentWeek);
      } else {
        showToast("Failed to generate weekly playlists", "error");
      }
    } catch (error) {
      console.error("Error generating weekly playlists:", error);
      showToast("Failed to generate weekly playlists", "error");
    } finally {
      setLoading({ ...loading, weekly: false });
    }
  };

  const regenerateDay = async (date) => {
    const dateISO = date.toISOString().split("T")[0];
    if (lockedDays.has(dateISO)) {
      showToast("Day is locked - unlock to regenerate", "warning");
      return;
    }

    setLoading({ ...loading, [dateISO]: true });

    try {
      const response = await fetch("/api/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "generate_daily",
          date_iso: dateISO,
          force: true,
        }),
      });

      const result = await response.json();

      if (result.success) {
        showToast(
          `${date.toLocaleDateString()} regenerated successfully!`,
          "success",
        );
        await loadWeeklyData(currentWeek);
      } else {
        showToast(`Failed to regenerate ${date.toLocaleDateString()}`, "error");
      }
    } catch (error) {
      console.error("Error regenerating day:", error);
      showToast(`Failed to regenerate ${date.toLocaleDateString()}`, "error");
    } finally {
      setLoading({ ...loading, [dateISO]: false });
    }
  };

  const toggleLockDay = (date) => {
    const dateISO = date.toISOString().split("T")[0];
    const newLockedDays = new Set(lockedDays);

    if (newLockedDays.has(dateISO)) {
      newLockedDays.delete(dateISO);
      showToast(`${date.toLocaleDateString()} unlocked`, "success");
    } else {
      newLockedDays.add(dateISO);
      showToast(`${date.toLocaleDateString()} locked`, "success");
    }

    setLockedDays(newLockedDays);
  };

  const exportAllWeek = async () => {
    setLoading({ ...loading, export: true });

    try {
      const startDate = currentWeek[0].toISOString().split("T")[0];
      const endDate = currentWeek[6].toISOString().split("T")[0];

      const response = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "csv",
          date_range: { start_date: startDate, end_date: endDate },
          export_all: true,
        }),
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `weekly_playlists_${startDate}_to_${endDate}.zip`;
        a.click();
        window.URL.revokeObjectURL(url);

        showToast("Weekly playlists exported!", "success");
      }
    } catch (error) {
      console.error("Export failed:", error);
      showToast("Failed to export weekly playlists", "error");
    } finally {
      setLoading({ ...loading, export: false });
    }
  };

  const showToast = (message, type) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const getDayStatus = (date) => {
    const dateISO = date.toISOString().split("T")[0];
    const dayData = weeklyData[dateISO];

    if (!dayData || !dayData.blocks) return "empty";

    const generatedBlocks = Object.values(dayData.blocks).filter(
      (block) => block.generated,
    ).length;
    if (generatedBlocks === 3) return "complete";
    if (generatedBlocks > 0) return "partial";
    return "empty";
  };

  const formatDate = (date) => {
    const today = new Date();
    const isToday = date.toDateString() === today.toDateString();

    return {
      dayName: date.toLocaleDateString("en-US", { weekday: "short" }),
      dayNumber: date.getDate(),
      monthName: date.toLocaleDateString("en-US", { month: "short" }),
      isToday,
    };
  };

  const getWeekLabel = () => {
    if (selectedWeek === 0) return "This Week";
    if (selectedWeek === 1) return "Next Week";
    if (selectedWeek === -1) return "Last Week";
    return `Week ${selectedWeek > 0 ? "+" : ""}${selectedWeek}`;
  };

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
            <CheckCircle className="w-5 h-5" />
            <span>{toast.message}</span>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-white dark:bg-[#1E1E1E] border border-[#E6E6E6] dark:border-[#333333] rounded-xl p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-black dark:text-white font-sora">
              Weekly Plan
            </h1>
            <p className="text-[#6F6F6F] dark:text-[#AAAAAA] font-opensans mt-1">
              {currentWeek.length > 0 &&
                `${formatDate(currentWeek[0]).monthName} ${currentWeek[0].getDate()} - ${formatDate(currentWeek[6]).monthName} ${currentWeek[6].getDate()}, ${currentWeek[0].getFullYear()}`}
            </p>
          </div>

          <div className="flex items-center space-x-4">
            {/* Week Navigation */}
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setSelectedWeek(selectedWeek - 1)}
                className="w-8 h-8 rounded-lg bg-[#F5F5F5] dark:bg-[#2A2A2A] border border-[#D9D9D9] dark:border-[#404040] flex items-center justify-center hover:bg-[#EEEEEE] dark:hover:bg-[#333333] transition-all duration-150 active:scale-95"
              >
                <ChevronLeft className="w-4 h-4 text-[#4D4D4D] dark:text-[#B0B0B0]" />
              </button>

              <div className="px-4 py-2 text-center min-w-[120px]">
                <span className="font-semibold text-black dark:text-white font-opensans">
                  {getWeekLabel()}
                </span>
              </div>

              <button
                onClick={() => setSelectedWeek(selectedWeek + 1)}
                className="w-8 h-8 rounded-lg bg-[#F5F5F5] dark:bg-[#2A2A2A] border border-[#D9D9D9] dark:border-[#404040] flex items-center justify-center hover:bg-[#EEEEEE] dark:hover:bg-[#333333] transition-all duration-150 active:scale-95"
              >
                <ChevronRight className="w-4 h-4 text-[#4D4D4D] dark:text-[#B0B0B0]" />
              </button>
            </div>

            {/* Generate Week Button */}
            <button
              onClick={generateWeeklyPlaylists}
              disabled={loading.weekly}
              className="flex items-center space-x-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-all duration-150 active:scale-95 disabled:opacity-50"
            >
              {loading.weekly ? (
                <Loader className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              <span>{loading.weekly ? "Generating..." : "Generate Week"}</span>
            </button>

            {/* Export Button */}
            <button
              onClick={exportAllWeek}
              disabled={loading.export}
              className="flex items-center space-x-2 px-4 py-2 bg-[#F5F5F5] dark:bg-[#2A2A2A] border border-[#D9D9D9] dark:border-[#404040] rounded-lg hover:bg-[#EEEEEE] dark:hover:bg-[#333333] transition-all duration-150 active:scale-95 disabled:opacity-50"
            >
              {loading.export ? (
                <Loader className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              <span className="text-[#4D4D4D] dark:text-[#B0B0B0] font-opensans">
                {loading.export ? "Exporting..." : "Export All"}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Time Blocks Legend */}
      <div className="bg-white dark:bg-[#1E1E1E] border border-[#E6E6E6] dark:border-[#333333] rounded-xl p-6">
        <div className="flex flex-wrap gap-4">
          {blocks.map((block) => (
            <div key={block.name} className="flex items-center space-x-2">
              <div
                className={`w-3 h-3 rounded-full ${block.color} dark:opacity-80`}
              ></div>
              <span className="text-sm font-opensans text-[#4D4D4D] dark:text-[#B0B0B0]">
                {block.name} ({block.time})
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Weekly Calendar Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-7 gap-4">
        {currentWeek.map((date, index) => {
          const dateISO = date.toISOString().split("T")[0];
          const dayData = weeklyData[dateISO];
          const dayFormat = formatDate(date);
          const dayStatus = getDayStatus(date);
          const isLocked = lockedDays.has(dateISO);
          const isLoading = loading[dateISO];

          return (
            <div
              key={dateISO}
              className="bg-white dark:bg-[#1E1E1E] border border-[#E6E6E6] dark:border-[#333333] rounded-xl overflow-hidden"
            >
              {/* Day Header */}
              <div
                className={`p-4 ${dayFormat.isToday ? "bg-blue-50 dark:bg-blue-900/20" : "bg-[#F8F9FA] dark:bg-[#252525]"}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <div className="text-lg font-bold text-black dark:text-white font-sora">
                      {dayFormat.dayName}
                    </div>
                    <div className="text-sm text-[#6F6F6F] dark:text-[#AAAAAA] font-opensans">
                      {dayFormat.monthName} {dayFormat.dayNumber}
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    {/* Status indicator */}
                    <div
                      className={`w-3 h-3 rounded-full ${
                        dayStatus === "complete"
                          ? "bg-green-500"
                          : dayStatus === "partial"
                            ? "bg-orange-500"
                            : "bg-gray-300 dark:bg-gray-600"
                      }`}
                    ></div>

                    {/* Lock toggle */}
                    <button
                      onClick={() => toggleLockDay(date)}
                      className="p-1 hover:bg-white/10 rounded transition-colors"
                    >
                      {isLocked ? (
                        <Lock className="w-4 h-4 text-orange-500" />
                      ) : (
                        <Unlock className="w-4 h-4 text-[#6F6F6F] dark:text-[#AAAAAA]" />
                      )}
                    </button>
                  </div>
                </div>

                {dayFormat.isToday && (
                  <div className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wide">
                    Today
                  </div>
                )}
              </div>

              {/* Blocks */}
              <div className="p-4 space-y-3">
                {blocks.map((block) => {
                  const blockData = dayData?.blocks?.[block.name];
                  const hasPlaylist = blockData?.generated;

                  return (
                    <div
                      key={block.name}
                      className="border border-[#E6E6E6] dark:border-[#333333] rounded-lg p-3"
                    >
                      <div className="flex items-center space-x-2 mb-2">
                        <div
                          className={`w-3 h-3 rounded-full ${block.color}`}
                        ></div>
                        <span className="text-sm font-semibold text-black dark:text-white font-sora">
                          {block.name}
                        </span>
                        {hasPlaylist && (
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        )}
                      </div>

                      {hasPlaylist &&
                      blockData.tracks &&
                      blockData.tracks.length > 0 ? (
                        <div className="space-y-1">
                          {blockData.tracks.slice(0, 3).map((track, idx) => (
                            <div
                              key={idx}
                              className="text-xs text-[#6F6F6F] dark:text-[#AAAAAA] truncate font-opensans"
                            >
                              {track.title} - {track.artist}
                            </div>
                          ))}
                          {blockData.total_tracks > 3 && (
                            <div className="text-xs text-[#6F6F6F] dark:text-[#AAAAAA] font-opensans">
                              +{blockData.total_tracks - 3} more tracks
                            </div>
                          )}
                          <div className="text-xs text-green-600 dark:text-green-400 font-opensans">
                            {blockData.total_tracks} tracks,{" "}
                            {Math.round((blockData.duration_sec || 0) / 60)} min
                          </div>
                        </div>
                      ) : (
                        <div className="text-xs text-[#6F6F6F] dark:text-[#AAAAAA] font-opensans">
                          {hasPlaylist
                            ? "Generated (no preview)"
                            : "Not generated"}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Actions */}
              <div className="p-4 border-t border-[#E6E6E6] dark:border-[#333333]">
                <button
                  onClick={() => regenerateDay(date)}
                  disabled={isLocked || isLoading}
                  className="w-full flex items-center justify-center space-x-2 px-3 py-2 bg-[#F5F5F5] dark:bg-[#2A2A2A] border border-[#D9D9D9] dark:border-[#404040] text-[#4D4D4D] dark:text-[#B0B0B0] hover:bg-[#EEEEEE] dark:hover:bg-[#333333] rounded-lg transition-all duration-150 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <Loader className="w-4 h-4 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4" />
                  )}
                  <span>
                    {isLoading
                      ? "Generating..."
                      : isLocked
                        ? "Locked"
                        : "Regenerate"}
                  </span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Weekly Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-[#1E1E1E] border border-[#E6E6E6] dark:border-[#333333] rounded-xl p-6 text-center">
          <div className="text-2xl font-bold text-black dark:text-white font-sora">
            {
              currentWeek.filter((date) => getDayStatus(date) === "complete")
                .length
            }
            /7
          </div>
          <div className="text-sm text-[#6F6F6F] dark:text-[#AAAAAA] font-opensans">
            Complete Days
          </div>
        </div>
        <div className="bg-white dark:bg-[#1E1E1E] border border-[#E6E6E6] dark:border-[#333333] rounded-xl p-6 text-center">
          <div className="text-2xl font-bold text-black dark:text-white font-sora">
            {Object.values(weeklyData).reduce(
              (sum, day) =>
                sum +
                Object.values(day.blocks || {}).filter(
                  (block) => block.generated,
                ).length,
              0,
            )}
          </div>
          <div className="text-sm text-[#6F6F6F] dark:text-[#AAAAAA] font-opensans">
            Total Playlists
          </div>
        </div>
        <div className="bg-white dark:bg-[#1E1E1E] border border-[#E6E6E6] dark:border-[#333333] rounded-xl p-6 text-center">
          <div className="text-2xl font-bold text-black dark:text-white font-sora">
            {lockedDays.size}
          </div>
          <div className="text-sm text-[#6F6F6F] dark:text-[#AAAAAA] font-opensans">
            Locked Days
          </div>
        </div>
        <div className="bg-white dark:bg-[#1E1E1E] border border-[#E6E6E6] dark:border-[#333333] rounded-xl p-6 text-center">
          <div className="text-2xl font-bold text-green-600 dark:text-green-400 font-sora">
            {Math.round(
              (currentWeek.filter((date) => getDayStatus(date) !== "empty")
                .length /
                7) *
                100,
            )}
            %
          </div>
          <div className="text-sm text-[#6F6F6F] dark:text-[#AAAAAA] font-opensans">
            Coverage
          </div>
        </div>
      </div>
    </div>
  );
}
