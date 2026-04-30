function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderSupportPasswordTemplate({ userName, tempPassword, appName, supportEmail, loginUrl }) {
  const safeUserName = escapeHtml(userName || '');
  const safeTempPassword = escapeHtml(tempPassword || '');
  const safeAppName = escapeHtml(appName || 'BIA Sports 2026');
  const safeSupportEmail = escapeHtml(supportEmail || '');
  const safeLoginUrl = escapeHtml(loginUrl || '');
  const greeting = safeUserName ? `Hola ${safeUserName},` : 'Hola,';

  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Contrasena temporal asignada</title>
  </head>
  <body style="margin:0;padding:0;background-color:#f4f7fb;font-family:Arial,Helvetica,sans-serif;color:#1f2937;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f4f7fb;margin:0;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;background-color:#ffffff;border:1px solid #e5e7eb;border-radius:18px;overflow:hidden;">
            <tr>
              <td style="background:linear-gradient(135deg,#0f3d91 0%,#1d4ed8 100%);padding:32px 32px 24px 32px;text-align:center;">
                <div style="display:inline-block;background-color:rgba(255,255,255,0.12);color:#ffffff;font-size:12px;letter-spacing:1px;text-transform:uppercase;font-weight:700;padding:8px 12px;border-radius:999px;">
                  ${safeAppName}
                </div>
                <h1 style="margin:18px 0 0 0;color:#ffffff;font-size:28px;line-height:1.2;font-weight:700;">
                  Clave temporal asignada
                </h1>
                <p style="margin:12px 0 0 0;color:#dbeafe;font-size:15px;line-height:1.6;">
                  El equipo de soporte ha generado una contrasena temporal para tu cuenta.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                <p style="margin:0 0 16px 0;font-size:16px;line-height:1.7;color:#374151;">
                  ${greeting}
                </p>
                <p style="margin:0 0 16px 0;font-size:16px;line-height:1.7;color:#374151;">
                  Hemos asignado una <strong>clave temporal</strong> a tu cuenta para que puedas ingresar. Una vez dentro, puedes cambiarla desde tu perfil cuando lo desees.
                </p>

                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:24px 0;">
                  <tr>
                    <td style="background-color:#f0f7ff;border:2px dashed #2563eb;border-radius:12px;padding:20px;text-align:center;">
                      <p style="margin:0 0 8px 0;font-size:13px;color:#6b7280;text-transform:uppercase;letter-spacing:1px;font-weight:600;">
                        Tu clave temporal es
                      </p>
                      <p style="margin:0;font-size:26px;font-weight:700;letter-spacing:4px;color:#1d4ed8;font-family:Courier New,Courier,monospace;">
                        ${safeTempPassword}
                      </p>
                    </td>
                  </tr>
                </table>

                <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:24px auto;">
                  <tr>
                    <td align="center" style="border-radius:12px;background-color:#2563eb;">
                      <a href="${safeLoginUrl}" target="_blank" style="display:inline-block;padding:14px 28px;font-size:16px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:12px;background-color:#2563eb;">
                        Iniciar sesion
                      </a>
                    </td>
                  </tr>
                </table>

                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:24px 0 0 0;border-radius:10px;background-color:#fefce8;border:1px solid #fde68a;">
                  <tr>
                    <td style="padding:16px 20px;">
                      <p style="margin:0;font-size:14px;line-height:1.7;color:#92400e;">
                        <strong>Recomendacion de seguridad:</strong> Ingresa con esta clave temporal y cambiala desde <strong>Mi perfil</strong> lo antes posible para mantener tu cuenta segura.
                      </p>
                    </td>
                  </tr>
                </table>

                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:24px 0;border-top:1px solid #e5e7eb;">
                  <tr>
                    <td style="padding-top:24px;">
                      <p style="margin:0;font-size:14px;line-height:1.7;color:#6b7280;">
                        Si no solicitaste este cambio o tienes dudas, escribenos a <a href="mailto:${safeSupportEmail}" style="color:#2563eb;text-decoration:none;">${safeSupportEmail}</a>.
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
  renderSupportPasswordTemplate,
};
