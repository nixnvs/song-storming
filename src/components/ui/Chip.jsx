export default function Chip({ className = "", children, ...props }) {
  return (
    <span
      className={`bg-[#232323] text-spotify-mute rounded-full px-2.5 py-1 text-xs ${className}`}
      {...props}
    >
      {children}
    </span>
  );
}

