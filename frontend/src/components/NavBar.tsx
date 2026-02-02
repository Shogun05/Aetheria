import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { isLoggedIn, logout } from '../lib/auth';

export default function NavBar() {
  const navigate = useNavigate();
  const handleLogout = () => {
    logout();
    navigate('/login');
  };
  return (
    <header className="sticky top-0 z-30 backdrop-blur supports-[backdrop-filter]:bg-base/80 border-b border-white/10 shadow-[0_1px_30px_rgba(124,247,240,0.1)]">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <Link to="/" className="group flex items-center gap-2">
          <motion.span
            className="text-xl font-semibold tracking-wide text-accent group-hover:text-highlight transition-colors duration-300"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            Aetheria
          </motion.span>
          <motion.div
            className="w-2 h-2 rounded-full bg-accent"
            animate={{
              scale: [1, 1.2, 1],
              opacity: [0.5, 1, 0.5]
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          />
        </Link>
        <nav className="hidden md:flex items-center gap-6">
          <NavLink
            to="/gallery"
            className={({ isActive }) => `relative group hover:text-accent transition-colors duration-200 ${isActive ? 'text-accent' : ''}`}
          >
            Gallery
            <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-accent transition-all duration-300 group-hover:w-full" />
          </NavLink>
          <NavLink
            to="/featured"
            className={({ isActive }) => `relative group hover:text-accent transition-colors duration-200 ${isActive ? 'text-accent' : ''}`}
          >
            Featured
            <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-accent transition-all duration-300 group-hover:w-full" />
          </NavLink>
          <NavLink
            to="/marketplace"
            className={({ isActive }) => `relative group hover:text-highlight transition-colors duration-200 ${isActive ? 'text-highlight' : ''}`}
          >
            Marketplace
            <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-highlight transition-all duration-300 group-hover:w-full" />
          </NavLink>
          <NavLink
            to="/upload"
            className={({ isActive }) => `relative group hover:text-highlight transition-colors duration-200 ${isActive ? 'text-highlight' : ''}`}
          >
            Upload
            <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-highlight transition-all duration-300 group-hover:w-full" />
          </NavLink>
          <NavLink
            to="/profile"
            className={({ isActive }) => `relative group hover:text-accent transition-colors duration-200 ${isActive ? 'text-accent' : ''}`}
          >
            Profile
            <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-accent transition-all duration-300 group-hover:w-full" />
          </NavLink>
          <NavLink
            to="/help"
            className={({ isActive }) => `relative group hover:text-accent transition-colors duration-200 ${isActive ? 'text-accent' : ''}`}
          >
            Help
            <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-accent transition-all duration-300 group-hover:w-full" />
          </NavLink>
        </nav>
        <div className="flex items-center gap-3">
          <ConnectButton showBalance={false} label="Connect" accountStatus={{ smallScreen: 'avatar', largeScreen: 'full' }} />
          {isLoggedIn() && (
            <button
              onClick={handleLogout}
              className="px-3 py-1.5 rounded-md border border-white/10 bg-card/30 hover:bg-card/50 text-sm text-gray-200"
            >
              Logout
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
