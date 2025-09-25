import { useState } from "react";
import { Search, Bell, Menu } from "lucide-react";

export default function Header({ onMenuClick, currentSection }) {
  const [searchValue, setSearchValue] = useState("");
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  return (
    <div className="h-16 bg-spotify-dark border-b border-spotify-border flex items-center justify-between px-4 md:px-6 flex-shrink-0">
      {/* Left side - Mobile menu button and current section title */}
      <div className="flex items-center gap-3">
        {/* Mobile menu button */}
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 rounded-lg transition-colors hover:bg-[#232323] focus:outline-none focus:ring-2 focus:ring-spotify-green"
        >
          <Menu size={18} className="text-spotify-mute" />
        </button>

        <h1 className="text-xl md:text-2xl font-normal text-spotify-text tracking-tight">
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
            className={`w-[220px] h-10 pl-10 pr-4 rounded-full bg-[#2A2A2A] text-spotify-text placeholder-[#8A8A8A] outline-none focus:ring-2 focus:ring-spotify-green transition-colors text-sm ${isSearchFocused ? '' : ''}`}
          />
          <Search
            size={16}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-spotify-mute"
          />
        </div>

        {/* Mobile search button */}
        <button className="md:hidden w-10 h-10 rounded-full bg-spotify-card border border-spotify-border flex items-center justify-center transition-colors hover:bg-[#232323] focus:outline-none focus:ring-2 focus:ring-spotify-green">
          <Search size={18} className="text-spotify-mute" />
        </button>

        {/* Notification Bell */}
        <button className="w-10 h-10 rounded-full bg-spotify-card border border-spotify-border flex items-center justify-center transition-colors hover:bg-[#232323] focus:outline-none focus:ring-2 focus:ring-spotify-green">
          <Bell size={18} className="text-spotify-mute" />
        </button>

        {/* User Avatar */}
        <div className="relative">
          <img
            src="https://i.pravatar.cc/80"
            alt="User Avatar"
            className="w-10 h-10 rounded-full ring-2 ring-spotify-border transition-colors hover:ring-[#3a3a3a] cursor-pointer"
          />
        </div>
      </div>
    </div>
  );
}
