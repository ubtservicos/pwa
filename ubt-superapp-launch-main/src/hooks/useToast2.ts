import { useCallback, useRef, useState } from "react";

export const useSimpleToast = () => {
  const [toast, setToast] = useState<{ msg: string; visible: boolean }>({
    msg: "",
    visible: false,
  });
  const timer = useRef<number | null>(null);

  const showToast = useCallback((msg: string) => {
    if (timer.current) window.clearTimeout(timer.current);
    setToast({ msg, visible: true });
    timer.current = window.setTimeout(() => {
      setToast((t) => ({ ...t, visible: false }));
    }, 3000);
  }, []);

  return { toast, showToast };
};
