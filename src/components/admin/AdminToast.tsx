import { createContext, useCallback, useContext, useState } from "react";
import { CheckCircle2 } from "lucide-react";

type ToastCtx = { show: (msg: string) => void };
const Ctx = createContext<ToastCtx>({ show: () => {} });

export const AdminToastProvider = ({ children }: { children: React.ReactNode }) => {
  const [msg, setMsg] = useState<string | null>(null);
  const show = useCallback((m: string) => {
    setMsg(m);
    setTimeout(() => setMsg(null), 2400);
  }, []);
  return (
    <Ctx.Provider value={{ show }}>
      {children}
      {msg && (
        <div
          style={{
            position: "fixed",
            bottom: 24,
            left: "50%",
            transform: "translateX(-50%)",
            background: "#0F172A",
            color: "#fff",
            padding: "12px 20px",
            borderRadius: 10,
            boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
            fontFamily: "DM Sans",
            fontSize: 14,
            display: "flex",
            alignItems: "center",
            gap: 10,
            zIndex: 100,
          }}
        >
          <CheckCircle2 size={16} color="#0DB87E" />
          {msg}
        </div>
      )}
    </Ctx.Provider>
  );
};

export const useAdminToast = () => useContext(Ctx);
