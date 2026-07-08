import { Navigate } from "react-router-dom";

export const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const isAdmin =
    typeof window !== "undefined" && localStorage.getItem("adminAuth") === "true";
  return isAdmin ? <>{children}</> : <Navigate to="/admin/login" replace />;
};
