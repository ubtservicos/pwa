import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface AuthTopBarProps {
  backTo?: string;
}

const AuthTopBar = ({ backTo }: AuthTopBarProps) => {
  const navigate = useNavigate();
  const handleBack = () => {
    if (backTo) navigate(backTo);
    else navigate(-1);
  };
  return (
    <header className="h-14 flex items-center justify-between -mx-6 px-6">
      <button
        type="button"
        onClick={handleBack}
        aria-label="Voltar"
        className="w-10 h-10 -ml-2 flex items-center justify-center rounded-full text-white hover:bg-white/5 transition-colors"
      >
        <ArrowLeft size={24} strokeWidth={2} />
      </button>
      <span className="font-display font-bold text-white text-lg tracking-tight">
        UBT.
      </span>
      <div className="w-10" aria-hidden />
    </header>
  );
};

export default AuthTopBar;
