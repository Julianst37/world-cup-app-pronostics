function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderPasswordChangeWcTemplate({ userName, resetLink, appName, supportEmail }) {
  const safeUserName = escapeHtml(userName || '');
  const safeResetLink = escapeHtml(resetLink || '');
  const safeAppName = escapeHtml(appName || 'World Cup 2026 Pronosticos');
  const safeSupportEmail = escapeHtml(supportEmail || '');
  const greeting = safeUserName ? `Hola ${safeUserName},` : 'Hola,';

  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Restablecer contrasena</title>
  </head>
  <body style="margin:0;padding:0;background-color:#f4f7fb;font-family:Arial,Helvetica,sans-serif;color:#1f2937;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f4f7fb;margin:0;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;background-color:#ffffff;border:1px solid #e5e7eb;border-radius:18px;overflow:hidden;">
            <tr>
              <td style="background:linear-gradient(135deg,#0f3d91 0%,#1d4ed8 100%);padding:32px 32px 24px 32px;text-align:center;">
                <div style="margin-bottom:16px;">
                  <img src="https://biasports.website/icons/logoBIA.png" alt="BIA Sports Logo" style="max-width:80px;height:auto;display:inline-block;" />
                </div>
                <div style="display:inline-block;background-color:rgba(255,255,255,0.12);color:#ffffff;font-size:12px;letter-spacing:1px;text-transform:uppercase;font-weight:700;padding:8px 12px;border-radius:999px;">
                  ${safeAppName}
                </div>
                <h1 style="margin:18px 0 0 0;color:#ffffff;font-size:28px;line-height:1.2;font-weight:700;">
                  Restablece tu contrasena
                </h1>
                <p style="margin:12px 0 0 0;color:#dbeafe;font-size:15px;line-height:1.6;">
                  Recibimos una solicitud para cambiar el acceso a tu cuenta.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                <p style="margin:0 0 16px 0;font-size:16px;line-height:1.7;color:#374151;">
                  ${greeting}
                </p>
                <p style="margin:0 0 16px 0;font-size:16px;line-height:1.7;color:#374151;">
                  Haz clic en el siguiente boton para crear una nueva contrasena de forma segura.
                </p>
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:28px auto;">
                  <tr>
                    <td align="center" style="border-radius:12px;background-color:#2563eb;">
                      <a href="${safeResetLink}" target="_blank" style="display:inline-block;padding:14px 24px;font-size:16px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:12px;background-color:#2563eb;">
                        Cambiar contrasena
                      </a>
                    </td>
                  </tr>
                </table>
                <p style="margin:0 0 12px 0;font-size:14px;line-height:1.7;color:#6b7280;">
                  Si el boton no funciona, copia y pega este enlace en tu navegador:
                </p>
                <p style="margin:0 0 24px 0;word-break:break-word;">
                  <a href="${safeResetLink}" target="_blank" style="font-size:14px;line-height:1.7;color:#2563eb;text-decoration:none;">
                    ${safeResetLink}
                  </a>
                </p>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:24px 0;border-top:1px solid #e5e7eb;">
                  <tr>
                    <td style="padding-top:24px;">
                      <p style="margin:0 0 12px 0;font-size:14px;line-height:1.7;color:#6b7280;">
                        Si no solicitaste este cambio, puedes ignorar este correo. Tu contrasena actual seguira funcionando hasta que completes el proceso.
                      </p>
                      <p style="margin:0;font-size:14px;line-height:1.7;color:#6b7280;">
                        Si necesitas ayuda, puedes escribirnos a <a href="mailto:${safeSupportEmail}" style="color:#2563eb;text-decoration:none;">${safeSupportEmail}</a>.
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 32px;background-color:#f9fafb;border-top:1px solid #e5e7eb;text-align:center;">
                <p style="margin:0;font-size:12px;line-height:1.6;color:#9ca3af;">
                  Este correo fue enviado por ${safeAppName}.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

module.exports = {
  renderPasswordChangeWcTemplate,
};