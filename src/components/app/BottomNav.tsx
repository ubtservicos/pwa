import { NavLink } from "react-router-dom";
import { Home, Grid3x3, BarChart2, Settings } from "lucide-react";

const items = [
  { to: "/app/home", label: "Início", Icon: Home },
  { to: "/app/gerenciar", label: "Gerenciar", Icon: BarChart2 },
  { to: "/app/config", label: "Config", Icon: Settings },
];

const BottomNav = () => {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 h-16 bg-navy border-t flex items-center justify-around"
      style={{ borderTopColor: "rgba(255,255,255,0.07)", zIndex: 9999 }}
    >
      {items.map(({ to, label, Icon }) => (
        <NavLink
          key={to}
          to={to}
          end
          className={({ isActive }) =>
            `flex flex-col items-center justify-center gap-1 flex-1 h-full transition-colors ${
              isActive ? "text-green" : ""
            }`
          }
          style={({ isActive }) => ({
            color: isActive ? "#0DB87E" : "rgba(255,255,255,0.35)",
          })}
        >
          <Icon size={22} strokeWidth={2} />
          <span className="font-sans text-[10px] font-medium">{label}</span>
        </NavLink>
      ))}
    </nav>
  );
};

export default BottomNav;
