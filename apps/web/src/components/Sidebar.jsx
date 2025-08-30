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
    <div className="w-60 bg-[#F3F3F3] dark:bg-[#1A1A1A] flex-shrink-0 flex flex-col h-full">
      {/* Brand Logo */}
      <div className="p-4 flex justify-start">
        <div className="w-12 h-12 bg-white dark:bg-[#262626] rounded-full border border-[#E4E4E4] dark:border-[#404040] flex items-center justify-center">
          <Music className="w-6 h-6 text-black dark:text-white" />
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
                  className={`w-full flex items-center justify-between px-3 py-3 rounded-lg transition-all duration-200 ${
                    isActive
                      ? "bg-white dark:bg-[#262626] border border-[#E4E4E4] dark:border-[#404040] text-black dark:text-white"
                      : "text-black/70 dark:text-white/70 hover:text-black dark:hover:text-white hover:bg-white/50 dark:hover:bg-white/10 active:bg-white/70 dark:active:bg-white/15 active:scale-[0.98]"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon
                      size={20}
                      className={
                        isActive
                          ? "text-black dark:text-white"
                          : "text-black/70 dark:text-white/70"
                      }
                    />
                    <span
                      className={`font-medium text-sm font-plus-jakarta ${
                        isActive
                          ? "text-black dark:text-white"
                          : "text-black/70 dark:text-white/70"
                      }`}
                    >
                      {item.name}
                    </span>
                  </div>
                  {item.hasSubmenu && (
                    <ChevronDown
                      size={16}
                      className={`transition-transform duration-200 ${
                        isExpanded ? "rotate-180" : ""
                      } ${isActive ? "text-black dark:text-white" : "text-black/70 dark:text-white/70"}`}
                    />
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </nav>

      {/* Utility Actions */}
      <div className="p-4">
        <div className="text-xs text-black/50 dark:text-white/50 font-plus-jakarta">
          Michelin Playlist Manager
        </div>
      </div>
    </div>
  );
}