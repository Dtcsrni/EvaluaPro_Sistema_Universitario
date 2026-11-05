import { useEffect, useRef, useState } from 'react';

export function useGuiaContextual(clavePreferencia: string, idControl: string) {
  const [visible, setVisible] = useState(() => {
    try {
      return localStorage.getItem(clavePreferencia) === 'false';
    } catch {
      return false;
    }
  });
  const devolverFoco = useRef(false);

  useEffect(() => {
    if (!devolverFoco.current) return;
    devolverFoco.current = false;
    document.getElementById(idControl)?.focus();
  }, [idControl, visible]);

  function toggleGuia() {
    devolverFoco.current = true;
    setVisible((actual) => {
      const siguiente = !actual;
      try {
        localStorage.setItem(clavePreferencia, siguiente ? 'false' : 'true');
      } catch {
        // La guía sigue funcionando aunque las preferencias no se puedan persistir.
      }
      return siguiente;
    });
  }

  return { visible, toggleGuia };
}
