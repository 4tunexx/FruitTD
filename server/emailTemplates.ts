/** Branded HTML for Resend verification emails (Fruit TD look). */
export function verifyEmailHtml(code: string): string {
  const digits = code.split('').map(
    (d) =>
      `<td style="width:42px;height:52px;text-align:center;font-size:26px;font-weight:800;color:#ecfccb;background:#122018;border:1px solid rgba(163,230,53,.35);border-radius:10px;letter-spacing:0">${d}</td>`
  );

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width" /></head>
<body style="margin:0;padding:0;background:#050a0f;font-family:'Segoe UI',system-ui,-apple-system,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#050a0f;padding:32px 12px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:440px;background:linear-gradient(180deg,#12261a 0%,#0a1210 40%,#080e14 100%);border:1px solid rgba(163,230,53,.22);border-radius:20px;overflow:hidden">
        <tr>
          <td style="padding:28px 28px 8px;text-align:center">
            <div style="display:inline-block;width:56px;height:56px;border-radius:16px;background:radial-gradient(circle at 35% 30%,#3dff7a,#146628);border:2px solid #a3e635;line-height:56px;font-size:28px">🍉</div>
            <p style="margin:14px 0 0;color:#a3e635;font-weight:800;letter-spacing:.28em;text-transform:uppercase;font-size:11px">Fruit TD</p>
            <h1 style="margin:8px 0 0;color:#f1f5f9;font-size:24px;font-weight:900;line-height:1.2">Confirm your email</h1>
            <p style="margin:10px 0 0;color:#94a3b8;font-size:14px;line-height:1.5;font-weight:600">
              Enter this code in the game to finish signing in. It expires in <strong style="color:#cbd5e1">30 minutes</strong>.
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:22px 28px 8px" align="center">
            <table role="presentation" cellpadding="0" cellspacing="8" style="margin:0 auto">
              <tr>${digits.join('')}</tr>
            </table>
            <p style="margin:18px 0 0;color:#64748b;font-size:12px;letter-spacing:.2em;font-weight:700">${code}</p>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 28px 28px;text-align:center">
            <p style="margin:0;padding:12px 14px;background:rgba(163,230,53,.08);border:1px solid rgba(163,230,53,.2);border-radius:12px;color:#a3e635;font-size:12px;font-weight:700;line-height:1.45">
              Slice. Hold the Wall. — See you in the slicer dashboard.
            </p>
            <p style="margin:16px 0 0;color:#475569;font-size:11px;line-height:1.4">
              If you did not create a Fruit TD account, you can ignore this email.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export function verifyEmailText(code: string): string {
  return `Fruit TD — confirm your email\n\nYour code is ${code}.\nIt expires in 30 minutes.\n\nIf you did not create an account, ignore this email.`;
}
