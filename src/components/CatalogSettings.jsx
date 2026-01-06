import { useCatalogSettings } from "../hooks/useCatalogSettings";
import { Toast } from "./common/Toast";
import { CatalogHeader } from "./CatalogSettings/CatalogHeader";
import { SettingsTabs } from "./CatalogSettings/SettingsTabs";
import { ImportMusicTab } from "./CatalogSettings/ImportMusicTab";
import { PlayBlocksTab } from "./CatalogSettings/PlayBlocksTab";
import { RotationRulesTab } from "./CatalogSettings/RotationRulesTab";
import { ExportSettingsTab } from "./CatalogSettings/ExportSettingsTab";

export default function CatalogSettings() {
  const {
    activeTab,
    setActiveTab,
    loading,
    toast,
    importType,
    setImportType,
    importValue,
    setImportValue,
    uploadFile,
    setUploadFile,
    playBlocks,
    rotationRules,
    setRotationRules,
    exportSettings,
    setExportSettings,
    editingBlock,
    setEditingBlock,
    catalogStats,
    handleImport,
    handleSaveBlock,
    updatePlayBlock,
    handleSaveRotationRules,
    handleSaveExportSettings,
  } = useCatalogSettings();

  return (
    <div className="space-y-6 md:space-y-8">
      <Toast toast={toast} />
      <CatalogHeader catalogStats={catalogStats} />

      <div className="bg-white dark:bg-[#1E1E1E] border border-[#E6E6E6] dark:border-[#333333] rounded-xl overflow-hidden">
        <SettingsTabs activeTab={activeTab} setActiveTab={setActiveTab} />

        <div className="p-6">
          {activeTab === "import" && (
            <ImportMusicTab
              importType={importType}
              setImportType={setImportType}
              importValue={importValue}
              setImportValue={setImportValue}
              uploadFile={uploadFile}
              setUploadFile={setUploadFile}
              handleImport={handleImport}
              loading={loading}
            />
          )}

          {activeTab === "blocks" && (
            <PlayBlocksTab
              playBlocks={playBlocks}
              editingBlock={editingBlock}
              setEditingBlock={setEditingBlock}
              updatePlayBlock={updatePlayBlock}
              handleSaveBlock={handleSaveBlock}
              loading={loading}
            />
          )}

          {activeTab === "rules" && (
            <RotationRulesTab
              rotationRules={rotationRules}
              setRotationRules={setRotationRules}
              handleSaveRotationRules={handleSaveRotationRules}
              loading={loading}
            />
          )}

          {activeTab === "export" && (
            <ExportSettingsTab
              exportSettings={exportSettings}
              setExportSettings={setExportSettings}
              handleSaveExportSettings={handleSaveExportSettings}
              loading={loading}
            />
          )}
        </div>
      </div>
    </div>
  );
}
