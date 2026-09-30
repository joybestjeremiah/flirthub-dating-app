import { StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { AuthProvider } from '@/context/AuthContext';
import ContactAdmin from '@/components/ContactAdmin';
import './index.css';

function CameraCaptureSupport() {
  useEffect(() => {
    const applyCameraCapture = () => {
      document.querySelectorAll<HTMLInputElement>('input[type="file"]').forEach((input) => {
        if (input.accept?.includes('image')) input.setAttribute('capture', 'user');
      });
    };

    applyCameraCapture();
    const observer = new MutationObserver(applyCameraCapture);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);
  return null;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <CameraCaptureSupport />
      <App />
      <ContactAdmin />
    </AuthProvider>
  </StrictMode>
);
