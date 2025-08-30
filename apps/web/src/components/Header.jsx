import { useState } from "react";
import { Search, Bell, Menu } from "lucide-react";

export default function Header({ onMenuClick, currentSection }) {
  const [searchValue, setSearchValue] = useState("");
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  return (
    <div className="h-16 bg-[#F3F3F3] dark:bg-[#1A1A1A] flex items-center justify-between px-4 md:px-6 flex-shrink-0">
      {/* Left side - Mobile menu button and current section title */}
      <div className="flex items-center gap-3">
        {/* Mobile menu button */}
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 rounded-lg transition-all duration-150 hover:bg-[#F5F5F5] dark:hover:bg-[#1E1E1E] active:bg-[#EEEEEE] dark:active:bg-[#2A2A2A] active:scale-95"
        >
          <Menu size={20} className="text-[#4B4B4B] dark:text-[#B0B0B0]" />
        </button>

        <h1 className="text-xl md:text-2xl font-bold text-black dark:text-white tracking-tight font-inter">
          {currentSection || "Michelin Playlist Manager"}
        </h1>
      </div>

      {/* Right side - Search and notification area */}
      <div className="flex items-center space-x-2 md:space-x-4">
        {/* Search field */}
        <div className="relative hidden md:block">
          <input
            type="text"
            placeholder="Search tracks, artists…"
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            onFocus={() => setIsSearchFocused(true)}
            onBlur={() => setIsSearchFocused(false)}
            className={`w-[200px] h-10 pl-10 pr-4 rounded-full bg-white dark:bg-[#1E1E1E] border transition-all duration-200 font-inter text-sm text-black dark:text-white placeholder-[#6E6E6E] dark:placeholder-[#888888] placeholder-opacity-80 ${
              isSearchFocused
                ? "border-black dark:border-white"
                : "border-[#E5E5E5] dark:border-[#333333] hover:border-[#D0D0D0] dark:hover:border-[#444444]"
            }`}
          />
          <Search
            size={16}
            className="absolute left-3.5 top-1/2 transform -translate-y-1/2 text-[#6E6E6E] dark:text-[#888888]"
          />
        </div>

        {/* Mobile search button */}
        <button className="md:hidden w-10 h-10 rounded-full bg-white dark:bg-[#1E1E1E] border border-[#E5E5E5] dark:border-[#333333] flex items-center justify-center transition-all duration-150 hover:bg-[#F8F8F8] dark:hover:bg-[#262626] hover:border-[#D0D0D0] dark:hover:border-[#444444] active:bg-[#F0F0F0] dark:active:bg-[#2A2A2A] active:scale-95">
          <Search size={18} className="text-[#4B4B4B] dark:text-[#B0B0B0]" />
        </button>

        {/* Notification Bell */}
        <button className="w-10 h-10 rounded-full bg-white dark:bg-[#1E1E1E] border border-[#E5E5E5] dark:border-[#333333] flex items-center justify-center transition-all duration-150 hover:bg-[#F8F8F8] dark:hover:bg-[#262626] hover:border-[#D0D0D0] dark:hover:border-[#444444] active:bg-[#F0F0F0] dark:active:bg-[#2A2A2A] active:scale-95">
          <Bell size={18} className="text-[#4B4B4B] dark:text-[#B0B0B0]" />
        </button>

        {/* User Avatar */}
        <div className="relative">
          <img
            src="https://i.pravatar.cc/80"
            alt="User Avatar"
            className="w-10 h-10 rounded-full ring-2 ring-white dark:ring-[#333333] transition-all duration-150 hover:ring-[#E0E0E0] dark:hover:ring-[#444444] cursor-pointer"
            style={{ boxShadow: "inset 0 1px 2px rgba(218, 218, 218, 0.5)" }}
          />
        </div>
      </div>
    </div>
  );
}