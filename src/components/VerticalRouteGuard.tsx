import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { isVerticalEnabled, type VerticalKey } from "@/config/verticalFlags";

interface VerticalRouteGuardProps {
  vertical: VerticalKey;
  redirectTo: string;
  children: ReactNode;
}

export default function VerticalRouteGuard({
  vertical,
  redirectTo,
  children,
}: VerticalRouteGuardProps) {
  if (!isVerticalEnabled(vertical)) {
    return <Navigate to={redirectTo} replace />;
  }
  return <>{children}</>;
}
