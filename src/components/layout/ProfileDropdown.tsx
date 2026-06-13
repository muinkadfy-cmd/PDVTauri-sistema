import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AppIcon } from '@/components/ui/AppIcon';
import { getCurrentUser, getCurrentSession, logout } from '@/lib/auth-supabase';
import { Usuario } from '@/types';
import { APP_EVENTS } from '@/lib/app-events';
import { getSoundEffectsEnabled, playAppSound, setSoundEffectsEnabled } from '@/lib/sound-effects';
import './ProfileDropdown.css';

interface ProfileDropdownProps {
  isOpen: boolean;
  onClose: () => void;
}

function ProfileDropdown({ isOpen, onClose }: ProfileDropdownProps) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [role, setRole] = useState<string>('');
  const [soundEffectsOn, setSoundEffectsOn] = useState(() => getSoundEffectsEnabled());
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (isOpen) {
      const user = getCurrentUser();
      const session = getCurrentSession();
      setUsuario(user);
      setRole(session?.role || '');
    }
  }, [isOpen]);

  useEffect(() => {
    const syncSoundPreference = (event: Event) => {
      const enabled = (event as CustomEvent<{ enabled?: boolean }>).detail?.enabled;
      setSoundEffectsOn(typeof enabled === 'boolean' ? enabled : getSoundEffectsEnabled());
    };

    window.addEventListener(APP_EVENTS.UI_SOUNDS_CHANGED, syncSoundPreference as EventListener);
    return () => window.removeEventListener(APP_EVENTS.UI_SOUNDS_CHANGED, syncSoundPreference as EventListener);
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        onClose();
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen, onClose]);

  if (!isOpen || !usuario) return null;

  const handleLogout = () => {
    logout();
    onClose();
    navigate('/login', { replace: true });
  };

  const toggleSoundEffects = () => {
    const next = !soundEffectsOn;
    setSoundEffectsEnabled(next);
    setSoundEffectsOn(next);
    if (next) {
      playAppSound('success');
    }
  };

  const testSoundEffects = () => {
    setSoundEffectsEnabled(true);
    setSoundEffectsOn(true);
    playAppSound('success');
  };

  return (
    <div className="profile-dropdown" ref={dropdownRef}>
      <div className="profile-header">
        <div className="profile-info">
          <div className="profile-name">{usuario.nome || 'Usuário'}</div>
          {role && (
            <div className="profile-role" style={{ 
              fontSize: '0.75rem', 
              color: 'var(--text-secondary, #666)',
              textTransform: 'capitalize'
            }}>
              {role === 'admin' ? '👑 Administrador' : role === 'atendente' ? '💼 Atendente' : '🔧 Técnico'}
            </div>
          )}
          {usuario.cargo && <div className="profile-cargo">{usuario.cargo}</div>}
          {usuario.email && <div className="profile-email">{usuario.email}</div>}
        </div>
      </div>

      <div className="profile-menu">
        <Link
          to="/configuracoes"
          className="profile-menu-item"
          onClick={onClose}
        >
          <span className="menu-icon">⚙️</span>
          <span>Configurações</span>
        </Link>

        <button
          type="button"
          className="profile-menu-item profile-sound-toggle"
          onClick={toggleSoundEffects}
          aria-pressed={soundEffectsOn}
        >
          <span className="menu-icon">♪</span>
          <span className="profile-sound-toggle__text">Sons do sistema</span>
          <span className={`profile-sound-toggle__badge ${soundEffectsOn ? 'on' : ''}`}>
            {soundEffectsOn ? 'Ligado' : 'Desligado'}
          </span>
        </button>

        <button
          type="button"
          className="profile-menu-item profile-sound-test"
          onClick={testSoundEffects}
        >
          <span className="menu-icon">▶</span>
          <span>Testar som</span>
        </button>

        <div className="profile-divider" />

        <button
          type="button"
          className="profile-menu-item profile-logout"
          onClick={handleLogout}
          title="Logout"
          aria-label="Sair do sistema"
        >
          <span className="menu-icon" aria-hidden="true"><AppIcon name="home" size={18} /></span>
          <span className="profile-logout-copy">
            <strong>Logout</strong>
            <small>Sair do sistema e voltar para o login</small>
          </span>
        </button>
      </div>
    </div>
  );
}

export default ProfileDropdown;
