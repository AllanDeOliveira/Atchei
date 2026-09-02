import { useEffect, useState } from 'react';
import { Bell, BellRing } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import {
  notificationsSupported,
  getNotificationPermission,
  enableNotifications,
  disableNotifications,
} from '../lib/notifications';

// Só renderiza se a chave VAPID estiver configurada (sem ela o push não funciona).
const HAS_VAPID = !!import.meta.env.VITE_FIREBASE_VAPID_KEY;

/**
 * Sininho ao lado de "Editar perfil": contorno vazio = notificações desativadas,
 * sino preenchido (tocando) = ativadas. Um toque alterna.
 */
export const NotificationToggle = () => {
  const { user } = useAuth();
  const [supported, setSupported] = useState<boolean | null>(null);
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('default');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const ok = await notificationsSupported();
      if (!active) return;
      setSupported(ok);
      setPermission(getNotificationPermission());
    })();
    return () => {
      active = false;
    };
  }, []);

  // Não exibe nada quando não há suporte, chave ou usuário logado (ou ainda verificando).
  if (!HAS_VAPID || !user || !supported || permission === 'unsupported') {
    return null;
  }

  const ativas = permission === 'granted';

  const handleToggle = async () => {
    if (!user || busy) return;
    if (permission === 'denied') {
      toast.error('Notificações bloqueadas. Libere nas configurações do navegador.');
      return;
    }
    setBusy(true);
    try {
      if (ativas) {
        await disableNotifications();
        // A permissão do navegador continua concedida; apenas removemos o token.
        setPermission('default');
        toast.success('Notificações desativadas neste dispositivo.');
      } else {
        const result = await enableNotifications(user.id);
        if (result === 'granted') {
          setPermission('granted');
          toast.success('Notificações ativadas!');
        } else if (result === 'denied') {
          setPermission('denied');
          toast.error('Permissão negada. Ative nas configurações do navegador.');
        } else {
          toast.error('Não foi possível ativar as notificações neste dispositivo.');
        }
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      onClick={handleToggle}
      disabled={busy}
      title={ativas ? 'Desativar notificações' : 'Ativar notificações'}
      aria-label={ativas ? 'Desativar notificações' : 'Ativar notificações'}
      aria-pressed={ativas}
      className="p-1.5 bg-surface border border-glassBorder hover:border-accent/40 rounded-lg text-textLight transition-all duration-200 cursor-pointer hover:-translate-y-0.5 active:translate-y-0 neo-click disabled:opacity-50"
    >
      {ativas ? <BellRing size={16} fill="currentColor" /> : <Bell size={16} />}
    </button>
  );
};
