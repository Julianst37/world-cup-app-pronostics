import { useEffect } from 'react';

/**
 * Componente de anuncios de Google AdSense
 * @param {string} format - Formato del anuncio ('auto', 'horizontal', 'vertical', 'rectangle')
 */
export default function AdUnit({ format = 'auto' }) {
  useEffect(() => {
    // Reiniciar Google Ads cuando el componente se monta
    if (window.adsbygoogle) {
      try {
        window.adsbygoogle.push({});
      } catch (e) {
        console.warn('AdSense no está disponible:', e);
      }
    }
  }, []);

  // Mapeo de formatos a estilos
  const styleMap = {
    auto: { display: 'block' },
    horizontal: { display: 'block', width: '100%', height: '90px' },
    vertical: { display: 'block', width: '300px', height: '600px' },
    rectangle: { display: 'block', width: '300px', height: '250px' },
  };

  return (
    <div className="flex justify-center">
      <ins
        className="adsbygoogle"
        style={styleMap[format]}
        data-ad-client="ca-pub-9779770561713795"
        data-ad-slot="9779770561713795"
        data-ad-format={format}
        data-full-width-responsive={format === 'auto' ? 'true' : 'false'}
      />
    </div>
  );
}
