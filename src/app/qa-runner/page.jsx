"use client";

import { useState } from "react";
import {
  Play,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  Loader,
  Database,
  Music,
  Download,
  Calendar,
  BarChart3,
  Clock,
  Target,
} from "lucide-react";

export default function QARunnerPage() {
  const [testResults, setTestResults] = useState({});
  const [loading, setLoading] = useState({});
  const [currentStep, setCurrentStep] = useState(null);

  const testSequence = [
    {
      id: "seed_catalog",
      name: "Import Seeds (3 fuentes por bloque)",
      description: "Import seed data and confirm effective catalog",
      icon: Database,
      color: "text-blue-600",
    },
    {
      id: "generate_daily",
      name: "Generate Today: Lunch → Dinner → Late",
      description: "Generate sequential playlists with duration checks",
      icon: Music,
      color: "text-green-600",
    },
    {
      id: "export_playlists",
      name: "Export CSV/M3U to /Playlists/{YYYY-MM-DD}/",
      description: "Export to structured folder format",
      icon: Download,
      color: "text-orange-600",
    },
    {
      id: "create_weekly_locked",
      name: "Create Weekly Plan (Locked)",
      description: "Generate 7-day schedule and mark as locked",
      icon: Calendar,
      color: "text-purple-600",
    },
    {
      id: "analytics_report",
      name: "Repeats & BPM/Energy Report",
      description: "Show avoided repeats and block analytics",
      icon: BarChart3,
      color: "text-red-600",
    },
  ];

  const runTest = async (testId) => {
    setLoading({ ...loading, [testId]: true });
    setCurrentStep(testId);

    try {
      const response = await fetch("/api/qa-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: testId }),
      });

      const result = await response.json();

      setTestResults({
        ...testResults,
        [testId]: result,
      });
    } catch (error) {
      setTestResults({
        ...testResults,
        [testId]: {
          success: false,
          error: error.message,
          steps: [],
        },
      });
    } finally {
      setLoading({ ...loading, [testId]: false });
      setCurrentStep(null);
    }
  };

  const runFullQA = async () => {
    setLoading({ full_qa: true });
    setCurrentStep("full_qa");

    try {
      const response = await fetch("/api/qa-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "full_qa" }),
      });

      const result = await response.json();

      setTestResults({ full_qa: result });
    } catch (error) {
      setTestResults({
        full_qa: {
          success: false,
          error: error.message,
        },
      });
    } finally {
      setLoading({ full_qa: false });
      setCurrentStep(null);
    }
  };

  const getTestStatus = (testId) => {
    const result = testResults[testId];
    if (!result) return "pending";
    return result.success ? "success" : "error";
  };

  const formatDuration = (ms) => {
    if (!ms) return "0s";
    const seconds = Math.round(ms / 1000);
    return seconds < 60 ? `${seconds}s` : `${Math.round(seconds / 60)}m`;
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] dark:bg-[#0A0A0A] p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="bg-white dark:bg-[#1E1E1E] border border-[#E6E6E6] dark:border-[#333333] rounded-xl p-8 mb-8">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div>
              <h1 className="text-3xl lg:text-4xl font-bold text-black dark:text-white font-sora mb-3">
                QA Test Runner
              </h1>
              <p className="text-lg text-[#6F6F6F] dark:text-[#AAAAAA] font-opensans">
                Comprehensive testing suite for Michelin Playlist system
              </p>
            </div>

            <div className="flex items-center space-x-4">
              <button
                onClick={runFullQA}
                disabled={loading.full_qa}
                className="flex items-center space-x-3 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-all duration-150 active:scale-95 disabled:opacity-50"
              >
                {loading.full_qa ? (
                  <Loader className="w-5 h-5 animate-spin" />
                ) : (
                  <Play className="w-5 h-5" />
                )}
                <span>{loading.full_qa ? "Running..." : "Run Full QA"}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Current Step Indicator */}
        {currentStep && (
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 mb-8">
            <div className="flex items-center space-x-3">
              <Loader className="w-5 h-5 animate-spin text-blue-600" />
              <span className="text-blue-800 dark:text-blue-200 font-semibold">
                Running:{" "}
                {testSequence.find((t) => t.id === currentStep)?.name ||
                  "Full QA"}
              </span>
            </div>
          </div>
        )}

        {/* Test Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {testSequence.map((test) => {
            const Icon = test.icon;
            const status = getTestStatus(test.id);
            const result = testResults[test.id];
            const isLoading = loading[test.id];

            return (
              <div
                key={test.id}
                className="bg-white dark:bg-[#1E1E1E] border border-[#E6E6E6] dark:border-[#333333] rounded-xl p-6"
              >
                {/* Test Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div
                      className={`w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center ${test.color}`}
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-black dark:text-white font-sora">
                        {test.name}
                      </h3>
                      <p className="text-sm text-[#6F6F6F] dark:text-[#AAAAAA] font-opensans">
                        {test.description}
                      </p>
                    </div>
                  </div>

                  {/* Status Indicator */}
                  <div className="flex items-center space-x-2">
                    {status === "success" && (
                      <CheckCircle className="w-6 h-6 text-green-500" />
                    )}
                    {status === "error" && (
                      <AlertTriangle className="w-6 h-6 text-red-500" />
                    )}
                    {status === "pending" && (
                      <div className="w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-700"></div>
                    )}
                  </div>
                </div>

                {/* Test Results */}
                {result && (
                  <div className="mb-4 p-3 bg-[#F5F5F5] dark:bg-[#2A2A2A] rounded-lg">
                    <div className="text-sm space-y-2">
                      {result.steps?.map((step, idx) => (
                        <div key={idx} className="flex items-center space-x-2">
                          {step.success ? (
                            <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                          ) : (
                            <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
                          )}
                          <span className="text-[#4D4D4D] dark:text-[#B0B0B0] font-opensans">
                            {step.name}
                          </span>
                        </div>
                      ))}

                      {/* Specific result details */}
                      {test.id === "seed_catalog" &&
                        result.steps?.[0]?.catalog_effectiveness && (
                          <div className="mt-3 pt-3 border-t border-[#E6E6E6] dark:border-[#333333]">
                            <div className="grid grid-cols-3 gap-2 text-xs">
                              <div>
                                <span className="font-semibold">Lunch:</span>{" "}
                                {result.steps[0].catalog_effectiveness.lunch.tracks}{" "}
                                tracks,{" "}
                                {Math.round(
                                  result.steps[0].catalog_effectiveness.lunch
                                    .hours * 10,
                                ) / 10}
                                h
                              </div>
                              <div>
                                <span className="font-semibold">Dinner:</span>{" "}
                                {result.steps[0].catalog_effectiveness.dinner.tracks}{" "}
                                tracks,{" "}
                                {Math.round(
                                  result.steps[0].catalog_effectiveness.dinner
                                    .hours * 10,
                                ) / 10}
                                h
                              </div>
                              <div>
                                <span className="font-semibold">Late:</span>{" "}
                                {result.steps[0].catalog_effectiveness.late.tracks}{" "}
                                tracks,{" "}
                                {Math.round(
                                  result.steps[0].catalog_effectiveness.late
                                    .hours * 10,
                                ) / 10}
                                h
                              </div>
                            </div>
                          </div>
                        )}

                      {test.id === "generate_daily" &&
                        result.steps?.[0]?.blocks && (
                          <div className="mt-3 pt-3 border-t border-[#E6E6E6] dark:border-[#333333]">
                            {result.steps[0].blocks.map((block, bidx) => (
                              <div
                                key={bidx}
                                className="flex items-center justify-between text-xs"
                              >
                                <span className="font-semibold">
                                  {block.block}:
                                </span>
                                <span>
                                  {block.duration_check?.actual_min}min{" "}
                                  {block.duration_check?.within_tolerance ? (
                                    <CheckCircle className="w-3 h-3 text-green-500 inline" />
                                  ) : (
                                    <AlertTriangle className="w-3 h-3 text-red-500 inline" />
                                  )}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                    </div>
                  </div>
                )}

                {/* Run Button */}
                <button
                  onClick={() => runTest(test.id)}
                  disabled={isLoading}
                  className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-[#F5F5F5] dark:bg-[#2A2A2A] border border-[#D9D9D9] dark:border-[#404040] text-[#4D4D4D] dark:text-[#B0B0B0] hover:bg-[#EEEEEE] dark:hover:bg-[#333333] rounded-lg transition-all duration-150 disabled:opacity-50"
                >
                  {isLoading ? (
                    <Loader className="w-4 h-4 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4" />
                  )}
                  <span>{isLoading ? "Running..." : "Run Test"}</span>
                </button>
              </div>
            );
          })}
        </div>

        {/* Full QA Results */}
        {testResults.full_qa && (
          <div className="bg-white dark:bg-[#1E1E1E] border border-[#E6E6E6] dark:border-[#333333] rounded-xl p-6">
            <div className="flex items-center space-x-3 mb-6">
              <div
                className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  testResults.full_qa.success
                    ? "bg-green-100 dark:bg-green-900 text-green-600"
                    : "bg-red-100 dark:bg-red-900 text-red-600"
                }`}
              >
                {testResults.full_qa.success ? (
                  <CheckCircle className="w-6 h-6" />
                ) : (
                  <AlertTriangle className="w-6 h-6" />
                )}
              </div>
              <div>
                <h3 className="text-xl font-bold text-black dark:text-white font-sora">
                  Full QA Results
                </h3>
                <p className="text-[#6F6F6F] dark:text-[#AAAAAA] font-opensans">
                  {testResults.full_qa.summary ? (
                    <>
                      {testResults.full_qa.summary.successful_steps}/
                      {testResults.full_qa.summary.total_steps} tests passed
                    </>
                  ) : (
                    "Test execution completed"
                  )}
                </p>
              </div>
            </div>

            {/* Summary Grid */}
            {testResults.full_qa.summary && (
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="text-center p-4 bg-[#F5F5F5] dark:bg-[#2A2A2A] rounded-lg">
                  <div className="text-2xl font-bold text-green-600 dark:text-green-400 font-sora">
                    {testResults.full_qa.summary.successful_steps}
                  </div>
                  <div className="text-sm text-[#6F6F6F] dark:text-[#AAAAAA] font-opensans">
                    Passed
                  </div>
                </div>
                <div className="text-center p-4 bg-[#F5F5F5] dark:bg-[#2A2A2A] rounded-lg">
                  <div className="text-2xl font-bold text-red-600 dark:text-red-400 font-sora">
                    {testResults.full_qa.summary.failed_steps}
                  </div>
                  <div className="text-sm text-[#6F6F6F] dark:text-[#AAAAAA] font-opensans">
                    Failed
                  </div>
                </div>
                <div className="text-center p-4 bg-[#F5F5F5] dark:bg-[#2A2A2A] rounded-lg">
                  <div className="text-2xl font-bold text-blue-600 dark:text-blue-400 font-sora">
                    {testResults.full_qa.summary.total_steps}
                  </div>
                  <div className="text-sm text-[#6F6F6F] dark:text-[#AAAAAA] font-opensans">
                    Total
                  </div>
                </div>
              </div>
            )}

            {/* Detailed Steps */}
            <div className="space-y-3">
              <h4 className="text-lg font-semibold text-black dark:text-white font-sora">
                Detailed Results
              </h4>
              {testResults.full_qa.steps?.map((step, idx) => (
                <div
                  key={idx}
                  className="flex items-start space-x-3 p-3 bg-[#F5F5F5] dark:bg-[#2A2A2A] rounded-lg"
                >
                  {step.success ? (
                    <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <div className="font-semibold text-black dark:text-white font-sora">
                      {step.name}
                    </div>
                    {step.error && (
                      <div className="text-sm text-red-600 dark:text-red-400 mt-1">
                        {step.error}
                      </div>
                    )}
                    {step.substeps && (
                      <div className="mt-2 space-y-1">
                        {step.substeps.map((substep, sidx) => (
                          <div
                            key={sidx}
                            className="text-sm flex items-center space-x-2"
                          >
                            {substep.success ? (
                              <CheckCircle className="w-3 h-3 text-green-500" />
                            ) : (
                              <AlertTriangle className="w-3 h-3 text-red-500" />
                            )}
                            <span className="text-[#4D4D4D] dark:text-[#B0B0B0] font-opensans">
                              {substep.source}: {substep.tracks_imported} tracks
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Analytics Section */}
        {testResults.analytics_report?.steps?.[0] && (
          <div className="bg-white dark:bg-[#1E1E1E] border border-[#E6E6E6] dark:border-[#333333] rounded-xl p-6 mt-8">
            <h3 className="text-xl font-bold text-black dark:text-white font-sora mb-6">
              Analytics Report
            </h3>

            {/* Repeats Analysis */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="text-center p-4 bg-[#F5F5F5] dark:bg-[#2A2A2A] rounded-lg">
                <div className="text-2xl font-bold text-green-600 dark:text-green-400 font-sora">
                  {testResults.analytics_report.steps[0].repeats_analysis?.track_repeats_avoided || 0}
                </div>
                <div className="text-sm text-[#6F6F6F] dark:text-[#AAAAAA] font-opensans">
                  Track Repeats Avoided
                </div>
              </div>
              <div className="text-center p-4 bg-[#F5F5F5] dark:bg-[#2A2A2A] rounded-lg">
                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400 font-sora">
                  {testResults.analytics_report.steps[0].repeats_analysis?.artist_repeats_avoided || 0}
                </div>
                <div className="text-sm text-[#6F6F6F] dark:text-[#AAAAAA] font-opensans">
                  Artist Repeats Avoided
                </div>
              </div>
              <div className="text-center p-4 bg-[#F5F5F5] dark:bg-[#2A2A2A] rounded-lg">
                <div className="text-2xl font-bold text-orange-600 dark:text-orange-400 font-sora">
                  {testResults.analytics_report.steps[0].repeats_analysis?.total_slots || 0}
                </div>
                <div className="text-sm text-[#6F6F6F] dark:text-[#AAAAAA] font-opensans">
                  Total Playlist Slots
                </div>
              </div>
            </div>

            {/* Block Averages */}
            {testResults.analytics_report.steps[0].block_averages && (
              <div>
                <h4 className="text-lg font-semibold text-black dark:text-white font-sora mb-4">
                  Block Averages (Last 7 Days)
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {testResults.analytics_report.steps[0].block_averages.map(
                    (block, idx) => (
                      <div
                        key={idx}
                        className="p-4 bg-[#F5F5F5] dark:bg-[#2A2A2A] rounded-lg"
                      >
                        <div className="text-lg font-bold text-black dark:text-white font-sora mb-2">
                          {block.block_name}
                        </div>
                        <div className="space-y-1 text-sm font-opensans">
                          <div className="flex justify-between">
                            <span className="text-[#6F6F6F] dark:text-[#AAAAAA]">
                              Tracks:
                            </span>
                            <span className="text-black dark:text-white">
                              {block.total_tracks}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-[#6F6F6F] dark:text-[#AAAAAA]">
                              Avg BPM:
                            </span>
                            <span className="text-black dark:text-white">
                              {block.avg_bpm}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-[#6F6F6F] dark:text-[#AAAAAA]">
                              Avg Energy:
                            </span>
                            <span className="text-black dark:text-white">
                              {block.avg_energy}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-[#6F6F6F] dark:text-[#AAAAAA]">
                              Avg Duration:
                            </span>
                            <span className="text-black dark:text-white">
                              {block.avg_duration_min}m
                            </span>
                          </div>
                        </div>
                      </div>
                    ),
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}