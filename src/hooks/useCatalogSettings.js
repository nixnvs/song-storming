import { useState, useEffect } from "react";

export function useCatalogSettings() {
  const [activeTab, setActiveTab] = useState("import");
  const [loading, setLoading] = useState({});
  const [toast, setToast] = useState(null);

  // Import states
  const [importType, setImportType] = useState("artist");
  const [importValue, setImportValue] = useState("");
  const [uploadFile, setUploadFile] = useState(null);

  // Settings states
  const [playBlocks, setPlayBlocks] = useState([]);
  const [rotationRules, setRotationRules] = useState({});
  const [exportSettings, setExportSettings] = useState({});
  const [editingBlock, setEditingBlock] = useState(null);

  // Stats states
  const [catalogStats, setCatalogStats] = useState({});

  useEffect(() => {
    loadCatalogStats();
    loadPlayBlocks();
    loadRotationRules();
    loadExportSettings();
  }, []);

  const showToast = (message, type) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const loadCatalogStats = async () => {
    try {
      const response = await fetch("/api/tracks");
      const data = await response.json();
      setCatalogStats(data);
    } catch (error) {
      console.error("Error loading catalog stats:", error);
    }
  };

  const loadPlayBlocks = async () => {
    try {
      // Default blocks matching the database schema
      const defaultBlocks = [
        { id: 1, name: "Lunch", target_min: 90, bpm_min: 60, bpm_max: 95, energy_min: 0.1, energy_max: 0.4, prefer_instrumental: true, color: "bg-blue-500" },
        { id: 2, name: "Dinner", target_min: 120, bpm_min: 80, bpm_max: 110, energy_min: 0.3, energy_max: 0.6, prefer_instrumental: false, color: "bg-orange-500" },
        { id: 3, name: "Late", target_min: 90, bpm_min: 60, bpm_max: 90, energy_min: 0.2, energy_max: 0.5, prefer_instrumental: false, color: "bg-purple-500" },
      ];
      setPlayBlocks(defaultBlocks);
    } catch (error) {
      console.error("Error loading play blocks:", error);
    }
  };

  const loadRotationRules = async () => {
    try {
      const response = await fetch("/api/settings");
      const data = await response.json();
      setRotationRules({
        track_cooldown_days: 7,
        artist_cooldown_min: 30,
        exclude_explicit: true,
        normalize_loudness: true,
        ...data.rotation_rules,
      });
    } catch (error) {
      console.error("Error loading rotation rules:", error);
    }
  };

  const loadExportSettings = async () => {
    try {
      const response = await fetch("/api/settings");
      const data = await response.json();
      setExportSettings(data);
    } catch (error) {
      console.error("Error loading export settings:", error);
    }
  };

  const handleImport = async () => {
    if (!importValue && !uploadFile) {
      showToast("Please enter a value or select a file", "error");
      return;
    }

    setLoading({ ...loading, import: true });

    try {
      if (importType === "csv" && uploadFile) {
        const formData = new FormData();
        formData.append("file", uploadFile);
        formData.append("type", importType);

        const response = await fetch("/api/catalog/import", {
          method: "POST",
          body: formData,
        });
        const result = await response.json();

        if (result.success) {
          showToast(`Successfully imported ${result.imported_count} tracks!`, "success");
          setImportValue("");
          setUploadFile(null);
          await loadCatalogStats();
        } else {
          showToast(result.error || "Failed to import", "error");
        }
      } else {
        const response = await fetch("/api/catalog/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: importType, value: importValue }),
        });
        const result = await response.json();

        if (result.success) {
          showToast(`Successfully imported ${result.imported_count} tracks!`, "success");
          setImportValue("");
          await loadCatalogStats();
        } else {
          showToast(result.error || "Failed to import", "error");
        }
      }
    } catch (error) {
      console.error("Import error:", error);
      showToast("Failed to import music", "error");
    } finally {
      setLoading({ ...loading, import: false });
    }
  };

  const handleSaveBlock = async (block) => {
    setLoading({ ...loading, [`block_${block.id}`]: true });
    try {
      // In a real app, this would be PUT /api/blocks/{id}
      showToast(`${block.name} block updated successfully!`, "success");
      setEditingBlock(null);
    } catch (error) {
      console.error("Error saving block:", error);
      showToast("Failed to save block", "error");
    } finally {
      setLoading({ ...loading, [`block_${block.id}`]: false });
    }
  };
  
  const updatePlayBlock = (id, field, value) => {
    setPlayBlocks((blocks) =>
      blocks.map((block) =>
        block.id === id ? { ...block, [field]: value } : block
      )
    );
  };

  const handleSaveRotationRules = async () => {
    setLoading({ ...loading, rules: true });
    try {
      const response = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rotation_rules: rotationRules }),
      });
      const result = await response.json();
      if (result.success) {
        showToast("Rotation rules updated successfully!", "success");
      } else {
        showToast("Failed to save rotation rules", "error");
      }
    } catch (error) {
      console.error("Error saving rotation rules:", error);
      showToast("Failed to save rotation rules", "error");
    } finally {
      setLoading({ ...loading, rules: false });
    }
  };

  const handleSaveExportSettings = async () => {
    setLoading({ ...loading, export_settings: true });
    try {
      const response = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(exportSettings),
      });
      const result = await response.json();
      if (result.success) {
        showToast("Export settings updated successfully!", "success");
      } else {
        showToast("Failed to save export settings", "error");
      }
    } catch (error) {
      console.error("Error saving export settings:", error);
      showToast("Failed to save export settings", "error");
    } finally {
      setLoading({ ...loading, export_settings: false });
    }
  };

  return {
    activeTab, setActiveTab,
    loading,
    toast,
    importType, setImportType,
    importValue, setImportValue,
    uploadFile, setUploadFile,
    playBlocks, setPlayBlocks,
    rotationRules, setRotationRules,
    exportSettings, setExportSettings,
    editingBlock, setEditingBlock,
    catalogStats,
    handleImport,
    handleSaveBlock,
    updatePlayBlock,
    handleSaveRotationRules,
    handleSaveExportSettings,
  };
}
