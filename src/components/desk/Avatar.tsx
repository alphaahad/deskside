export function Avatar({ size = 32 }: { size?: number }) {
  return (
    <span
      aria-hidden
      className="grid shrink-0 place-items-center rounded-full bg-[#0f766e] font-semibold text-white"
      style={{ width: size, height: size, fontSize: size * 0.42 }}
    >
      M
    </span>
  );
}
