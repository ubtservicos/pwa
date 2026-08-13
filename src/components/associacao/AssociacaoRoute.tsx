import React from "react";
import { Navigate } from "react-router-dom";
import { useCurrentUser } from "../../hooks/useCurrentUser";

export const AssociacaoRoute = ({ children }: { children: React.ReactNode }) => {
  const user = useCurrentUser();

  if (user.isLoading) {
    return (
      <div
        style={{
          minHeight: "100svh",
          background: "#09090B",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "DM Sans",
          color: "rgba(255,255,255,0.70)",
        }}
      >
        <span>Verificando credenciais...</span>
      </div>
    );
  }

  if (!user.isLoading && !user.uid) {
    return <Navigate to="/login" replace />;
  }

  if (user.role !== "associacao" && user.role !== "admin") {
    return <Navigate to="/app/home" replace />;
  }

  return <>{children}</>;
};
