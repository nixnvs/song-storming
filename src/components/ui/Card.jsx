export default function Card({ className = "", children, ...props }) {
  return (
    <div
      className={
        `bg-spotify-card border border-spotify-border rounded-xl shadow-[0_8px_24px_rgba(0,0,0,0.25)] ${className}`
      }
      {...props}
    >
      {children}
    </div>
  );
}

