import { useEffect, useState } from "react";

interface ToastProps {
  message: string;
  visible: boolean;
}

const Toast = ({ message, visible }: ToastProps) => {
  const [render, setRender] = useState(visible);

  useEffect(() => {
    if (visible) setRender(true);
    else {
      const t = setTimeout(() => setRender(false), 320);
      return () => clearTimeout(t);
    }
  }, [visible]);

  if (!render) return null;

  return (
    <div
      role="status"
      className={`fixed left-1/2 -translate-x-1/2 bottom-6 z-[100] px-5 py-3 rounded-xl bg-navy-2 border border-white/10 shadow-elevated font-sans text-sm text-white whitespace-nowrap transition-opacity duration-300 ${
        visible ? "opacity-100" : "opacity-0"
      }`}
    >
      {message}
    </div>
  );
};

export default Toast;
