import { CheckCircle, AlertTriangle } from "lucide-react";

export function Toast({ toast }) {
  if (!toast) return null;

  return (
    <div
      className={`fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg ${
        toast.type === "success"
          ? "bg-green-500 text-white"
          : "bg-red-500 text-white"
      }`}
    >
      <div className="flex items-center space-x-2">
        {toast.type === "success" ? (
          <CheckCircle className="w-5 h-5" />
        ) : (
          <AlertTriangle className="w-5 h-5" />
        )}
        <span>{toast.message}</span>
      </div>
    </div>
  );
}
