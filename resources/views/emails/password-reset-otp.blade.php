<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; color: #1a1a1a; margin: 0; padding: 24px; background: #f4f6f8;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 480px; margin: 0 auto; background: #ffffff; border-radius: 8px; padding: 32px;">
        <tr>
            <td>
                <h2 style="margin-top: 0;">CareLink password reset</h2>
                <p>Use this code to continue resetting your password. It expires in {{ $expiresInMinutes }} minutes.</p>
                <p style="font-size: 32px; font-weight: bold; letter-spacing: 6px; text-align: center; margin: 24px 0;">
                    {{ $otp }}
                </p>
                <p>If you didn't request this, you can ignore this email.</p>
            </td>
        </tr>
    </table>
</body>
</html>
