import { SendMailClient } from "zeptomail";

const client = new SendMailClient({
  url: "api.zeptomail.com/",
  token: process.env.ZEPTOMAIL_TOKEN!,
});

const FROM = {
  address: process.env.ZEPTOMAIL_FROM!,
  name: "Geniorama Tickets",
};

interface Recipient {
  name: string;
  email: string;
}

export async function sendInvitationEmail(to: Recipient, setPasswordUrl: string) {
  await client.sendMail({
    from: FROM,
    to: [{ email_address: { address: to.email, name: to.name } }],
    subject: "Bienvenido a Geniorama Tickets — Activa tu cuenta",
    htmlbody: `
      <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; color: #1f2937;">
        <div style="background: #4f46e5; padding: 24px 32px; border-radius: 8px 8px 0 0;">
          <h1 style="margin: 0; color: #ffffff; font-size: 20px;">Geniorama Tickets</h1>
        </div>
        <div style="background: #ffffff; padding: 32px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
          <p style="margin-top: 0;">Hola <strong>${to.name}</strong>,</p>
          <p>Se ha creado una cuenta para ti en el sistema de tickets de Geniorama.</p>
          <p>Haz clic en el botón para establecer tu contraseña y activar tu cuenta. El enlace es válido por <strong>48 horas</strong>.</p>
          <div style="text-align: center; margin: 32px 0;">
            <a href="${setPasswordUrl}"
               style="background: #4f46e5; color: #ffffff; padding: 12px 28px; border-radius: 6px; text-decoration: none; font-weight: bold; font-size: 15px;">
              Activar mi cuenta
            </a>
          </div>
          <p style="color: #6b7280; font-size: 13px;">
            Si no esperabas este correo, puedes ignorarlo.<br>
            O copia este enlace en tu navegador:<br>
            <a href="${setPasswordUrl}" style="color: #4f46e5; word-break: break-all;">${setPasswordUrl}</a>
          </p>
        </div>
      </div>
    `,
  });
}

export async function sendTicketAssignedEmail(to: Recipient, ticketTitle: string, ticketUrl: string) {
  await client.sendMail({
    from: FROM,
    to: [{ email_address: { address: to.email, name: to.name } }],
    subject: `Tu ticket está en proceso — ${ticketTitle}`,
    htmlbody: `
      <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; color: #1f2937;">
        <div style="background: #4f46e5; padding: 24px 32px; border-radius: 8px 8px 0 0;">
          <h1 style="margin: 0; color: #ffffff; font-size: 20px;">Geniorama Tickets</h1>
        </div>
        <div style="background: #ffffff; padding: 32px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
          <p style="margin-top: 0;">Hola <strong>${to.name}</strong>,</p>
          <p>Tu ticket ha sido asignado a un miembro de nuestro equipo y está en proceso de atención.</p>
          <p style="background: #f5f3ff; border-left: 4px solid #4f46e5; padding: 12px 16px; border-radius: 0 6px 6px 0; margin: 24px 0;">
            <strong>${ticketTitle}</strong>
          </p>
          <div style="text-align: center; margin: 32px 0;">
            <a href="${ticketUrl}"
               style="background: #4f46e5; color: #ffffff; padding: 12px 28px; border-radius: 6px; text-decoration: none; font-weight: bold; font-size: 15px;">
              Ver ticket
            </a>
          </div>
          <p style="color: #6b7280; font-size: 13px;">
            Puedes hacer seguimiento del avance desde el portal.<br>
            <a href="${ticketUrl}" style="color: #4f46e5; word-break: break-all;">${ticketUrl}</a>
          </p>
        </div>
      </div>
    `,
  });
}

export async function sendTicketClosedEmail(to: Recipient, ticketTitle: string, ticketUrl: string) {
  await client.sendMail({
    from: FROM,
    to: [{ email_address: { address: to.email, name: to.name } }],
    subject: `Ticket cerrado — ${ticketTitle}`,
    htmlbody: `
      <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; color: #1f2937;">
        <div style="background: #4f46e5; padding: 24px 32px; border-radius: 8px 8px 0 0;">
          <h1 style="margin: 0; color: #ffffff; font-size: 20px;">Geniorama Tickets</h1>
        </div>
        <div style="background: #ffffff; padding: 32px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
          <p style="margin-top: 0;">Hola <strong>${to.name}</strong>,</p>
          <p>Tu ticket ha sido marcado como <strong>cerrado</strong>. Si tienes dudas sobre la resolución, puedes escribir un comentario desde el portal.</p>
          <p style="background: #f0fdf4; border-left: 4px solid #16a34a; padding: 12px 16px; border-radius: 0 6px 6px 0; margin: 24px 0;">
            <strong>${ticketTitle}</strong>
          </p>
          <div style="text-align: center; margin: 32px 0;">
            <a href="${ticketUrl}"
               style="background: #4f46e5; color: #ffffff; padding: 12px 28px; border-radius: 6px; text-decoration: none; font-weight: bold; font-size: 15px;">
              Ver ticket
            </a>
          </div>
          <p style="color: #6b7280; font-size: 13px;">
            <a href="${ticketUrl}" style="color: #4f46e5; word-break: break-all;">${ticketUrl}</a>
          </p>
        </div>
      </div>
    `,
  });
}

export async function sendPasswordResetEmail(to: Recipient, resetUrl: string) {
  await client.sendMail({
    from: FROM,
    to: [{ email_address: { address: to.email, name: to.name } }],
    subject: "Restablecer contraseña — Geniorama Tickets",
    htmlbody: `
      <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; color: #1f2937;">
        <div style="background: #4f46e5; padding: 24px 32px; border-radius: 8px 8px 0 0;">
          <h1 style="margin: 0; color: #ffffff; font-size: 20px;">Geniorama Tickets</h1>
        </div>
        <div style="background: #ffffff; padding: 32px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
          <p style="margin-top: 0;">Hola <strong>${to.name}</strong>,</p>
          <p>Recibimos una solicitud para restablecer la contraseña de tu cuenta.</p>
          <p>Haz clic en el botón para establecer una nueva contraseña. El enlace es válido por <strong>48 horas</strong>.</p>
          <div style="text-align: center; margin: 32px 0;">
            <a href="${resetUrl}"
               style="background: #4f46e5; color: #ffffff; padding: 12px 28px; border-radius: 6px; text-decoration: none; font-weight: bold; font-size: 15px;">
              Establecer nueva contraseña
            </a>
          </div>
          <p style="color: #6b7280; font-size: 13px;">
            Si no solicitaste esto, puedes ignorarlo.<br>
            O copia este enlace:<br>
            <a href="${resetUrl}" style="color: #4f46e5; word-break: break-all;">${resetUrl}</a>
          </p>
        </div>
      </div>
    `,
  });
}
