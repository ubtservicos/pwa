import { Link } from "react-router-dom";

export const Navbar = () => {
  return (
    <header className="fixed top-0 inset-x-0 z-50 h-14 bg-navy">
      <div className="h-full max-w-[1100px] mx-auto px-6 flex items-center justify-between">
        <Link to="/" className="font-display font-bold text-white text-xl tracking-tight">
          UBT.
        </Link>
        <Link
          to="/login"
          className="inline-flex items-center justify-center rounded-full border-[1.5px] border-white/25 text-white px-5 py-2 text-[13px] font-semibold hover:bg-white/10 transition-colors"
        >
          Entrar
        </Link>
      </div>
    </header>
  );
};
