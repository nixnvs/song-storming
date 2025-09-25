const base = "inline-flex items-center justify-center rounded-full focus:outline-none focus:ring-2 focus:ring-spotify-green transition-colors font-medium";

const variants = {
  primary:
    "bg-spotify-green hover:bg-spotify-greenDark text-black px-4 py-2",
  secondary:
    "bg-spotify-card hover:bg-[#232323] border border-spotify-border text-spotify-text px-4 py-2",
  ghost:
    "bg-transparent hover:bg-spotify-card text-spotify-text px-3 py-2",
};

export default function Button({ variant = "primary", className = "", children, ...props }) {
  return (
    <button className={`${base} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
}

