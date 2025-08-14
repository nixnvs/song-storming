import { useState } from "react";
import Sidebar from "../components/Sidebar";
import Header from "../components/Header";
import ServiceStart from "../components/ServiceStart";
import WeeklyPlan from "../components/WeeklyPlan";
import CatalogSettings from "../components/CatalogSettings";
import History from "../components/History";

export default function PlaylistManager() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeSection, setActiveSection] = useState("Service Start");

  const renderContent = () => {
    switch (activeSection) {
      case "Service Start":
        return <ServiceStart />;
      case "Weekly Plan":
        return <WeeklyPlan />;
      case "Catalog & Settings":
        return <CatalogSettings />;
      case "History":
        return <History />;
      default:
        return <ServiceStart />;
    }
  };

  return (
    <div className="flex h-screen bg-[#F3F3F3] dark:bg-[#0A0A0A]">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 dark:bg-black dark:bg-opacity-70 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar - Responsive: hidden on mobile, toggleable via overlay */}
      <div
        className={`
        fixed lg:static inset-y-0 left-0 z-50 lg:z-auto
        transform ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
        lg:translate-x-0 transition-transform duration-300 ease-in-out
      `}
      >
        <Sidebar 
          onClose={() => setSidebarOpen(false)} 
          activeSection={activeSection}
          onSectionChange={setActiveSection}
        />
      </div>

      {/* Main content area - Takes remaining width, contains header and main sections */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header - Fixed top bar spanning full width of main content area */}
        <Header 
          onMenuClick={() => setSidebarOpen(true)} 
          currentSection={activeSection}
        />

        {/* Content area below header - Scrollable, contains main sections */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-4 md:p-8">
            {renderContent()}
          </div>
        </div>
      </div>
    </div>
  );
}