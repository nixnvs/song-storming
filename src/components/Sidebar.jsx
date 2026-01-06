import { useState } from "react";
import {
  Play,
  Calendar,
  Database,
  History,
  ChevronDown,
  Music,
} from "lucide-react";

export default function Sidebar({ onClose, activeSection, onSectionChange }) {
  const [expandedMenus, setExpandedMenus] = useState({});

  const toggleSubmenu = (item) => {
    setExpandedMenus((prev) => ({
      ...prev,
      [item]: !prev[item],
    }));
  };

  const handleItemClick = (itemName, hasSubmenu) => {
    if (hasSubmenu) {
      toggleSubmenu(itemName);
    } else {
      onSectionChange(itemName);
    }
    // Close sidebar on mobile when item is clicked
    if (onClose && typeof window !== "undefined" && window.innerWidth < 1024) {
      onClose();
    }
  };

  const navigationItems = [
    { name: "Service Start", icon: Play, hasSubmenu: false },
    { name: "Weekly Plan", icon: Calendar, hasSubmenu: false },
    { name: "Catalog & Settings", icon: Database, hasSubmenu: true },
    { name: "History", icon: History, hasSubmenu: false },
  ];

  return (
    <div className="w-60 bg-spotify-dark border-r border-spotify-border flex-shrink-0 flex flex-col h-full">
      {/* Brand Logo */}
      <div className="p-4 flex justify-start">
        <div className="w-10 h-10 bg-spotify-card rounded-full border border-spotify-border flex items-center justify-center">
          <Music className="w-5 h-5 text-spotify-text" />
        </div>
      </div>

      {/* Navigation Menu */}
      <nav className="flex-1 px-4">
        <div className="space-y-2">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.name;
            const isExpanded = expandedMenus[item.name];

            return (
              <div key={item.name}>
                <button
                  onClick={() => handleItemClick(item.name, item.hasSubmenu)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-spotify-green ${
                    isActive
                      ? "bg-[#232323] text-spotify-text"
                      : "text-spotify-mute hover:text-spotify-text hover:bg-[#232323]"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon
                      size={18}
                      className={
                        isActive ? "text-spotify-text" : "text-spotify-mute"
                      }
                    />
                    <span
                      className={`text-sm font-medium ${isActive ? "text-spotify-text" : "text-spotify-mute"}`}
                    >
                      {item.name}
                    </span>
                  </div>
                  {item.hasSubmenu && (
                    <ChevronDown
                      size={16}
                      className={`transition-transform duration-200 ${
                        isExpanded ? "rotate-180" : ""
                      } ${isActive ? "text-spotify-text" : "text-spotify-mute"}`}
                    />
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </nav>

      {/* Utility Actions */}
      <div className="p-4 text-xs text-spotify-mute">Michelin Playlist Manager</div>
    </div>
  );
}
