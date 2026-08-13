import React from "react";
import { Navigate } from "react-router-dom";
import { useCurrentUser } from "../../hooks/useCurrentUser";

export const AssociacaoRoute = ({ children }: { children: React.ReactNode }) => {
  const user = useCurrentUser();

  if (!user.uid) {
    return <Navigate to="/login" replace />;
  }

  if (user.role !== "associacao" && user.role !== "admin") {
    return <Navigate to="/app/home" replace />;
  }

  return <>{children}</>;
};
