import { Upload, Download, Settings, Clock } from "lucide-react";

const tabs = [
  { id: "import", label: "Import Music", icon: Upload },
  { id: "blocks", label: "Play Blocks", icon: Clock },
  { id: "rules", label: "Rotation Rules", icon: Settings },
  { id: "export", label: "Export Settings", icon: Download },
];

export function SettingsTabs({ activeTab, setActiveTab }) {
  return (
    <div className="border-b border-[#E6E6E6] dark:border-[#333333]">
      <div className="flex overflow-x-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center space-x-2 px-6 py-4 border-b-2 transition-all duration-150 whitespace-nowrap ${
                activeTab === tab.id
                  ? "border-blue-500 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20"
                  : "border-transparent text-[#6F6F6F] dark:text-[#AAAAAA] hover:text-black dark:hover:text-white hover:bg-[#F5F5F5] dark:hover:bg-[#2A2A2A]"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span className="font-opensans">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
